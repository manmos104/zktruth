import { NextRequest, NextResponse } from 'next/server'

/**
 * /api/verify — proxies a v4 IDKitResult straight to Worldcoin's v4 verify
 * endpoint and unwraps the response.
 *
 * Worldcoin's docs (`docs.world.org` → IDKit integrate, Step 5) recommend
 * forwarding the IDKit payload "as-is" with no field remapping, so this
 * route is intentionally thin.
 */

const RP_ID = process.env.WORLD_RP_ID || 'rp_5c50700e68b83094'
const VERIFY_URL = `https://developer.world.org/api/v4/verify/${RP_ID}`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const idkitResponse = body.idkitResponse ?? body

    console.log('[verify] forwarding to v4', {
      rp_id: RP_ID,
      protocol_version: idkitResponse?.protocol_version,
      action: idkitResponse?.action,
      response_count: Array.isArray(idkitResponse?.responses)
        ? idkitResponse.responses.length
        : 0,
    })

    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(idkitResponse),
    })

    const raw = await response.text()
    let data: unknown
    try { data = JSON.parse(raw) } catch { data = raw }

    console.log('[verify] worldcoin v4 response', response.status, data)

    if (response.ok) {
      // Worldcoin v4 success returns { success: true, action, nullifier, ... }
      // For session proofs the nullifier lives at
      // responses[0].session_nullifier[0] (the tuple is
      // [session_nullifier, generated_action]). Uniqueness proofs put it
      // at responses[0].nullifier. We also fall back to the top-level
      // `nullifier` field when present.
      const ok = (data && typeof data === 'object'
        ? data
        : {}) as Record<string, unknown>
      const results = Array.isArray(ok.results) ? ok.results : []
      const first = results[0] as Record<string, unknown> | undefined
      const sessionNullTuple = Array.isArray(first?.session_nullifier)
        ? (first?.session_nullifier as unknown[])
        : null
      const nullifier =
        (sessionNullTuple?.[0] as string | undefined) ??
        (ok.nullifier as string | undefined) ??
        (first?.nullifier as string | undefined) ??
        null
      // Also pull it from idkitResponse directly in case the verify
      // endpoint returns a thin success envelope.
      const fromInput = (() => {
        const r = Array.isArray(idkitResponse?.responses)
          ? idkitResponse.responses[0]
          : null
        if (!r) return null
        const stuple = Array.isArray((r as Record<string, unknown>).session_nullifier)
          ? ((r as Record<string, unknown>).session_nullifier as unknown[])
          : null
        return (
          (stuple?.[0] as string | undefined) ??
          ((r as Record<string, unknown>).nullifier as string | undefined) ??
          null
        )
      })()
      return NextResponse.json({
        success: true,
        nullifier_hash: nullifier ?? fromInput,
      })
    }

    const err = (data && typeof data === 'object'
      ? data
      : { detail: String(data) }) as Record<string, unknown>
    const results = Array.isArray(err.results) ? err.results : []
    const first = results[0] as Record<string, unknown> | undefined

    return NextResponse.json(
      {
        success: false,
        worldcoin_status: response.status,
        error: err,
        detail: first?.detail ?? err.detail ?? null,
        code: first?.code ?? err.code ?? null,
      },
      { status: 400 },
    )
  } catch (e) {
    console.error('[verify] exception', e)
    return NextResponse.json({ success: false, detail: String(e) }, { status: 500 })
  }
}
