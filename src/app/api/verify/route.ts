import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

/**
 * /api/verify — Worldcoin verify proxy.
 *
 * The app `zkTruth Verify` (app_1e1334283f3c12386ee55c5617ff5972) is
 * registered as World ID 4.0 / Managed. The legacy v2 verify endpoint
 * (developer.worldcoin.org/api/v2/verify/...) returns "Action not found"
 * for 4.0-registered actions, so we must hit the new v4 endpoint:
 *
 *   POST https://developer.world.org/api/v4/verify/{app_id}
 *
 * v4 still accepts our existing IDKit v2 proofs by wrapping them in the
 * legacy "Uniqueness proof (protocol 3.0)" request shape:
 *
 *   { protocol_version: '3.0',
 *     nonce,
 *     action,
 *     environment,
 *     responses: [{ identifier, merkle_root, nullifier, proof }] }
 *
 * Managed mode means Worldcoin signs RP requests server-side, so we don't
 * need a signer key in env vars — we just relay the proof.
 */

const APP_ID = process.env.WORLD_APP_ID || 'app_1e1334283f3c12386ee55c5617ff5972'
const ACTION = process.env.WORLD_ACTION || 'capture-proof'
const VERIFY_URL = `https://developer.world.org/api/v4/verify/${APP_ID}`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { proof, nullifier_hash, merkle_root, verification_level } = body

    // IDKit v2 returns 'device' or 'orb' for verification_level.
    // The v4 endpoint's legacy `identifier` field expects the same strings.
    const identifier = verification_level === 'orb' ? 'orb' : 'device'

    // v4 endpoint requires a per-request nonce even for legacy proofs.
    // It's a 32-byte hex used only to deduplicate replayed requests.
    const nonce = '0x' + randomBytes(32).toString('hex')

    const payload = {
      protocol_version: '3.0' as const,
      nonce,
      action: ACTION,
      environment: 'production' as const,
      responses: [
        {
          identifier,
          merkle_root,
          nullifier: nullifier_hash,
          proof,
          // signal_hash omitted — the v4 schema defaults it to the hash of
          // an empty string, which matches what World App computed because
          // we don't pass a `signal` to IDKitWidget.
        },
      ],
    }

    console.log('[verify] outgoing v4 legacy proof', {
      app_id: APP_ID,
      action: ACTION,
      identifier,
      nullifier_hash,
    })

    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const raw = await response.text()
    let data: unknown
    try { data = JSON.parse(raw) } catch { data = raw }

    console.log('[verify] worldcoin v4 response', response.status, data)

    if (response.ok) {
      return NextResponse.json({ success: true, nullifier_hash })
    }

    // v4 error shape: { success: false, code, detail, results? }
    const err = (data && typeof data === 'object'
      ? data
      : { detail: String(data) }) as Record<string, unknown>

    // results[0] often has the most specific error for legacy proofs.
    const first = Array.isArray(err.results) && err.results.length > 0
      ? (err.results[0] as Record<string, unknown>)
      : null

    return NextResponse.json(
      {
        success: false,
        worldcoin_status: response.status,
        error: err,
        detail: first?.detail ?? err.detail ?? null,
        code: first?.code ?? err.code ?? null,
        attribute: err.attribute ?? null,
      },
      { status: 400 },
    )
  } catch (e) {
    console.error('[verify] exception', e)
    return NextResponse.json({ success: false, detail: String(e) }, { status: 500 })
  }
}
