import { getRedis } from './trustStore'

/**
 * Weekly Reward Pool accounting.
 *
 * Every mint contributes 0.085 TON (85 % of the 0.10 TON service fee)
 * to the current epoch's reward pool. The remaining 15 % goes to the
 * protocol treasury (tracked separately for accounting only — the
 * mint tx already sends the full fee to the treasury address).
 *
 * Because the on-chain contract can't split payments retroactively
 * without a redeploy, we treat accounting as OFF-CHAIN: the treasury
 * wallet holds all fees, and each week's cron computes the payout
 * list from these KV numbers. The operator signs one multi-transfer
 * tx via Tonkeeper to disburse the epoch's rewards.
 *
 * KV layout
 * ---------
 *   epoch:YYYY-WW       → { poolTon: number, mintCount: number, updatedAt }
 *   epoch:YYYY-WW:mints → SET of msgIds (dedup guard)
 *   epoch:current       → the current epoch id string (denormalised
 *                          so `/api/reward/pool` doesn't need date math
 *                          on every request)
 *   epoch:payouts:YYYY-WW → { rows: [{wallet, ton}], generatedAt, status }
 *
 * Week numbers use ISO 8601 weeks (Mon = day 1), computed from UTC.
 * Payouts happen on Monday 00:00 UTC for the PREVIOUS ISO week.
 */

// BOOTSTRAP PHASE — 100 % of the service fee goes to the weekly
// reward pool. The founder explicitly opted out of an operations
// cut for the low-user-count launch window; all fees flow straight
// to the top-3 winners so the incentive to compete is maximised.
// Bump TREASURY_SHARE back up once the user base is large enough
// that ops costs (Vercel / Blob / RPC) need covering from the fees.
export const TREASURY_SHARE = 0.00
export const REWARD_POOL_SHARE = 1.00
export const SERVICE_FEE_TON = 0.10
export const POOL_CONTRIBUTION_PER_MINT = SERVICE_FEE_TON * REWARD_POOL_SHARE

export interface EpochRecord {
  epochId: string
  poolTon: number
  mintCount: number
  updatedAt: number
}

// ISO 8601 week id: `YYYY-WW`. Weeks start Monday UTC.
export function epochIdFrom(ms: number): string {
  const d = new Date(ms)
  // ISO week calc: shift date to the Thursday of the ISO week, then
  // year+week are derived from that.
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (utc.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  utc.setUTCDate(utc.getUTCDate() - dayNum + 3) // move to Thursday
  const isoYear = utc.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4))
  const firstThuDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThuDayNum + 3)
  const week =
    1 +
    Math.round((utc.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
  return `${isoYear}-${String(week).padStart(2, '0')}`
}

export function currentEpochId(now = Date.now()): string {
  return epochIdFrom(now)
}

export function nextEpochStartMs(now = Date.now()): number {
  // Next Monday 00:00 UTC
  const d = new Date(now)
  const dayOfWeekUtc = d.getUTCDay() // Sun=0..Sat=6
  const daysToMon = (8 - dayOfWeekUtc) % 7 || 7
  const target = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + daysToMon,
    0, 0, 0, 0,
  ))
  return target.getTime()
}

export async function creditMintToPool(messageId: number): Promise<EpochRecord> {
  const r = getRedis()
  const epochId = currentEpochId()
  const setKey = `epoch:${epochId}:mints`
  const recKey = `epoch:${epochId}`
  // Dedup: same messageId can't inflate the pool twice.
  const dedupKey = messageId > 0 ? String(messageId) : `nomsg:${Date.now()}:${Math.random()}`
  const added = await r.sadd(setKey, dedupKey)
  if (added === 0) {
    const existing = (await r.get<EpochRecord>(recKey)) ?? {
      epochId,
      poolTon: 0,
      mintCount: 0,
      updatedAt: Date.now(),
    }
    return existing
  }
  const cur = (await r.get<EpochRecord>(recKey)) ?? {
    epochId,
    poolTon: 0,
    mintCount: 0,
    updatedAt: Date.now(),
  }
  cur.poolTon = Math.round((cur.poolTon + POOL_CONTRIBUTION_PER_MINT) * 1000) / 1000
  cur.mintCount += 1
  cur.updatedAt = Date.now()
  await r.set(recKey, cur)
  await r.set('epoch:current', epochId)
  return cur
}

export async function getEpoch(epochId: string): Promise<EpochRecord | null> {
  const r = getRedis()
  return (await r.get<EpochRecord>(`epoch:${epochId}`)) ?? null
}

// BOOTSTRAP PHASE payout schedule — top 3 only, 60 / 30 / 10.
//
// Rationale (see also the founder's incentive-design note): with a
// 10-20 user base the old top-100 curve would pay every participant
// a token amount and destroy the incentive to actually compete. A
// tight top-3 makes 1st place feel meaningful ($10-15 at current
// TON prices), 2nd and 3rd still visible enough to chase.
//
// Ratios sum to 100 %. Ranks 4+ get 0 — they compete for tier badges
// and next week's slot instead.
export function payoutShareForRank(rank: number): number {
  if (rank === 1) return 0.60
  if (rank === 2) return 0.30
  if (rank === 3) return 0.10
  return 0
}

export const LEADERBOARD_SIZE = 3

// Quality gate for the weekly top-3 payout. A wallet is only eligible
// for a payout if they minted at least this many verified proofs in
// the epoch. Blocks "one big mint on Sunday night" from stealing a
// slot from someone who actually worked all week, and gives the
// weekly rhythm some substance without needing full Sybil defence.
export const MIN_MINTS_FOR_PAYOUT = 3
