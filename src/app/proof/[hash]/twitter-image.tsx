import { ImageResponse } from 'next/og'
import fs from 'node:fs'
import path from 'node:path'
import { resolveCaptureMedia } from '@/lib/mediaResolver'

/**
 * Twitter/X + iMessage/Facebook/Discord OG card for /proof/<hash>.
 *
 * Task #27: the card now shows the ACTUAL CAPTURED image on the left,
 * with a branded panel on the right carrying the zkTruth wordmark,
 * "Proof of Capture" tagline, short hash, and the VERIFIED · TON CHAIN
 * pill. If the hash has no media on Blob (free post, or a pre-Phase 5
 * legacy record), the whole card falls back to the previous wordmark-
 * only design so a share link never renders blank.
 *
 * Layout is 1200×630 (Twitter's summary_large_image spec). The
 * capture square sits at 630×630 flush-left; the branded panel fills
 * the remaining 570×630 on the right.
 *
 * The capture is fetched SERVER-SIDE and inlined as a data URL rather
 * than passed to Satori as a remote URL — Satori's remote-fetch path
 * has been flaky in production (returns 500 on Blob URLs) so
 * pre-fetching is the reliable path.
 */

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// ---- Static asset preload (data URLs so Satori can inline) --------------

function safeReadFile(p: string): Buffer {
  try { return fs.readFileSync(p) } catch { return Buffer.alloc(0) }
}

const logoDataUrl: string = (() => {
  const buf = safeReadFile(path.join(process.cwd(), 'public', 'zktruth-logo-green.png'))
  return buf.length ? `data:image/png;base64,${buf.toString('base64')}` : ''
})()

const fontsDir = path.join(process.cwd(), 'public', 'fonts')
const syneMedium = safeReadFile(path.join(fontsDir, 'Syne-Medium.ttf'))
const syneBold = safeReadFile(path.join(fontsDir, 'Syne-Bold.ttf'))

/**
 * Fetch a remote image and return it as a data URL. Bounded by a
 * 5-second timeout and a 6 MB size cap so a slow / huge asset can't
 * hang the OG image render (which itself has a Vercel Function
 * timeout).
 */
async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    clearTimeout(timer)
    if (!res.ok) {
      console.warn('[og] capture fetch not ok', res.status, url)
      return null
    }
    // Derive content-type from URL extension if the header is missing
    // or vague (Vercel Blob occasionally returns application/octet-stream
    // for freshly uploaded blobs before the CDN reconciles).
    let ct = res.headers.get('content-type') || ''
    if (!/^image\//i.test(ct)) {
      if (/\.png(\?|$)/i.test(url)) ct = 'image/png'
      else if (/\.webp(\?|$)/i.test(url)) ct = 'image/webp'
      else ct = 'image/jpeg'
    }
    const ab = await res.arrayBuffer()
    if (ab.byteLength > 6 * 1024 * 1024) {
      console.warn('[og] capture too large', ab.byteLength, url)
      return null
    }
    const b64 = Buffer.from(ab).toString('base64')
    return `data:${ct};base64,${b64}`
  } catch (err) {
    console.warn('[og] fetch failed', err instanceof Error ? err.message : String(err), url)
    return null
  }
}

// ---- Component ----------------------------------------------------------

export default async function TwitterImage(
  { params }: { params: Promise<{ hash: string }> | { hash: string } },
) {
  // Next.js 15 delivers image-route params as a Promise; older
  // versions passed a plain object. Await Promise.resolve() so
  // both shapes flow through the same code path.
  const p = await Promise.resolve(params) as { hash?: string }
  const rawHash = p?.hash ?? ''
  const hash = rawHash.toLowerCase()
  const shortHash = hash.length >= 18
    ? `${hash.slice(0, 10)}…${hash.slice(-8)}`
    : hash

  // Resolve the Blob URL for the capture then pull the actual bytes
  // so Satori has them as a data URL. Both steps are best-effort —
  // any failure falls through to the wordmark-only design.
  let captureDataUrl: string | null = null
  try {
    const m = await resolveCaptureMedia(hash)
    if (m.imageUrl) {
      captureDataUrl = await fetchAsDataUrl(m.imageUrl)
      if (!captureDataUrl) {
        console.warn('[og] resolved imageUrl but fetch failed', hash, m.imageUrl)
      }
    } else {
      console.warn('[og] no imageUrl resolved for', hash)
    }
  } catch (err) {
    console.warn('[og] resolveCaptureMedia threw', err instanceof Error ? err.message : String(err))
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#faf9f5',
          fontFamily: 'Syne',
        }}
      >
        {captureDataUrl ? (
          <>
            {/* LEFT — actual capture, 630×630 square flush-left. */}
            <div
              style={{
                width: 630,
                height: 630,
                display: 'flex',
                position: 'relative',
                background: '#000',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={captureDataUrl}
                alt="Capture"
                width={630}
                height={630}
                style={{
                  width: 630,
                  height: 630,
                  objectFit: 'cover',
                  display: 'flex',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 20,
                  left: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  background: 'rgba(0,0,0,0.68)',
                  borderRadius: 999,
                  color: '#fff',
                  fontSize: 14,
                  letterSpacing: 3,
                  fontWeight: 500,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 8, background: '#00c864' }} />
                PROOF · TON
              </div>
            </div>
            {/* RIGHT — branded panel, 570×630. */}
            <div
              style={{
                width: 570,
                height: 630,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '56px 48px',
              }}
            >
              <div style={{ display: 'flex' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 18px',
                    border: '1px solid rgba(0,0,0,0.14)',
                    borderRadius: 999,
                    color: '#111',
                    fontSize: 13,
                    letterSpacing: 3,
                    fontWeight: 500,
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: 8, background: '#00c864' }} />
                  VERIFIED · TON CHAIN
                </div>
              </div>
              {logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoDataUrl}
                  alt="zkTruth"
                  width={430}
                  height={175}
                  style={{ width: 430, height: 175, display: 'flex' }}
                />
              ) : (
                <div style={{ fontSize: 72, fontWeight: 800, color: '#111', display: 'flex' }}>zkTruth</div>
              )}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ width: 72, height: 1, background: 'rgba(0,0,0,0.18)' }} />
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    color: '#111',
                    letterSpacing: 6,
                  }}
                >
                  Proof of Capture
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    letterSpacing: 3,
                    color: 'rgba(0,0,0,0.5)',
                  }}
                >
                  SHA-256 · {shortHash}
                </div>
              </div>
            </div>
          </>
        ) : (
          // ---- FALLBACK LAYOUT (no capture URL available) ----
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '40px 64px',
            }}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 18px',
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 999,
                  color: '#111',
                  fontSize: 14,
                  letterSpacing: 3,
                  fontWeight: 500,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 8, background: '#00c864' }} />
                VERIFIED · TON CHAIN
              </div>
            </div>
            {logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoDataUrl}
                alt="zkTruth"
                width={860}
                height={349}
                style={{ width: 860, height: 349, display: 'flex' }}
              />
            ) : (
              <div style={{ fontSize: 120, color: '#000', fontWeight: 800, display: 'flex' }}>zkTruth</div>
            )}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div style={{ width: 96, height: 1, background: 'rgba(0,0,0,0.18)' }} />
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: '#111',
                  letterSpacing: 8,
                }}
              >
                Proof of Capture
              </div>
            </div>
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 16,
                color: 'rgba(0,0,0,0.45)',
                fontSize: 13,
                letterSpacing: 3,
                fontFamily: 'monospace',
              }}
            >
              <span>SHA-256</span>
              <span>·</span>
              <span>{shortHash}</span>
              <span>·</span>
              <span>ZKP VERIFIED</span>
            </div>
          </div>
        )}
      </div>
    ),
    {
      ...size,
      fonts: [
        ...(syneMedium.length ? [{ name: 'Syne', data: syneMedium, weight: 500 as const, style: 'normal' as const }] : []),
        ...(syneBold.length ? [{ name: 'Syne', data: syneBold, weight: 700 as const, style: 'normal' as const }] : []),
      ],
    }
  )
}
