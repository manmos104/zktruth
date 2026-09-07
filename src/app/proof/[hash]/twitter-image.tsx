import { ImageResponse } from 'next/og'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Wordmark-only OG card (1200×630). Rendered by Satori.
 *
 * We tried inlining the actual capture on the left half of the card
 * but Satori repeatedly 500'd on Blob JPEG data URLs / remote fetches
 * (see task #27 debugging thread). The reliable substitute: send the
 * actual capture through `openGraph.images` in the page's metadata,
 * pointing directly at the Blob URL — SNS scrapers pick THAT up as
 * the card visual and never call this endpoint. This endpoint is now
 * a stable fallback for hashes with no media on file.
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

export default async function TwitterImage(
  { params }: { params: Promise<{ hash: string }> | { hash: string } },
) {
  const p = await Promise.resolve(params) as { hash?: string }
  const hash = (p?.hash ?? '').toLowerCase()
  const shortHash = hash.length >= 18
    ? `${hash.slice(0, 10)}…${hash.slice(-8)}`
    : hash

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
    {
      ...size,
      fonts: [
        ...(syneMedium.length ? [{ name: 'Syne', data: syneMedium, weight: 500 as const, style: 'normal' as const }] : []),
        ...(syneBold.length ? [{ name: 'Syne', data: syneBold, weight: 700 as const, style: 'normal' as const }] : []),
      ],
    }
  )
}
