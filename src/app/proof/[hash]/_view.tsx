import { headers } from 'next/headers'
import { getProofByHash, type ProofRecord } from '@/lib/proofStore'
import { resolveCaptureMedia, type ResolvedCaptureMedia } from '@/lib/mediaResolver'

/**
 * Shared render for the proof page. Extracted from `page.tsx` so both
 * the public entry (which redirects humans to the Telegram channel via
 * a bot-User-Agent check) and the /verify subroute (which always shows
 * the full verification UI) can reuse identical markup.
 *
 * The `_` prefix on this filename is what keeps Next.js App Router from
 * treating it as its own route.
 */

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
  media: ResolvedCaptureMedia
  verified: boolean
  reason?: string
}

async function loadProof(hash: string): Promise<ProofApiResponse> {
  const empty: ProofApiResponse = {
    hash,
    proof: null,
    onchain: null,
    media: { hasMedia: false },
    verified: false,
  }
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    empty.reason = 'invalid hash format'
    return empty
  }
  const [proof, media] = await Promise.all([
    getProofByHash(hash).catch(() => null),
    resolveCaptureMedia(hash).catch(() => ({ hasMedia: false } as ResolvedCaptureMedia)),
  ])

  let onchain: OnchainInfo | null = null
  let verified = false
  let reason: string | undefined
  try {
    const h = await headers()
    const proto = h.get('x-forwarded-proto') ?? 'https'
    const host = h.get('host') ?? 'zktruth.vercel.app'
    const res = await fetch(`${proto}://${host}/api/proof/${hash}`, {
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
  return { hash, proof, onchain, media, verified, reason }
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="proof-field">
      <span className="proof-field-key">{label}</span>
      <span className="proof-field-value">{children}</span>
    </div>
  )
}

export async function ProofView({ hash: rawHash }: { hash: string }) {
  const hash = rawHash.toLowerCase()
  const data = await loadProof(hash)
  const { proof, onchain, media, verified } = data

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

  const posterUrl = media.posterUrl ?? media.imageUrl
    ?? onchain?.imageUrl ?? proof?.posterUrl ?? proof?.mediaUrl
  const videoUrl = media.animationUrl ?? onchain?.animationUrl ?? proof?.mediaUrl

  const tgLink = proof?.telegramPostUrl
  const walletAddr = onchain?.ownerAddress ?? proof?.wallet

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className={`proof-page state-${state}`}>
        <header className="proof-brand">
          {/* Speech-bubble + green check icon lives in /public and is
              the collection avatar too — reusing keeps the brand mark
              one file to keep in sync. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/zktruth-avatar-512.png"
            alt="zkTruth"
            width={44}
            height={44}
            className="proof-brand-icon"
          />
          <div className="proof-brand-wordmark">
            <span className="proof-brand-zk">zk</span>
            <span className="proof-brand-truth">Truth</span>
          </div>
          <a className="proof-brand-verify" href="/">Verify · TON</a>
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

        <section className="proof-about">
          <div className="proof-about-title">About <span>zkTruth</span></div>
          <div className="proof-about-lead">
            A community-owned proof-of-capture network. Every photo and
            video is hashed the moment it&apos;s shot, anchored on TON, and
            published to a public Telegram channel — turning ordinary
            phones into an anti-fake-news distribution layer.
          </div>
          <ul className="proof-about-list">
            <li>
              <span className="proof-about-tag">Authenticity</span>
              SHA-256 of the raw sensor frame is written to a TEP-62 NFT
              on TON mainnet. Any pixel edit changes the hash — mismatch
              = tampering.
            </li>
            <li>
              <span className="proof-about-tag">Anti fake-news</span>
              Timestamp and GPS are captured on-device and signed against
              a Telegram-verified identity, so a rehosted or backdated
              image can&apos;t pass as a fresh eyewitness capture.
            </li>
            <li>
              <span className="proof-about-tag">Decentralised reporting</span>
              Anyone with a phone can publish to the channel; no central
              editor decides what counts as news. Feed integrity comes
              from the chain, not from a masthead.
            </li>
            <li>
              <span className="proof-about-tag">Incentives</span>
              Every mint funnels 85% of its fee into a weekly reward pool
              paid to the Top 100 authors. Trust Score rewards mints,
              reactions, and posts — quality reporting pays.
            </li>
          </ul>
          <div className="proof-about-cta-row">
            <a className="proof-cta" href="https://t.me/zktruth_channel" target="_blank" rel="noopener noreferrer">
              Join the zkTruth Channel ↗
            </a>
            <a className="proof-cta secondary" href="https://t.me/zktruth_bot" target="_blank" rel="noopener noreferrer">
              Launch Mini App ↗
            </a>
          </div>
        </section>

        <footer className="proof-footer">
          <div className="proof-footer-chain">
            <span className="proof-footer-dot" />
            POWERED BY TON
          </div>
        </footer>
      </div>
    </>
  )
}

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #f6f7fb; }
.proof-page {
  min-height: 100vh;
  background: #f6f7fb;
  background-image:
    radial-gradient(ellipse 60% 40% at 15% 0%, rgba(0,200,100,0.06) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 100% 100%, rgba(60,120,255,0.06) 0%, transparent 60%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 20px 40px;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: #0d1224;
  position: relative;
}
/* Subtle grid mesh for a "technical" undertone */
.proof-page::before {
  content: '';
  position: fixed; inset: 0;
  background-image:
    linear-gradient(rgba(13,18,36,0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(13,18,36,0.035) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(circle at 50% 20%, #000 0%, transparent 70%);
  -webkit-mask-image: radial-gradient(circle at 50% 20%, #000 0%, transparent 70%);
  pointer-events: none;
}
.proof-page > * { position: relative; z-index: 1; }
/* ---- Brand header (icon + wordmark + verify chip) ---- */
.proof-brand {
  width: 100%; max-width: 460px;
  display: flex; align-items: center; gap: 12px;
  padding: 4px 4px 20px;
}
.proof-brand-icon {
  width: 44px; height: 44px;
  border-radius: 12px; background: #fff;
  border: 1px solid rgba(13,18,36,0.06);
  box-shadow: 0 4px 14px rgba(13,18,36,0.05);
}
.proof-brand-wordmark {
  flex: 1;
  /* Official wordmark uses Syne Italic Bold — pull the weight up to
     match the /public/zktruth-logo-green.png lockup exactly. */
  font-family: 'Syne', sans-serif; font-style: italic;
  font-size: 22px; letter-spacing: -0.6px;
  font-weight: 800;
  color: #0d1224;
}
/* Same solid black for both halves — the earlier translucent "zk"
   read as washed-out next to the crisp "Truth". */
.proof-brand-zk { font-weight: 800; color: #0d1224; }
.proof-brand-truth { font-weight: 800; color: #0d1224; }
.proof-brand-verify {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px; font-weight: 600;
  letter-spacing: 1.5px; text-transform: uppercase;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(13,18,36,0.10);
  color: rgba(13,18,36,0.65);
  text-decoration: none;
  transition: all 0.15s;
}
.proof-brand-verify:hover { background: #0d1224; color: #fff; border-color: #0d1224; }

/* ---- Status hero ---- */
.proof-status-icon {
  width: 64px; height: 64px; border-radius: 20px;
  display: flex; align-items: center; justify-content: center;
  margin: 16px 0 14px;
  background: #fff;
  box-shadow: 0 8px 32px rgba(13,18,36,0.06);
  border: 1px solid rgba(13,18,36,0.05);
}
.proof-status-icon svg { width: 30px; height: 30px; }
.proof-status-icon.status-verified { border-color: #10b981; box-shadow: 0 8px 32px rgba(16,185,129,0.18); }
.proof-status-icon.status-pending { border-color: #f59e0b; box-shadow: 0 8px 32px rgba(245,158,11,0.18); }
.proof-status-icon.status-notFound { border-color: #ef4444; box-shadow: 0 8px 32px rgba(239,68,68,0.18); }
.proof-status-icon.status-verified svg path { stroke: #10b981; }
.proof-status-icon.status-pending svg { stroke: #f59e0b; }
.proof-status-icon.status-notFound svg { stroke: #ef4444; }

.proof-status-title {
  /* Modern geometric sans instead of the Syne italic — Syne is
     reserved for the brand wordmark up top so the status headline
     doesn't compete with it visually. Inter 800 with tight tracking
     reads as crisp and technical. */
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-weight: 800; font-style: normal;
  font-size: 26px; letter-spacing: -0.8px;
  color: #0d1224;
  margin-bottom: 4px; text-align: center;
}
.proof-status-sub {
  font-size: 12px; color: rgba(13,18,36,0.55);
  letter-spacing: 0.3px; margin-bottom: 24px;
  text-align: center; font-weight: 500;
}

/* ---- Media tile ---- */
.proof-media {
  width: 100%; max-width: 460px; margin: 0 0 16px;
  border-radius: 20px; overflow: hidden;
  border: 1px solid rgba(13,18,36,0.06);
  background: #fff;
  box-shadow: 0 12px 40px rgba(13,18,36,0.06);
}
.proof-media img, .proof-media video {
  display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: cover;
}

/* ---- Data card ---- */
.proof-card {
  width: 100%; max-width: 460px;
  background: #fff;
  border: 1px solid rgba(13,18,36,0.06);
  border-radius: 20px; overflow: hidden;
  box-shadow: 0 12px 40px rgba(13,18,36,0.06);
}
.proof-section {
  padding: 16px 20px 10px; font-size: 10px; font-weight: 700;
  color: rgba(13,18,36,0.4); letter-spacing: 1.8px; text-transform: uppercase;
  font-family: 'JetBrains Mono', monospace;
}
.proof-field {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 12px 20px; border-top: 1px solid rgba(13,18,36,0.05);
  gap: 12px;
}
.proof-field-key {
  font-size: 11px; color: rgba(13,18,36,0.5); font-weight: 500;
  letter-spacing: 0.3px; flex-shrink: 0; min-width: 74px;
}
.proof-field-value {
  font-size: 13px; color: #0d1224; text-align: right;
  word-break: break-all; line-height: 1.55; font-weight: 500;
}
.proof-field-value .mono { font-family: 'JetBrains Mono', monospace; font-weight: 500; }
.proof-field-value .cyan { color: #2563eb; }
.proof-field-value .green { color: #10b981; font-weight: 700; }
.proof-field-value .loc { color: #7c3aed; }
.proof-field-value .dim { color: rgba(13,18,36,0.4); }
.proof-field-value .link {
  color: #2563eb; text-decoration: none;
  border-bottom: 1px solid rgba(37,99,235,0.35);
}
.proof-field-value .link:hover { border-bottom-color: #2563eb; }

.proof-hash-full {
  padding: 16px 20px; border-top: 1px solid rgba(13,18,36,0.05);
}
.proof-hash-label {
  font-size: 10px; color: rgba(13,18,36,0.4); font-weight: 700;
  letter-spacing: 1.8px; text-transform: uppercase; margin-bottom: 8px;
  font-family: 'JetBrains Mono', monospace;
}
.proof-hash-value {
  font-size: 11px; color: #0d1224; word-break: break-all; line-height: 1.7;
  background: #f6f7fb;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(13,18,36,0.05);
  font-family: 'JetBrains Mono', monospace; font-weight: 500;
}
.proof-empty-note {
  padding: 16px 20px 20px; color: rgba(13,18,36,0.65);
  font-size: 13px; line-height: 1.55;
}

/* ---- CTAs ---- */
.proof-actions {
  display: flex; flex-direction: column; gap: 8px;
  width: 100%; max-width: 460px; margin-top: 12px;
}
.proof-cta {
  display: flex; align-items: center; justify-content: center;
  height: 48px; border-radius: 14px; text-decoration: none;
  background: #0d1224; color: #fff;
  border: 1px solid #0d1224;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px; font-weight: 600; letter-spacing: 0.2px;
  transition: all 0.15s;
}
.proof-cta.secondary {
  background: #fff; color: #0d1224;
  border: 1px solid rgba(13,18,36,0.10);
}
.proof-cta:hover { background: #1e2540; }
.proof-cta.secondary:hover { background: #f6f7fb; border-color: rgba(13,18,36,0.2); }

/* ---- Footer ---- */
.proof-footer {
  text-align: center; margin-top: 22px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.proof-footer-chain {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px; color: rgba(13,18,36,0.4); font-weight: 600;
  letter-spacing: 1.8px; display: flex; align-items: center; gap: 6px;
}
.proof-footer-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #10b981; box-shadow: 0 0 8px rgba(16,185,129,0.5);
}

/* ---- About zkTruth section ---- */
.proof-about {
  width: 100%; max-width: 460px; margin-top: 20px;
  padding: 24px 22px 22px;
  border-radius: 20px;
  background: #fff;
  border: 1px solid rgba(13,18,36,0.06);
  box-shadow: 0 12px 40px rgba(13,18,36,0.06);
}
.proof-about-title {
  font-family: 'Syne', sans-serif; font-weight: 800;
  font-size: 18px; color: #0d1224; letter-spacing: -0.3px;
  margin-bottom: 6px;
}
.proof-about-title span {
  background: linear-gradient(90deg, #10b981 0%, #2563eb 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
}
.proof-about-lead {
  font-size: 13px; line-height: 1.6; color: rgba(13,18,36,0.72);
  margin-bottom: 16px;
}
.proof-about-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 14px;
}
.proof-about-list li {
  font-size: 12.5px; line-height: 1.55; color: rgba(13,18,36,0.68);
}
.proof-about-tag {
  display: inline-block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px; font-weight: 700; letter-spacing: 1.4px;
  text-transform: uppercase;
  color: #10b981;
  background: rgba(16,185,129,0.08);
  border: 1px solid rgba(16,185,129,0.28);
  padding: 3px 8px; border-radius: 999px; margin-right: 8px;
  vertical-align: 1px;
}
.proof-about-list li:nth-child(2) .proof-about-tag {
  color: #2563eb; background: rgba(37,99,235,0.08); border-color: rgba(37,99,235,0.28);
}
.proof-about-list li:nth-child(3) .proof-about-tag {
  color: #7c3aed; background: rgba(124,58,237,0.08); border-color: rgba(124,58,237,0.28);
}
.proof-about-list li:nth-child(4) .proof-about-tag {
  color: #f59e0b; background: rgba(245,158,11,0.10); border-color: rgba(245,158,11,0.32);
}
.proof-about-cta-row {
  display: flex; flex-direction: column; gap: 8px; margin-top: 18px;
}
`
