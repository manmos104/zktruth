import { NextResponse } from 'next/server'
import { getRedis } from '@/lib/trustStore'

/**
 * GET /api/telegram/webhook-stats
 *
 * Small debug endpoint that reports whether our Telegram webhook is
 * actually being hit. Useful when the "reactions don't seem to count"
 * question comes up — if `total = 0` here, Telegram never posted to
 * us (channel reactions disabled, bot not admin, wrong webhook URL,
 * …) and the trust store can't be blamed.
 */

export const runtime = 'nodejs'

export async function GET() {
  try {
    const r = getRedis()
    const [total, reactionCount, other, last] = await Promise.all([
      r.get<number>('webhook:hits:total'),
      r.get<number>('webhook:hits:message_reaction_count'),
      r.get<number>('webhook:hits:other'),
      r.get<{ at: number; kind: string; body: string }>('webhook:last'),
    ])
    return NextResponse.json({
      totalHits: total ?? 0,
      reactionCountHits: reactionCount ?? 0,
      otherHits: other ?? 0,
      lastPayload: last,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
