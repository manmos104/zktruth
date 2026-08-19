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

export interface ShareEvent {
  messageId: number
  source: 'views' | 'repost' | 'forward'
  weight: number      // views: each burst of 20 views = 1 share
  timestamp: number
}

export interface UserRecord {
  wallet: string
  posts: PostEvent[]
  reactions: ReactionEvent[]
  shares: ShareEvent[]
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
    shares: [],
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
    shares: [],
    updatedAt: 0,
  }
  // Guard against a double-mint retry producing duplicate entries for
  // the same channel message.
  if (cur.posts.some((p) => p.messageId === event.messageId)) return cur
  cur.posts.push(event)
  return upsertUser(wallet, { posts: cur.posts })
}

export async function appendReaction(wallet: string, event: ReactionEvent): Promise<UserRecord> {
  const cur = (await getUser(wallet)) ?? {
    wallet,
    posts: [],
    reactions: [],
    shares: [],
    updatedAt: 0,
  }
  cur.reactions.push(event)
  return upsertUser(wallet, { reactions: cur.reactions })
}

export async function appendShare(wallet: string, event: ShareEvent): Promise<UserRecord> {
  const cur = (await getUser(wallet)) ?? {
    wallet,
    posts: [],
    reactions: [],
    shares: [],
    updatedAt: 0,
  }
  cur.shares.push(event)
  return upsertUser(wallet, { shares: cur.shares })
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

export const POST_WEIGHT = 2
export const REACTION_WEIGHT = 8
export const SHARE_WEIGHT = 10

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
  sharesTotal: number
  postsScore: number
  reactionsScore: number
  sharesScore: number
}

export function computeScore(user: UserRecord | null, now = Date.now()): TrustBreakdown {
  if (!user) {
    const t = tierForScore(0)
    return {
      score: 0,
      tier: t.tier,
      emoji: t.emoji,
      posts: 0,
      reactionsTotal: 0,
      sharesTotal: 0,
      postsScore: 0,
      reactionsScore: 0,
      sharesScore: 0,
    }
  }
  const postsScore = user.posts.reduce(
    (s, p) => s + POST_WEIGHT * decay(now, p.timestamp),
    0,
  )
  // Reactions are net (+1/-1) so removing a reaction pulls score back.
  const reactionsScore = user.reactions.reduce(
    (s, r) => s + REACTION_WEIGHT * r.delta * decay(now, r.timestamp),
    0,
  )
  const sharesScore = user.shares.reduce(
    (s, sh) => s + SHARE_WEIGHT * sh.weight * decay(now, sh.timestamp),
    0,
  )
  const score = Math.max(0, Math.round((postsScore + reactionsScore + sharesScore) * 10) / 10)
  const meta = tierForScore(score)

  return {
    score,
    tier: meta.tier,
    emoji: meta.emoji,
    posts: user.posts.length,
    reactionsTotal: user.reactions.reduce((s, r) => s + r.delta, 0),
    sharesTotal: user.shares.reduce((s, sh) => s + sh.weight, 0),
    postsScore: Math.round(postsScore * 10) / 10,
    reactionsScore: Math.round(reactionsScore * 10) / 10,
    sharesScore: Math.round(sharesScore * 10) / 10,
  }
}
