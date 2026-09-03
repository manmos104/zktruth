import {
  createHash,
  createHmac,
  createPrivateKey,
  generateKeyPairSync,
  sign as edSign,
} from 'node:crypto'

/**
 * Attestation library — the "raise the bar" defense layer that
 * accompanies every capture. Each function here answers ONE question
 * about a mint:
 *
 *   1. verifyTelegramInitData()   → Is the caller a real Telegram user?
 *   2. signC2paClaim()            → Emit a server-signed provenance
 *                                    claim JSON that anyone can verify.
 *   3. detectAnomalies()          → Do the GPS coords + IP geolocation
 *                                    + timestamp cross-check without
 *                                    obvious spoofing signals?
 *
 * NOTE on scope. A Telegram Mini App runs in a WebView, so we can NOT
 * reach into the phone's Secure Enclave / TrustZone directly — no true
 * TEE-signed capture pipeline is possible. What we CAN do is stack
 * evidence: initData (Telegram-signed identity) + Passkey (WebAuthn
 * hardware-key signature over the content hash, handled elsewhere) +
 * this file's server-signed claim + anomaly heuristics. Together
 * these make casual spoofing meaningfully hard without falsely
 * claiming crypto-hardware-attested capture.
 */

// ---------- 1. Telegram initData verification ----------------------------
//
// Telegram signs its `initData` payload with an HMAC-SHA-256 derived
// from the bot's token. Docs:
//   https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
// This function trusts the caller only if the signature verifies AND
// the auth_date is recent (defaults to 24h window — matches Telegram's
// own recommendation for interactive sessions).

export interface TelegramInitDataUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
}

export interface TelegramInitDataResult {
  valid: boolean
  reason?: string
  user?: TelegramInitDataUser
  authDate?: number
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 60 * 60 * 24,
): TelegramInitDataResult {
  if (!initData || !botToken) return { valid: false, reason: 'missing_input' }
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return { valid: false, reason: 'missing_hash' }
  params.delete('hash')

  const dataCheck: string[] = []
  const sortedKeys = Array.from(params.keys()).sort()
  for (const k of sortedKeys) {
    dataCheck.push(`${k}=${params.get(k) ?? ''}`)
  }
  const dataCheckString = dataCheck.join('\n')

  // Telegram-specified derivation: HMAC key = HMAC-SHA256(bot_token,
  // key="WebAppData"). Then signature = HMAC-SHA256(dataCheckString,
  // key=<above>).
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  if (computedHash !== hash) return { valid: false, reason: 'signature_mismatch' }

  const authDateRaw = params.get('auth_date')
  const authDate = authDateRaw ? Number(authDateRaw) : NaN
  if (!Number.isFinite(authDate)) return { valid: false, reason: 'missing_auth_date' }
  const ageSec = Math.floor(Date.now() / 1000) - authDate
  if (ageSec > maxAgeSeconds) return { valid: false, reason: 'expired', authDate }

  let user: TelegramInitDataUser | undefined
  const userRaw = params.get('user')
  if (userRaw) {
    try {
      user = JSON.parse(userRaw) as TelegramInitDataUser
    } catch {
      return { valid: false, reason: 'malformed_user' }
    }
  }

  return { valid: true, authDate, user }
}

// ---------- 2. C2PA-style server-signed claim -----------------------------
//
// A tiny, self-contained JSON "content credentials" style claim. We
// hash the capture inputs (content SHA-256, GPS hash, timestamp,
// author wallet, telegram user id, ip) and sign the digest with a
// server-side Ed25519 key. Anyone can re-derive the digest from the
// exposed fields + verify against our published public key, without
// having to trust our database.
//
// Key management: the server private key lives in
//   process.env.ATTEST_SIGNING_KEY   (PEM, PKCS8)
// If the env var is missing we fall back to an ephemeral pair
// generated at boot — good enough for local dev / preview, but
// deployment MUST provide a stable key so historical claims stay
// verifiable.

export interface C2paClaimInput {
  contentHashHex: string
  gpsHashHex?: string
  captureTimestampIso: string
  authorWalletUq: string
  telegramUserId?: number
  captureIp?: string
  extra?: Record<string, string | number | boolean>
}

export interface SignedC2paClaim {
  version: '1'
  digestHex: string       // sha256 of canonical JSON
  signatureB64: string    // base64 of raw signature bytes
  publicKeyPem: string    // for offline verification
  fields: {
    contentHashHex: string
    gpsHashHex: string
    captureTimestampIso: string
    authorWalletUq: string
    telegramUserId: number
    captureIp: string
    extra: Record<string, string | number | boolean>
  }
}

let cachedKey: { privatePem: string; publicPem: string } | null = null
function getSigningKey(): { privatePem: string; publicPem: string } {
  if (cachedKey) return cachedKey
  // Prefer base64-encoded env vars (single-line, no PEM-newline
  // headache when pasting into hosted-secret UIs like Vercel), fall
  // back to raw PEM if the operator opted for that instead.
  const privB64 = process.env.ATTEST_SIGNING_KEY_B64
  const pubB64 = process.env.ATTEST_PUBLIC_KEY_B64
  const provided = process.env.ATTEST_SIGNING_KEY
  const publicProvided = process.env.ATTEST_PUBLIC_KEY
  if (privB64 && pubB64) {
    cachedKey = {
      privatePem: Buffer.from(privB64, 'base64').toString('utf8'),
      publicPem: Buffer.from(pubB64, 'base64').toString('utf8'),
    }
    return cachedKey
  }
  if (provided && publicProvided) {
    cachedKey = { privatePem: provided, publicPem: publicProvided }
    return cachedKey
  }
  // Ephemeral fallback — WARNING: claims signed with this can't be
  // reverified across cold starts.
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  cachedKey = {
    privatePem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicPem: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  }
  return cachedKey
}

function canonicalise(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort()
  const sorted: Record<string, unknown> = {}
  for (const k of keys) sorted[k] = obj[k]
  return JSON.stringify(sorted)
}

export function signC2paClaim(input: C2paClaimInput): SignedC2paClaim {
  const fields = {
    contentHashHex: (input.contentHashHex || '').toLowerCase(),
    gpsHashHex: (input.gpsHashHex || '').toLowerCase(),
    captureTimestampIso: input.captureTimestampIso || '',
    authorWalletUq: input.authorWalletUq || '',
    telegramUserId: input.telegramUserId ?? 0,
    captureIp: input.captureIp || '',
    extra: input.extra || {},
  }
  const canonical = canonicalise(fields as unknown as Record<string, unknown>)
  const digest = createHash('sha256').update(canonical).digest('hex')
  const { privatePem, publicPem } = getSigningKey()
  // Ed25519 signs the raw bytes directly (no hash-then-sign) — pass
  // `null` as the algorithm and the canonical JSON as the payload.
  const key = createPrivateKey(privatePem)
  const signature = edSign(null, Buffer.from(canonical), key)
  return {
    version: '1',
    digestHex: digest,
    signatureB64: signature.toString('base64'),
    publicKeyPem: publicPem,
    fields,
  }
}

// ---------- 3. Anomaly detection -----------------------------------------
//
// Cheap heuristics that don't stop a determined attacker but do
// catch lazy spoofs. Each detected anomaly returns a reason code and
// contributes to a numeric `severity` (0 clean → 100 highly suspect).
// Callers can use severity to either flag the mint publicly or dock
// Trust Score.

export interface AnomalyInput {
  gpsLatLon?: [number, number]     // decimal degrees
  ipGeoLatLon?: [number, number]   // decimal degrees (resolved from request IP)
  captureTimestampIso: string
  serverNowMs?: number
  sensorSnapshot?: {
    accelMagVariance?: number      // 0 = static, phones normally 0.1–3
    gyroMagVariance?: number
  }
}

export interface AnomalyResult {
  severity: number
  reasons: string[]
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const [lat1, lon1] = a
  const [lat2, lon2] = b
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

export function detectAnomalies(input: AnomalyInput): AnomalyResult {
  const reasons: string[] = []
  let severity = 0

  // 1. GPS vs IP geolocation distance
  if (input.gpsLatLon && input.ipGeoLatLon) {
    const distKm = haversineKm(input.gpsLatLon, input.ipGeoLatLon)
    // IP geolocation is coarse (city-level), so allow ~200km of
    // tolerance. Above 1000km is very likely a VPN or a fake GPS.
    if (distKm > 1000) {
      severity += 55
      reasons.push(`gps_ip_distance_${Math.round(distKm)}km`)
    } else if (distKm > 300) {
      severity += 20
      reasons.push(`gps_ip_distance_${Math.round(distKm)}km_soft`)
    }
  }

  // 2. Timestamp sanity — no future dates, no absurdly old.
  const ts = Date.parse(input.captureTimestampIso)
  if (Number.isFinite(ts)) {
    const now = input.serverNowMs ?? Date.now()
    const drift = ts - now
    if (drift > 60_000) {
      severity += 30
      reasons.push(`timestamp_future_${Math.round(drift / 1000)}s`)
    } else if (drift < -60 * 60 * 24 * 30 * 1000) {
      severity += 20
      reasons.push('timestamp_too_old_over_30d')
    }
  } else {
    severity += 10
    reasons.push('timestamp_unparseable')
  }

  // 3. Sensor variance — a perfectly still phone during a "live"
  // capture is suspicious (emulator / mocked stream).
  const snap = input.sensorSnapshot
  if (snap) {
    if (typeof snap.accelMagVariance === 'number' && snap.accelMagVariance < 0.01) {
      severity += 15
      reasons.push('accelerometer_flat')
    }
    if (typeof snap.gyroMagVariance === 'number' && snap.gyroMagVariance < 0.005) {
      severity += 10
      reasons.push('gyroscope_flat')
    }
  }

  if (severity > 100) severity = 100
  return { severity, reasons }
}

// ---------- IP geolocation helper (best-effort, free tier) ---------------
//
// Uses ip-api.com's free endpoint. HTTP-only, ~45 req/min per IP. Good
// enough for background sanity-checking; not a first-line dependency.

export async function ipGeoLatLon(ip: string): Promise<[number, number] | null> {
  if (!ip || ip === '::1' || ip === '127.0.0.1') return null
  try {
    const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,lat,lon`, {
      // Vercel Functions have a 25s default; this call is much faster
      // but bail early so a slow IP-geo doesn't hang the mint tracker.
      signal: AbortSignal.timeout(3000),
    })
    const j = (await r.json()) as { status?: string; lat?: number; lon?: number }
    if (j.status !== 'success' || typeof j.lat !== 'number' || typeof j.lon !== 'number') return null
    return [j.lat, j.lon]
  } catch {
    return null
  }
}
