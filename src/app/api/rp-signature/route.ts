import { NextRequest, NextResponse } from 'next/server'
import { signRequest } from '@worldcoin/idkit-core/signing'

/**
 * /api/rp-signature — signs IDKit v4 request contexts.
 *
 * The Worldcoin v4 protocol requires every proof request to be signed by the
 * RP's (Relying Party) ECDSA private key. This proves to the World App that
 * the request genuinely came from this app and not an impersonator. We hold
 * the private key as a Vercel server env var (never exposed to the client)
 * and use it here to sign each request the browser makes.
 *
 * The signed payload is returned to the IDKitRequestWidget which forwards it
 * to World App as `rp_context`.
 *
 * Body: { action: string }
 * Returns: { sig, nonce, created_at, expires_at }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const action: string | undefined = body?.action
    const signingKeyHex = process.env.RP_SIGNING_KEY
    if (!signingKeyHex) {
      return NextResponse.json(
        { error: 'RP_SIGNING_KEY env var is not configured' },
        { status: 500 },
      )
    }

    // For session proofs we deliberately omit `action` so the signature
    // matches the session message format. For uniqueness proofs (legacy
    // path), pass `action` and it will be hashed into the signature.
    const { sig, nonce, createdAt, expiresAt } = signRequest(
      action ? { signingKeyHex, action } : { signingKeyHex },
    )

    return NextResponse.json({
      sig,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
    })
  } catch (e) {
    console.error('[rp-signature] error', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
