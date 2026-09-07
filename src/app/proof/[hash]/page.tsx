import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getProofByHash, type ProofRecord } from '@/lib/proofStore'

/**
 * Phase 5 rewrite — /proof/<hash>
 *
 * A public, chain-anchored proof page. The old build was a client-only
 * component that trusted URL query strings for the timestamp / location
 * and rendered "Verified" for any hash. That's obviously not a proof.
 *
 * The new build server-renders from two independent sources:
 *   1. `proofStore` — what the client wrote at mint time (fast KV hit).
 *   2. tonapi.io    — what the collection contract shows RIGHT NOW.
 *
 * When (2) confirms an Item exists for this hash, we render a real
 * "✓ On-chain" badge with the Item address, a tonviewer link and a
 * Getgems marketplace link. When only (1) is present the page shows
 * "Pending confirmation" — the mint tx is still propagating.
 * When neither exists we return a 404-style "Not found" page.
 *
 * We use Next's SERVER component pattern here so:
 *   - SSR gives OG scrapers (Twitter, Telegram) real content to preview.
 *   - The API round-trip stays inside the same Vercel Function invocation.
 *   - Client JS is minimal (just the SVGs + CSS).
 */

export const revalidate = 15

interface OnchainInfo {
  itemAddress?: string
  itemIndex?: number
  ownerAddress?: string
  imageUrl?: string
  animationUrl?: string
  marketplaceUrl?: string
  tonviewerUrl?: string
}

interface ProofApiResponse {
  hash: string
  proof: ProofRecord | null
  onchain: OnchainInfo | null
  verified: boolean
  reason?: string
}

async function loadProof(hash: string): Promise<ProofApiResponse> {
  // Read from the same code path the public API uses, but without the
  // extra HTTP hop — this file runs inside Node on Vercel so we can
  // just import the KV helper directly. The on-chain cross-check goes
  // through the same tonapi call the API uses.
  const empty: ProofApiResponse = {
    hash,
    proof: null,
    onchain: null,
    verified: false,
  }
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    empty.reason = 'invalid hash format'
    return empty
  }
  const proof = await getProofByHash(hash).catch(() => null)

  // Reuse the /api/proof route for tonapi cross-check to avoid
  // duplicating the scan logic. We call it as an INTERNAL request; the
  // host is derived from the request headers so it works on preview
  // deployments too.
  let onchain: OnchainInfo | null = null
  let verified = false
  let reason: string | undefined
  try {
    const h = await headers()
    const proto = h.get('x-forwarded-proto') ?? 'https'
    const host = h.get('host') ?? 'zktruth.vercel.app'
    const res = await fetch(`${proto}://${host}/api/proof/${hash}`, {
      // Short revalidation matches the API's own cache header — we
      // don't want the SSR page to lag behind the client-side re-fetch.
      next: { revalidate: 15 },
    })
    if (res.ok) {
      const j = (await res.json()) as ProofApiResponse
      onchain = j.onchain
      verified = j.verified
      reason = j.reason
    }
  } catch (err) {
    console.warn('[proof-page] on-chain lookup failed', err)
  }
  return { hash, proof, onchain, verified, reason }
}

export async function generateMetadata(
  { params }: { params: Promise<{ hash: string }> },
): Promise<Metadata> {
  const { hash: raw } = await params
  const hash = raw.toLowerCase()
  const short = hash.length >= 10 ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : hash
  return {
    title: `zkTruth Proof #${short}`,
    description: `On-chain, tamper-evident proof of capture — SHA-256 anchored on TON.`,
  }
}

function shortAddr(addr?: string): string {
  if (!addr) return '—'
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`
}

function fmtDate(sec?: number): string {
  if (!sec || !Number.isFinite(sec)) return '—'
  try {
    return new Date(sec * 1000).toISOString().replace('T', ' ').split('.')[0] + ' UTC'
  } catch {
    return '—'
  }
}

export default async function ProofPage(
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash: raw } = await params
  const hash = raw.toLowerCase()
  const data = await loadProof(hash)
  const { proof, onchain, verified } = data

  // Build the display state. Three tiers: verified (on-chain), pending
  // (client claim only), notFound (nothing).
  const state: 'verified' | 'pending' | 'notFound' =
    verified ? 'verified'
    : proof ? 'pending'
    : 'notFound'

  const statusTitle =
    state === 'verified' ? 'On-Chain Proof Confirmed'
    : state === 'pending' ? 'Pending Chain Confirmation'
    : 'Proof Not Found'
  const statusSub =
    state === 'verified' ? 'Anchored on TON mainnet · TEP-62 NFT'
    : state === 'pending' ? 'Mint recorded — indexer is catching up'
    : 'No mint record and no on-chain item for this hash'

  const posterUrl = onchain?.imageUrl ?? proof?.posterUrl ?? proof?.mediaUrl
  const videoUrl = onchain?.animationUrl ?? proof?.mediaUrl

  const tgLink = proof?.telegramPostUrl
  const walletAddr = onchain?.ownerAddress ?? proof?.wallet

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className={`proof-page state-${state}`}>
        <header className="proof-logo">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="white"/>
            <path d="m8 9.5 2.5 2.5 5-5" stroke="#00c864"/>
          </svg>
          <div className="proof-logo-text">
            <span className="proof-logo-zk">zk</span><span className="proof-logo-truth">Truth</span>
          </div>
        </header>

        <div className={`proof-status-icon status-${state}`}>
          {state === 'verified' && (
            <svg viewBox="0 0 24 24" fill="none" stroke="#00ff87" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 5 5L20 7"/>
            </svg>
          )}
          {state === 'pending' && (
            <svg viewBox="0 0 24 24" fill="none" stroke="#ffcf5c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 7v5l3 2"/>
            </svg>
          )}
          {state === 'notFound' && (
            <svg viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <path d="M8 8l8 8M16 8l-8 8"/>
            </svg>
          )}
        </div>
        <h1 className="proof-status-title">{statusTitle}</h1>
        <div className="proof-status-sub">{statusSub}</div>

        {state !== 'notFound' && (
          <>
            {(videoUrl || posterUrl) && (
              <figure className="proof-media">
                {videoUrl && /\.(mp4|webm|mov)$/i.test(videoUrl) ? (
                  <video src={videoUrl} poster={posterUrl}
                    controls playsInline preload="metadata" />
                ) : posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={posterUrl} alt="Capture" />
                ) : null}
              </figure>
            )}

            <div className="proof-card">
              <div className="proof-section">Capture</div>
              <Row label="Captured">{fmtDate(proof?.captureTimestampSec)}</Row>
              <Row label="GPS">{proof?.gpsHashDec && proof.gpsHashDec !== '0'
                ? <span className="loc">🔒 attested</span>
                : <span className="mono dim">opted out</span>}</Row>
              <Row label="Chain">
                <span className="cyan">TON mainnet</span>
              </Row>
              <Row label="Standard">
                <span className="mono">TEP-62 NFT</span>
              </Row>

              <div className="proof-section">Anchor</div>
              <Row label="Wallet">
                {walletAddr
                  ? <a className="mono link" href={`https://tonviewer.com/${walletAddr}`} target="_blank" rel="noopener noreferrer">{shortAddr(walletAddr)}</a>
                  : '—'}
              </Row>
              <Row label="NFT Item">
                {onchain?.itemAddress
                  ? <a className="mono link" href={onchain.tonviewerUrl} target="_blank" rel="noopener noreferrer">{shortAddr(onchain.itemAddress)}</a>
                  : <span className="dim">pending</span>}
              </Row>
              <Row label="Item #">
                {typeof onchain?.itemIndex === 'number'
                  ? <span className="mono">{onchain.itemIndex}</span>
                  : <span className="dim">—</span>}
              </Row>
              {tgLink && (
                <Row label="Channel">
                  <a className="link" href={tgLink} target="_blank" rel="noopener noreferrer">
                    Telegram post ↗
                  </a>
                </Row>
              )}

              <div className="proof-hash-full">
                <div className="proof-hash-label">SHA-256 Content Hash</div>
                <div className="proof-hash-value">{hash}</div>
              </div>
            </div>

            <div className="proof-actions">
              {onchain?.marketplaceUrl && (
                <a className="proof-cta" href={onchain.marketplaceUrl} target="_blank" rel="noopener noreferrer">
                  View on Getgems ↗
                </a>
              )}
              {onchain?.tonviewerUrl && (
                <a className="proof-cta secondary" href={onchain.tonviewerUrl} target="_blank" rel="noopener noreferrer">
                  Inspect on Tonviewer ↗
                </a>
              )}
            </div>
          </>
        )}

        {state === 'notFound' && (
          <div className="proof-card">
            <div className="proof-hash-full">
              <div className="proof-hash-label">SHA-256 Content Hash</div>
              <div className="proof-hash-value">{hash}</div>
            </div>
            <div className="proof-empty-note">
              This hash has no matching NFT in the zkTruth collection and no
              mint record on our side. If you just minted, the on-chain
              indexer may need up to a minute to catch up — refresh soon.
            </div>
          </div>
        )}

        <footer className="proof-footer">
          <div className="proof-footer-chain">
            <span className="proof-footer-dot" />
            POWERED BY TON
          </div>
          <a className="proof-footer-link" href="https://t.me/zktruth_bot">
            Launch the zkTruth Mini App ↗
          </a>
        </footer>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="proof-field">
      <span className="proof-field-key">{label}</span>
      <span className="proof-field-value">{children}</span>
    </div>
  )
}

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #000; }
.proof-page {
  min-height: 100dvh;
  background: linear-gradient(160deg, #080818 0%, #0a1628 40%, #0d0d1a 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px 40px;
  font-family: 'Space Mono', monospace;
  color: #fff;
  position: relative;
}
.proof-page::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    radial-gradient(ellipse at 20% 0%, rgba(0,200,255,0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(0,255,135,0.04) 0%, transparent 50%);
  pointer-events: none;
}
.proof-page > * { position: relative; z-index: 1; }
.proof-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
.proof-logo svg { width: 32px; height: 32px; }
.proof-logo-text { font-family: 'Syne', sans-serif; font-style: italic; font-size: 24px; }
.proof-logo-zk { font-weight: 700; color: rgba(255,255,255,0.7); }
.proof-logo-truth { font-weight: 800; color: #fff; }
.proof-status-icon {
  width: 72px; height: 72px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px;
}
.proof-status-icon svg { width: 32px; height: 32px; }
.proof-status-icon.status-verified { background: rgba(0,255,135,0.08); border: 2px solid #00ff87; box-shadow: 0 0 30px rgba(0,255,135,0.18); }
.proof-status-icon.status-pending { background: rgba(255,207,92,0.08); border: 2px solid #ffcf5c; box-shadow: 0 0 30px rgba(255,207,92,0.15); }
.proof-status-icon.status-notFound { background: rgba(255,107,107,0.08); border: 2px solid #ff6b6b; box-shadow: 0 0 30px rgba(255,107,107,0.15); }
.proof-status-title {
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 20px; font-style: italic;
  background: linear-gradient(135deg, #00ff87 0%, #00c8ff 50%, #a78bfa 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
  margin-bottom: 6px; text-align: center;
}
.state-pending .proof-status-title {
  background: linear-gradient(135deg, #ffcf5c 0%, #ffb15c 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
}
.state-notFound .proof-status-title {
  background: linear-gradient(135deg, #ff8b8b 0%, #ff6b6b 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
}
.proof-status-sub {
  font-size: 9px; color: rgba(255,255,255,0.35);
  letter-spacing: 2px; text-transform: uppercase; margin-bottom: 28px;
  text-align: center;
}
.proof-media {
  width: 100%; max-width: 420px; margin: 0 0 20px;
  border-radius: 20px; overflow: hidden;
  border: 1px solid rgba(0,200,255,0.12);
  background: #000;
}
.proof-media img, .proof-media video {
  display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: cover;
}
.proof-card {
  width: 100%; max-width: 420px;
  background: rgba(0,0,0,0.5);
  border: 1px solid rgba(0,200,255,0.12);
  border-radius: 20px; overflow: hidden;
  backdrop-filter: blur(20px);
  box-shadow: 0 4px 40px rgba(0,0,0,0.4);
}
.proof-section {
  padding: 16px 20px 8px; font-size: 9px;
  color: rgba(0,200,255,0.55); letter-spacing: 2px; text-transform: uppercase;
  border-bottom: 1px solid rgba(0,200,255,0.06);
}
.proof-field {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 12px 20px; border-bottom: 1px solid rgba(0,200,255,0.06);
  gap: 12px;
}
.proof-field:last-child { border-bottom: none; }
.proof-field-key {
  font-size: 10px; color: rgba(255,255,255,0.4);
  letter-spacing: 1px; text-transform: uppercase; flex-shrink: 0; min-width: 74px;
}
.proof-field-value {
  font-size: 12px; color: #fff; text-align: right;
  word-break: break-all; line-height: 1.6;
}
.proof-field-value .mono { font-family: 'Space Mono', monospace; }
.proof-field-value .cyan { color: #00c8ff; }
.proof-field-value .green { color: #00ff87; font-weight: 700; }
.proof-field-value .loc { color: #a78bfa; }
.proof-field-value .dim { color: rgba(255,255,255,0.4); }
.proof-field-value .link {
  color: #00c8ff; text-decoration: none; border-bottom: 1px dashed rgba(0,200,255,0.35);
}
.proof-field-value .link:hover { border-bottom-style: solid; }
.proof-hash-full {
  padding: 16px 20px; border-bottom: 1px solid rgba(0,200,255,0.06);
}
.proof-hash-label {
  font-size: 9px; color: rgba(0,200,255,0.55);
  letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;
}
.proof-hash-value {
  font-size: 10px; color: #00c8ff; word-break: break-all; line-height: 1.7;
  background: rgba(0,200,255,0.04); padding: 10px 12px;
  border-radius: 8px; border: 1px solid rgba(0,200,255,0.08);
  font-family: 'Space Mono', monospace;
}
.proof-empty-note {
  padding: 16px 20px 20px; color: rgba(255,255,255,0.65);
  font-size: 12px; line-height: 1.55;
}
.proof-actions {
  display: flex; flex-direction: column; gap: 10px;
  width: 100%; max-width: 420px; margin-top: 20px;
}
.proof-cta {
  display: flex; align-items: center; justify-content: center;
  height: 48px; border-radius: 14px; text-decoration: none;
  border: 1px solid rgba(0,200,255,0.35);
  background: rgba(0,200,255,0.10); color: #00c8ff;
  font-family: 'Space Mono', monospace; font-size: 12px;
  font-weight: 700; letter-spacing: 1px; transition: all 0.15s;
}
.proof-cta.secondary { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.18); color: rgba(255,255,255,0.9); }
.proof-cta:hover { background: rgba(0,200,255,0.18); border-color: rgba(0,200,255,0.55); }
.proof-cta.secondary:hover { background: rgba(255,255,255,0.08); }
.proof-footer {
  text-align: center; margin-top: 28px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.proof-footer-chain {
  font-size: 9px; color: rgba(255,255,255,0.3);
  letter-spacing: 1.5px; display: flex; align-items: center; gap: 6px;
}
.proof-footer-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: #00c864; box-shadow: 0 0 6px #00c864;
}
.proof-footer-link { font-size: 10px; color: #00c8ff; text-decoration: none; }
.proof-footer-link:hover { text-decoration: underline; }
`
