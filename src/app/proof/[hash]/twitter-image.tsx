import { ImageResponse } from 'next/og'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Embed the official brand logo (green-check variant) as a data URL. The
// source file is the high-res 1422×1334 PNG that was hand-designed for the
// brand — no font-substitution, no icon trace approximation.
const logoDataUrl: string = (() => {
  try {
    const p = path.join(process.cwd(), 'public', 'zktruth-logo-green.png')
    return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`
  } catch {
    return ''
  }
})()

// Syne TTFs for the metadata typography (header/footer chrome only — the
// hero is the rasterised brand lockup so it always matches the source).
const fontsDir = path.join(process.cwd(), 'public', 'fonts')
const safeRead = (f: string): Buffer => {
  try { return fs.readFileSync(path.join(fontsDir, f)) } catch { return Buffer.alloc(0) }
}
const syneMedium = safeRead('Syne-Medium.ttf')
const syneBold = safeRead('Syne-Bold.ttf')

export default function TwitterImage({
  params,
}: {
  params: { hash: string }
}) {
  const hash = params?.hash ?? '0x0000'
  const shortHash = `${hash.slice(0, 10)}…${hash.slice(-8)}`

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
        {/* Top: small VERIFIED · WORLD CHAIN pill, right-aligned. */}
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
              fontFamily: 'Syne',
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 8, background: '#00c864' }} />
            VERIFIED · WORLD CHAIN
          </div>
        </div>

        {/* Hero: the official brand lockup, sized to leave clear room for
            the tagline & footer rows below. Source PNG is pre-cropped
            (1100×446) so dimensions here map 1:1 with the visible logo.
            Satori needs the dimensions in `style` as well as the HTML
            attributes or it collapses the <img>. */}
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
          <div style={{ fontSize: 120, color: '#000', fontWeight: 800 }}>zkTruth</div>
        )}

        {/* Tagline — uses the same Syne family as the brand wordmark for
            typographic continuity. */}
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
              fontFamily: 'Syne',
            }}
          >
            Proof of Capture
          </div>
        </div>

        {/* Footer: minimal monospaced metadata row. */}
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
