import { NextRequest, NextResponse } from 'next/server'

const APP_ID = 'app_29bbb24bbdc571dc7814a6c088347576'
const ACTION = 'capture-proof'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { proof, nullifier_hash, merkle_root, verification_level, signal } = body

    const payload = {
      nullifier_hash,
      merkle_root,
      proof,
      verification_level,
      action: ACTION,
      signal: signal ?? '',
    }

    console.log('[verify] outgoing', {
      app_id: APP_ID,
      action: ACTION,
      verification_level,
      signal_len: (signal ?? '').length,
      nullifier_hash,
    })

    const response = await fetch(
      `https://developer.worldcoin.org/api/v2/verify/${APP_ID}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    const raw = await response.text()
    let data: unknown
    try { data = JSON.parse(raw) } catch { data = raw }

    console.log('[verify] worldcoin response', response.status, data)

    if (response.ok) {
      return NextResponse.json({ success: true, nullifier_hash })
    }

    // Worldcoin v2 verify error shape: { code, detail, attribute }
    // Surface the raw response so the client can show a useful message.
    const err = (data && typeof data === 'object' ? data : { detail: String(data) }) as Record<string, unknown>
    return NextResponse.json(
      {
        success: false,
        worldcoin_status: response.status,
        error: err,
        // Flatten common fields so the client can read them directly.
        detail: err.detail ?? err.error_description ?? null,
        code: err.code ?? err.error ?? null,
        attribute: err.attribute ?? null,
      },
      { status: 400 },
    )
  } catch (e) {
    console.error('[verify] exception', e)
    return NextResponse.json({ success: false, detail: String(e) }, { status: 500 })
  }
}
