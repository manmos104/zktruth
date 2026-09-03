import { NextResponse } from 'next/server'
import { Address } from '@ton/core'
import {
  detectAnomalies,
  ipGeoLatLon,
  signC2paClaim,
  verifyTelegramInitData,
  type C2paClaimInput,
} from '@/lib/attest'
import { getRedis } from '@/lib/trustStore'

/**
 * POST /api/attest/claim
 *
 * Produces a signed C2PA-style provenance claim for a capture. Called
 * by the Mini App right after upload + before mint. The response
 * bundles a claim JSON we later stamp into the NFT metadata.
 *
 * Body: {
 *   contentHashHex,
 *   gpsHashHex?,
 *   gpsLatLon?: [lat, lon],
 *   captureTimestampIso,
 *   wallet: rawAddr,
 *   initData?: telegram initData for user attribution,
 *   sensorSnapshot?: { accelMagVariance, gyroMagVariance },
 * }
 *
 * Response: {
 *   claim: SignedC2paClaim,
 *   anomaly: { severity, reasons },
 *   attestations: { telegram: boolean }
 * }
 *
 * We ALSO persist the claim into KV keyed by contentHash so the
 * public /api/nft/item/[hash] metadata endpoint can surface it.
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

interface ReqBody {
  contentHashHex: string
  gpsHashHex?: string
  gpsLatLon?: [number, number]
  captureTimestampIso: string
  wallet: string
  initData?: string
  sensorSnapshot?: {
    accelMagVariance?: number
    gyroMagVariance?: number
  }
}

export async function POST(request: Request) {
  let body: ReqBody
  try { body = (await request.json()) as ReqBody } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body?.contentHashHex || !body?.wallet || !body?.captureTimestampIso) {
    return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 })
  }

  const wallet = normaliseWallet(body.wallet)
  const botToken =
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN
  let telegramUserId = 0
  let telegramVerified = false
  if (body.initData && botToken) {
    const tg = verifyTelegramInitData(body.initData, botToken)
    if (tg.valid && tg.user?.id) {
      telegramUserId = tg.user.id
      telegramVerified = true
    }
  }

  // Best-effort IP geolocation for anomaly cross-check.
  const ip =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    ''
  const ipGeo = ip ? await ipGeoLatLon(ip) : null

  const anomaly = detectAnomalies({
    gpsLatLon: body.gpsLatLon,
    ipGeoLatLon: ipGeo || undefined,
    captureTimestampIso: body.captureTimestampIso,
    sensorSnapshot: body.sensorSnapshot,
  })

  const claimInput: C2paClaimInput = {
    contentHashHex: body.contentHashHex,
    gpsHashHex: body.gpsHashHex,
    captureTimestampIso: body.captureTimestampIso,
    authorWalletUq: wallet,
    telegramUserId,
    captureIp: ip.slice(0, 32),
    extra: {
      anomalySeverity: anomaly.severity,
      telegramVerified,
    },
  }
  const claim = signC2paClaim(claimInput)

  // Persist so /api/nft/item/[hash] can surface attestation state
  // even when the mint tx happens on a fresh device / after cold KV.
  try {
    const r = getRedis()
    await r.set(`claim:${body.contentHashHex.toLowerCase()}`, {
      claim,
      anomaly,
      telegramVerified,
      wallet,
      capturedAt: Date.now(),
    })
  } catch { /* KV cold — non-blocking */ }

  return NextResponse.json({
    claim,
    anomaly,
    attestations: { telegram: telegramVerified },
  })
}
