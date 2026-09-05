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

export const TREASURY_SHARE = 0.15
export const REWARD_POOL_SHARE = 0.85
// Absolute TON that gets added to the pool per mint. Mirrors the
// contract's SERVICE_FEE - TREASURY_SHARE * SERVICE_FEE math.
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

// Top-100 累進 payout schedule. Ratios sum to 100 %.
//   #1        20 %
//   #2-3      10 % each  (20 % total)
//   #4-10      4 % each  (28 % total)
//   #11-25     1 % each  (15 % total)
//   #26-50     0.4 % each (10 % total)
//   #51-100    0.14 % each ( 7 % total)
// Top-heavy so competition stays sharp, but the whole top 100 gets
// paid so casual users still feel rewarded for participation.
export function payoutShareForRank(rank: number): number {
  if (rank === 1) return 0.20
  if (rank >= 2 && rank <= 3) return 0.10
  if (rank >= 4 && rank <= 10) return 0.04
  if (rank >= 11 && rank <= 25) return 0.01
  if (rank >= 26 && rank <= 50) return 0.004
  if (rank >= 51 && rank <= 100) return 0.0014
  return 0
}

// Convenience for the leaderboard / close-epoch endpoints — how many
// wallets we bother scoring for the payout. Change here + payout
// schedule to grow / shrink the recipient pool.
export const LEADERBOARD_SIZE = 100
