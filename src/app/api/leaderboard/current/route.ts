import { NextResponse } from 'next/server'
import {
  computeScore,
  getRedis,
  type UserRecord,
} from '@/lib/trustStore'
import {
  currentEpochId,
  getEpoch,
  MIN_MINTS_FOR_PAYOUT,
  nextEpochStartMs,
  payoutShareForRank,
} from '@/lib/rewardPool'

// Show more than 3 rows in the leaderboard UI even though only the
// top 3 (among wallets that meet the mint quality gate) actually get
// paid. Displaying 20 lets users see themselves and the wallets
// ahead of them so they know what they're chasing.
const LEADERBOARD_DISPLAY_SIZE = 20

/**
 * GET /api/leaderboard/current
 *
 * Returns the current epoch's top-50 leaderboard sorted by ranking
 * score (weekly-heavy hybrid). Also includes the current reward pool
 * balance and the projected TON payout each rank would receive if
 * the epoch closed right now.
 *
 * Scans every `user:*` key in KV once — fine for the first several
 * thousand wallets. Beyond that we'd move to a sorted-set-based
 * leaderboard maintained incrementally by writes.
 */
export const runtime = 'nodejs'

interface LeaderboardRow {
  rank: number
  wallet: string
  rankingScore: number
  allTimeScore: number
  tier: string
  emoji: string
  weeklyPosts: number
  weeklyMints: number
  weeklyReactions: number
  payoutShare: number
  payoutTon: number
  /** True when the wallet has enough mints to qualify for the payout. */
  eligibleForPayout: boolean
  /** 1-indexed position AMONG eligible wallets (null if not eligible). */
  payoutRank: number | null
}

export async function GET() {
  try {
    const r = getRedis()
    // Fetch all user records. `scan` is safer than `keys` for large
    // sets but Upstash keys() is fine at MVP scale.
    const keys = await r.keys('user:*')
    if (keys.length === 0) {
      const epoch = await getEpoch(currentEpochId())
      return NextResponse.json({
        epochId: currentEpochId(),
        poolTon: epoch?.poolTon ?? 0,
        mintCount: epoch?.mintCount ?? 0,
        nextPayoutMs: nextEpochStartMs(),
        minMintsForPayout: MIN_MINTS_FOR_PAYOUT,
        payoutSlots: 3,
        rows: [],
      }, { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30' } })
    }
    // Upstash mget returns null for missing keys; typed as UserRecord[]
    const records = (await r.mget<UserRecord[]>(...keys))
      .filter((x): x is UserRecord => !!x && !!x.wallet)

    const now = Date.now()
    const scored = records.map((u) => {
      const b = computeScore(u, now)
      return { user: u, b }
    })
    // Sort desc by rankingScore. Ties broken by allTime score.
    scored.sort((a, b) => b.b.rankingScore - a.b.rankingScore || b.b.score - a.b.score)

    const top = scored.slice(0, LEADERBOARD_DISPLAY_SIZE)
    const epoch = await getEpoch(currentEpochId())
    const poolTon = epoch?.poolTon ?? 0

    // Assign payoutRank separately from the display rank. The display
    // rank comes from rankingScore only (visible top-N). The payout
    // rank is computed among wallets that clear the mint quality gate
    // — a wallet ranked #4 overall can still be paid if the wallets
    // ahead of them didn't mint enough this week.
    let nextPayoutRank = 1
    const rows: LeaderboardRow[] = top.map((entry, i) => {
      const eligible = entry.b.weeklyMints >= MIN_MINTS_FOR_PAYOUT
      const payoutRank = eligible ? nextPayoutRank++ : null
      const share = payoutRank != null ? payoutShareForRank(payoutRank) : 0
      return {
        rank: i + 1,
        wallet: entry.user.wallet,
        rankingScore: entry.b.rankingScore,
        allTimeScore: entry.b.score,
        tier: entry.b.tier,
        emoji: entry.b.emoji,
        weeklyPosts: entry.b.weeklyPosts,
        weeklyMints: entry.b.weeklyMints,
        weeklyReactions: entry.b.weeklyReactions,
        payoutShare: share,
        payoutTon: Math.round(poolTon * share * 1000) / 1000,
        eligibleForPayout: eligible,
        payoutRank,
      }
    })

    return NextResponse.json(
      {
        epochId: currentEpochId(),
        poolTon,
        mintCount: epoch?.mintCount ?? 0,
        nextPayoutMs: nextEpochStartMs(),
        minMintsForPayout: MIN_MINTS_FOR_PAYOUT,
        payoutSlots: 3,
        rows,
      },
      { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
