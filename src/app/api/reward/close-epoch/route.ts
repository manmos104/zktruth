import { NextResponse } from 'next/server'
import {
  computeScore,
  getRedis,
  type UserRecord,
} from '@/lib/trustStore'
import {
  epochIdFrom,
  getEpoch,
  LEADERBOARD_SIZE,
  payoutShareForRank,
} from '@/lib/rewardPool'

/**
 * Weekly payout close-out. Wired to a Vercel cron:
 *
 *   { "path": "/api/reward/close-epoch", "schedule": "0 0 * * 1" }
 *
 * (Monday 00:00 UTC.) Computes the payout list for the ISO week that
 * JUST ended (previous week from server's perspective), stores it
 * under `epoch:payouts:YYYY-WW` in KV, and returns the same list so
 * the operator's Mini App / dashboard can display it for manual
 * signing in Tonkeeper.
 *
 * The cron does NOT send TON on its own — that requires a signer
 * wallet we deliberately don't host. Instead the payout list acts
 * as a batch instruction the operator submits manually. This keeps
 * the treasury key off-network.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return doClose()
}
export async function POST() {
  return doClose()
}

async function doClose() {
  try {
    const r = getRedis()

    // The epoch that just ended is the one containing "now - 1 hour"
    // (i.e., last Sunday 23:00 UTC). Using -1h avoids DST edge cases.
    const closedEpochId = epochIdFrom(Date.now() - 3600_000)
    const epoch = await getEpoch(closedEpochId)
    const poolTon = epoch?.poolTon ?? 0

    // Fetch every user, compute ranking score frozen at epoch end.
    const keys = await r.keys('user:*')
    const records = keys.length
      ? (await r.mget<UserRecord[]>(...keys)).filter((x): x is UserRecord => !!x && !!x.wallet)
      : []
    const now = Date.now()
    const scored = records
      .map((u) => ({ user: u, b: computeScore(u, now) }))
      .sort((a, b) => b.b.rankingScore - a.b.rankingScore || b.b.score - a.b.score)
      .slice(0, LEADERBOARD_SIZE)

    const rows = scored.map((entry, i) => {
      const rank = i + 1
      const share = payoutShareForRank(rank)
      return {
        rank,
        wallet: entry.user.wallet,
        rankingScore: entry.b.rankingScore,
        payoutShare: share,
        payoutTon: Math.round(poolTon * share * 1000) / 1000,
      }
    })

    const payoutRecord = {
      epochId: closedEpochId,
      poolTon,
      mintCount: epoch?.mintCount ?? 0,
      generatedAt: now,
      status: 'pending' as const,
      rows,
    }
    await r.set(`epoch:payouts:${closedEpochId}`, payoutRecord)

    return NextResponse.json(payoutRecord)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
