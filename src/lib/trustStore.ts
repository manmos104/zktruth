import { Redis } from '@upstash/redis'

/**
 * Trust Score data model + Upstash Redis (KV) accessors.
 *
 * Redis key layout
 * ----------------
 *   user:<wallet>            → JSON  UserRecord
 *   msg:<messageId>          → JSON  MessageRecord   (message_id → wallet lookup)
 *   channelMsgIds            → SET   of all tracked message_ids (for polling)
 *
 * Wallet addresses are stored in TON user-friendly form (UQ…) so the
 * profile page + caption badge match what Tonkeeper displays. Anything
 * that comes in as raw form (0:hex) is normalised on write.
 *
 * All events (post / reaction / share) are stored as append-only
 * entries so the scorer can apply time-decay per-event rather than
 * losing the timestamps in a running sum.
 */

export interface PostEvent {
  messageId: number
  timestamp: number // ms since epoch
}

export interface ReactionEvent {
  messageId: number
  emoji: string
  delta: number       // +1 add, -1 remove
  timestamp: number
}

/**
 * @deprecated Share tracking removed 2026-09 — Telegram Bot API doesn't
 * expose forward counts to bots, and the views-based approximation was
 * unreliable (getMessages doesn't exist). Kept as a type stub so old
 * KV records with a `shares` field still parse, and legacy imports
 * elsewhere don't break the build. Not used by computeScore.
 */
export interface ShareEvent {
  messageId: number
  source: 'views' | 'repost' | 'forward'
  weight: number
  timestamp: number
}

export interface UserRecord {
  wallet: string
  posts: PostEvent[]
  reactions: ReactionEvent[]
  /** @deprecated retained for backward-compat with existing KV rows. */
  shares?: ShareEvent[]
  updatedAt: number
}

export interface MessageRecord {
  messageId: number
  wallet: string
  postedAt: number
  // Cached counters so we can compute deltas without re-scanning
  // the whole message history.
  lastViews: number
  lastReactionSignature: string  // JSON.stringify of last reaction map
}

// Lazy singleton — Redis client is safe to reuse across invocations
// in a Vercel Function's warm-request lifecycle.
let redis: Redis | null = null
export function getRedis(): Redis {
  if (redis) return redis
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN not configured')
  }
  redis = new Redis({ url, token })
  return redis
}

export const userKey = (wallet: string) => `user:${wallet}`
export const msgKey = (msgId: number | string) => `msg:${msgId}`
export const CHANNEL_MSG_SET = 'channelMsgIds'

export async function getUser(wallet: string): Promise<UserRecord | null> {
  const r = getRedis()
  const raw = await r.get<UserRecord>(userKey(wallet))
  return raw ?? null
}

export async function upsertUser(wallet: string, patch: Partial<UserRecord>): Promise<UserRecord> {
  const r = getRedis()
  const existing = (await r.get<UserRecord>(userKey(wallet))) ?? {
    wallet,
    posts: [],
    reactions: [],
    updatedAt: Date.now(),
  }
  const merged: UserRecord = {
    ...existing,
    ...patch,
    wallet,
    updatedAt: Date.now(),
  }
  await r.set(userKey(wallet), merged)
  return merged
}

export async function appendPost(wallet: string, event: PostEvent): Promise<UserRecord> {
  const cur = (await getUser(wallet)) ?? {
    wallet,
    posts: [],
    reactions: [],
    updatedAt: 0,
  }
  // Guard against a double-mint retry producing duplicate entries for
  // the same channel message. (messageId 0 is the "no-post mint" case
  // and CAN legitimately appear multiple times per wallet.)
  if (event.messageId > 0 && cur.posts.some((p) => p.messageId === event.messageId)) return cur

  // Anti-spam: enforce DAILY_POST_CAP by counting existing posts within
  // the same UTC day. On-chain mint still succeeded; we just skip the
  // Trust Score credit for anything beyond the daily allowance.
  const dayStart = new Date(event.timestamp)
  dayStart.setUTCHours(0, 0, 0, 0)
  const dayStartMs = dayStart.getTime()
  const dayEndMs = dayStartMs + 86_400_000
  const todayCount = cur.posts.filter(
    (p) => p.timestamp >= dayStartMs && p.timestamp < dayEndMs,
  ).length
  if (todayCount >= DAILY_POST_CAP) return cur

  cur.posts.push(event)
  return upsertUser(wallet, { posts: cur.posts })
}

export async function appendReaction(wallet: string, event: ReactionEvent): Promise<UserRecord> {
  const cur = (await getUser(wallet)) ?? {
    wallet,
    posts: [],
    reactions: [],
    updatedAt: 0,
  }
  cur.reactions.push(event)
  return upsertUser(wallet, { reactions: cur.reactions })
}

/**
 * @deprecated no-op. Share tracking removed — retained only so
 * existing callers compile during the transition. Delete once every
 * import site is cleaned up.
 */
export async function appendShare(wallet: string, _event: ShareEvent): Promise<UserRecord> {
  const cur = (await getUser(wallet)) ?? {
    wallet,
    posts: [],
    reactions: [],
    updatedAt: 0,
  }
  return cur
}

export async function getMessageRecord(msgId: number | string): Promise<MessageRecord | null> {
  const r = getRedis()
  return (await r.get<MessageRecord>(msgKey(msgId))) ?? null
}

export async function saveMessageRecord(rec: MessageRecord): Promise<void> {
  const r = getRedis()
  await r.set(msgKey(rec.messageId), rec)
  await r.sadd(CHANNEL_MSG_SET, String(rec.messageId))
}

// ---- Score calculation ------------------------------------------------
//
// Weights are tuned so posts contribute the least, engagement (reactions +
// shares) dominates the score — matches the "投稿 < リアクション/シェア"
// weighting requested. Every event decays with time so long-idle accounts
// gradually surrender rank to active ones.

// Weights: reactions (external validation) dominate; posts (spammable
// via self-mint, so daily-capped) provide a small baseline. Share
// tracking was removed because Telegram Bot API doesn't surface real
// forward counts to bots — see the ShareEvent @deprecated note above.
export const POST_WEIGHT = 1
export const REACTION_WEIGHT = 5
/** @deprecated retained for legacy imports; not used by computeScore. */
export const SHARE_WEIGHT = 0
// Multiplicative boost when a capture passed Telegram initData
// verification AND has anomaly severity below 20. Applied post-hoc
// in computeScore.
export const ATTESTATION_MULTIPLIER = 1.3
// Anti-spam: cap the number of post events credited per wallet per
// calendar day (UTC). On-chain mints beyond this still succeed and
// keep their NFTs — they just don't add to Trust Score.
export const DAILY_POST_CAP = 5

// Decay: weight / (1 + days * 0.05)
//   1 day old   → ×0.95
//   30 days old → ×0.40
//   90 days old → ×0.18
//   1 year old  → ×0.05
function decay(now: number, timestamp: number): number {
  const days = Math.max(0, (now - timestamp) / 86_400_000)
  return 1 / (1 + days * 0.05)
}

// Trust tier — journalism / investigative-reporter progression.
// Chosen over the earlier Bronze/Silver/Gold metals so the ladder
// reinforces the "Proof of Capture = reporting" narrative rather than
// looking like a generic game score. Emoji + colour also drive the
// sidebar chip and the profile modal badge.
export type TrustTier =
  | 'Source'                 // 0–49       — anonymous informant
  | 'Whistleblower'          // 50–199     — steps forward publicly
  | 'Muckraker'              // 200–999    — digs up buried stories
  | 'Investigative Reporter' // 1000–4999  — established investigator
  | 'Truth-Teller'           // 5000+      — canonical truth-source

export interface TierMeta {
  tier: TrustTier
  emoji: string
  color: string       // primary text color for chip / badge
  glow: string        // subtle text-shadow color for higher tiers
  min: number
}

export const TIERS: TierMeta[] = [
  { tier: 'Source',                 emoji: '🕯', color: '#8b8b8b', glow: 'transparent',           min: 0 },
  { tier: 'Whistleblower',          emoji: '📢', color: '#4dd4ff', glow: 'rgba(77,212,255,0.35)', min: 50 },
  { tier: 'Muckraker',              emoji: '🔦', color: '#ffcf5c', glow: 'rgba(255,207,92,0.35)', min: 200 },
  { tier: 'Investigative Reporter', emoji: '🔍', color: '#ff7a4d', glow: 'rgba(255,122,77,0.4)',  min: 1000 },
  { tier: 'Truth-Teller',           emoji: '⚖️', color: '#00ff87', glow: 'rgba(0,255,135,0.5)',   min: 5000 },
]

export function tierForScore(score: number): TierMeta {
  let match = TIERS[0]
  for (const t of TIERS) {
    if (score >= t.min) match = t
  }
  return match
}

export interface TrustBreakdown {
  score: number
  tier: TrustTier
  emoji: string
  posts: number
  reactionsTotal: number
  postsScore: number
  reactionsScore: number
  // Ranking-score inputs — needed by the leaderboard endpoint to
  // combine last-7-days activity with all-time Trust Score. Exposed
  // separately so callers can render "weekly rank vs baseline" UI.
  weeklyPosts: number
  weeklyReactions: number
  rankingScore: number
}

// 7-day rolling window in ms.
const WEEK_MS = 7 * 86_400_000

export function computeScore(user: UserRecord | null, now = Date.now()): TrustBreakdown {
  if (!user) {
    const t = tierForScore(0)
    return {
      score: 0,
      tier: t.tier,
      emoji: t.emoji,
      posts: 0,
      reactionsTotal: 0,
      postsScore: 0,
      reactionsScore: 0,
      weeklyPosts: 0,
      weeklyReactions: 0,
      rankingScore: 0,
    }
  }

  const postsScore = user.posts.reduce(
    (s, p) => s + POST_WEIGHT * decay(now, p.timestamp),
    0,
  )
  const reactionsScore = user.reactions.reduce(
    (s, r) => s + REACTION_WEIGHT * r.delta * decay(now, r.timestamp),
    0,
  )
  const rawScore = postsScore + reactionsScore

  // Attestation multiplier — if *any* recent post carried a
  // Telegram-verified low-anomaly claim, apply the trust boost. We
  // check the last post because that's what our ingestion pipeline
  // could stamp — future work can extend to per-event flags.
  const hasAttestation = user.posts.some(
    (p) => (p as unknown as { attested?: boolean }).attested === true,
  )
  const multiplier = hasAttestation ? ATTESTATION_MULTIPLIER : 1
  const score = Math.max(0, Math.round(rawScore * multiplier * 10) / 10)
  const meta = tierForScore(score)

  // 7-day rolling counts feed the leaderboard's weekly-heavy ranking.
  const weekAgo = now - WEEK_MS
  const weeklyPosts = user.posts.filter((p) => p.timestamp >= weekAgo).length
  const weeklyReactions = user.reactions
    .filter((r) => r.timestamp >= weekAgo)
    .reduce((s, r) => s + Math.max(0, r.delta), 0)

  const weeklyRaw =
    weeklyReactions * REACTION_WEIGHT +
    weeklyPosts * POST_WEIGHT
  const rankingScore =
    Math.round((weeklyRaw * 0.7 + score * 0.3) * multiplier * 10) / 10

  return {
    score,
    tier: meta.tier,
    emoji: meta.emoji,
    posts: user.posts.length,
    reactionsTotal: user.reactions.reduce((s, r) => s + r.delta, 0),
    postsScore: Math.round(postsScore * 10) / 10,
    reactionsScore: Math.round(reactionsScore * 10) / 10,
    weeklyPosts,
    weeklyReactions,
    rankingScore,
  }
}
