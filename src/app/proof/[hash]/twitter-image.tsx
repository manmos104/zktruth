import { ImageResponse } from 'next/og'
import fs from 'node:fs'
import path from 'node:path'
import { resolveCaptureMedia } from '@/lib/mediaResolver'

/**
 * Twitter/X + OG card for /proof/<hash>.
 *
 * Two visual modes, picked by whether a capture exists in Blob:
 *
 *   CAPTURE MODE (a photo/video mint exists):
 *     Full-bleed capture image on the top 570px + a 60px black strip
 *     at the bottom carrying "SHA-256 · <short-hash> · ON-CHAIN".
 *     Layout is deliberately simple (flex column, no position:absolute)
 *     because previous Satori attempts with fancier overlays 500'd
 *     in production.
 *
 *   BRANDED FALLBACK (no capture on Blob):
 *     The original wordmark + tagline + hash-strip design so a share
 *     link never renders blank.
 *
 * Any Satori error inside CAPTURE MODE falls through to the branded
 * fallback rather than returning a 500 — keeps the endpoint reliable.
 */

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

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

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), 8000)
    const res = await fetch(url, { signal: c.signal, cache: 'no-store' })
    clearTimeout(t)
    if (!res.ok) return null
    let ct = res.headers.get('content-type') || ''
    if (!/^image\//i.test(ct)) {
      if (/\.png(\?|$)/i.test(url)) ct = 'image/png'
      else if (/\.webp(\?|$)/i.test(url)) ct = 'image/webp'
      else ct = 'image/jpeg'
    }
    const ab = await res.arrayBuffer()
    if (ab.byteLength > 8 * 1024 * 1024) return null
    return `data:${ct};base64,${Buffer.from(ab).toString('base64')}`
  } catch {
    return null
  }
}

export default async function TwitterImage(
  { params }: { params: Promise<{ hash: string }> | { hash: string } },
) {
  const p = await Promise.resolve(params) as { hash?: string }
  const hash = (p?.hash ?? '').toLowerCase()
  const shortHash = hash.length >= 18
    ? `${hash.slice(0, 10)}…${hash.slice(-8)}`
    : hash

  // Resolve + fetch the capture as a data URL (Satori's remote-URL
  // path is flaky on Blob; pre-fetching avoids the failure mode we
  // hit repeatedly during task #27).
  let captureDataUrl: string | null = null
  try {
    const m = await resolveCaptureMedia(hash)
    if (m.imageUrl) captureDataUrl = await fetchAsDataUrl(m.imageUrl)
  } catch { /* fall through to branded */ }

  const fonts = [
    ...(syneMedium.length ? [{ name: 'Syne', data: syneMedium, weight: 500 as const, style: 'normal' as const }] : []),
    ...(syneBold.length ? [{ name: 'Syne', data: syneBold, weight: 700 as const, style: 'normal' as const }] : []),
  ]

  if (captureDataUrl) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: '#000',
            fontFamily: 'Syne',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={captureDataUrl}
            alt="Capture"
            width={1200}
            height={570}
            style={{ width: 1200, height: 570, display: 'flex' }}
          />
          <div
            style={{
              width: 1200,
              height: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 18,
              background: '#000',
              color: '#e0e0e0',
              fontFamily: 'monospace',
              fontSize: 18,
              letterSpacing: 4,
            }}
          >
            <span style={{ color: '#00c864' }}>●</span>
            <span>SHA-256</span>
            <span style={{ color: 'rgba(255,255,255,0.35)' }}>·</span>
            <span style={{ color: '#00c8ff' }}>{shortHash}</span>
            <span style={{ color: 'rgba(255,255,255,0.35)' }}>·</span>
            <span>ON-CHAIN</span>
          </div>
        </div>
      ),
      { ...size, fonts },
    )
  }

  // ---- Branded fallback (no capture on Blob) ----
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#faf9f5',
          fontFamily: 'Syne',
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 96, height: 1, background: 'rgba(0,0,0,0.18)' }} />
          <div style={{ fontSize: 36, fontWeight: 700, color: '#111', letterSpacing: 8, fontFamily: 'Syne' }}>
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
          <span>ON-CHAIN</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
