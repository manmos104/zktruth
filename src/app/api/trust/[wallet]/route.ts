import { NextResponse } from 'next/server'
import { Address } from '@ton/core'
import { computeScore, getUser } from '@/lib/trustStore'

/**
 * GET /api/trust/<wallet>
 *
 * Returns the current Trust Score + breakdown for the given wallet.
 * Called by the Mini App profile screen and by the channel-post caption
 * builder when we want to embed a `🏆 Trust: <n>` badge on the caption.
 *
 * The wallet segment can be either a raw TON address (`0:<hex>`) or
 * the user-friendly form (`UQ…`). We normalise both to the friendly
 * form before lookup so the store stays keyed off a single format.
 */

export const runtime = 'nodejs'

function normaliseWallet(input: string): string {
  try {
    return Address.parse(input).toString({
      urlSafe: true,
      bounceable: false,
      testOnly: false,
    })
  } catch {
    return input
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet: rawWallet } = await params
  const wallet = normaliseWallet(decodeURIComponent(rawWallet))
  try {
    const user = await getUser(wallet)
    const breakdown = computeScore(user)
    return NextResponse.json(
      { wallet, ...breakdown },
      { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
