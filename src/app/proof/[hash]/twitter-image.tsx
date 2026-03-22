import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function TwitterImage({ params }: { params: { hash: string } }) {
  const hash = params.hash || '0x0000'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #080818 0%, #0a1628 40%, #0d0d1a 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(0,255,135,0.12)',
              border: '2px solid #00ff87',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              color: '#00ff87',
            }}
          >
            ✓
          </div>
          <div
            style={{
              fontSize: '48px',
              fontWeight: 800,
              fontStyle: 'italic',
              color: '#ffffff',
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>zk</span>
            <span>Truth</span>
          </div>
        </div>

        <div
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#00ff87',
            marginBottom: '16px',
          }}
        >
          Verified Proof of Capture
        </div>

        <div
          style={{
            fontSize: '16px',
            color: '#00c8ff',
            opacity: 0.8,
          }}
        >
          SHA-256: {hash}...
        </div>

        <div
          style={{
            display: 'flex',
            gap: '24px',
            marginTop: '32px',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '2px',
          }}
        >
          <span>WORLD CHAIN</span>
          <span>•</span>
          <span>WORLD ID :: ZKP</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
