import { NextResponse } from 'next/server'
import { loadSigner, publishCast } from '@/lib/neynar'

/**
 * POST /api/farcaster/cast
 *   body: {
 *     wallet: string,     // the wallet whose signer we should use
 *     text: string,       // cast body (≤ 320 chars)
 *     embeds?: string[],  // rich-embed URLs (typically the /proof URL)
 *     channel_id?: string // optional Farcaster channel to post to
 *   }
 *
 * Requires the user to have completed the signer-approval flow first
 * (POST /api/farcaster/signer). If the stored signer isn't yet
 * approved we return 409 so the client can nudge the user to approve
 * in Warpcast.
 */

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: {
    wallet?: string
    text?: string
    embeds?: string[]
    channel_id?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
  }
  const wallet = body.wallet
  const text = body.text
  if (!wallet || typeof wallet !== 'string') {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 })
  }
  if (!text || typeof text !== 'string' || text.length === 0) {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }
  if (text.length > 1024) {
    return NextResponse.json({ error: 'text too long (max 1024 chars)' }, { status: 400 })
  }

  try {
    const signer = await loadSigner(wallet)
    if (!signer) {
      return NextResponse.json(
        { error: 'No signer connected for this wallet — connect Farcaster first' },
        { status: 404 },
      )
    }
    if (signer.status !== 'approved') {
      return NextResponse.json(
        {
          error: 'Signer not approved yet',
          signer_approval_url: signer.signer_approval_url,
          status: signer.status,
        },
        { status: 409 },
      )
    }

    const embeds = Array.isArray(body.embeds)
      ? body.embeds.filter((e): e is string => typeof e === 'string' && e.length > 0).slice(0, 2)
      : undefined

    const cast = await publishCast({
      signer_uuid: signer.signer_uuid,
      text,
      embeds,
      channel_id: body.channel_id,
    })
    return NextResponse.json({ ok: true, cast })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
