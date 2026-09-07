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
 * The layout is 1200×630 (Twitter's summary_large_image spec). The
 * capture square sits at 630×630 flush-left; the branded panel fills
 * the remaining 570×630 on the right.
 */

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
// Regenerate the card periodically as media / on-chain state changes.
export const revalidate = 60

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

// ---- Component ----------------------------------------------------------

export default async function TwitterImage(
  { params }: { params: Promise<{ hash: string }> | { hash: string } },
) {
  // Next.js 15 delivers params as a Promise. Older shape kept as a
  // fallback so the type stays permissive.
  const resolved = await Promise.resolve(params as { hash: string })
  const rawHash = resolved?.hash ?? ''
  const hash = rawHash.toLowerCase()
  const shortHash = hash.length >= 18
    ? `${hash.slice(0, 10)}…${hash.slice(-8)}`
    : hash

  // Try to attach the actual capture. `resolveCaptureMedia` returns
  // the Blob public URL — Satori can fetch that at render time. When
  // both video and still are present (video mint), the still is used
  // as the card visual because Satori can't render <video>.
  let captureUrl: string | undefined
  try {
    const m = await resolveCaptureMedia(hash)
    captureUrl = m.imageUrl // .jpg poster, primary tile candidate
  } catch { /* fall through to wordmark-only card */ }

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
        {captureUrl ? (
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
                src={captureUrl}
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
              {/* Bottom-left pill on the capture: "PROOF" */}
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
              {/* Top spacer / verified pill */}
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
              {/* Wordmark logo */}
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
              {/* Tagline + short hash */}
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
          // Reuses the original wordmark-centric card so a share URL
          // without media (free post / stale hash) still looks polished.
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
