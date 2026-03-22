'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

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
  top: 0; left: 0; right: 0; bottom: 0;
  background-image:
    radial-gradient(ellipse at 20% 0%, rgba(0,200,255,0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(0,255,135,0.04) 0%, transparent 50%);
  pointer-events: none;
}
.proof-page > * { position: relative; z-index: 1; }

.proof-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
}
.proof-logo svg { width: 32px; height: 32px; }
.proof-logo-text {
  font-family: 'Syne', sans-serif;
  font-style: italic;
  font-size: 24px;
}
.proof-logo-zk { font-weight: 700; color: rgba(255,255,255,0.7); }
.proof-logo-truth { font-weight: 800; color: #fff; }

.proof-verified-icon {
  width: 72px; height: 72px;
  border-radius: 50%;
  background: rgba(0,255,135,0.08);
  border: 2px solid #00ff87;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 0 30px rgba(0,255,135,0.15);
}
.proof-verified-icon svg { width: 32px; height: 32px; }

.proof-status-title {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 20px;
  font-style: italic;
  background: linear-gradient(135deg, #00ff87 0%, #00c8ff 50%, #a78bfa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 6px;
}
.proof-status-sub {
  font-size: 9px;
  color: rgba(0,255,135,0.4);
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 32px;
}

.proof-card {
  width: 100%;
  max-width: 420px;
  background: rgba(0,0,0,0.5);
  border: 1px solid rgba(0,200,255,0.12);
  border-radius: 20px;
  overflow: hidden;
  backdrop-filter: blur(20px);
  box-shadow: 0 4px 40px rgba(0,0,0,0.4);
}

.proof-section {
  padding: 16px 20px 8px;
  font-size: 9px;
  color: rgba(0,200,255,0.5);
  letter-spacing: 2px;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(0,200,255,0.06);
}

.proof-field {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(0,200,255,0.06);
}
.proof-field:last-child { border-bottom: none; }
.proof-field-key {
  font-size: 10px;
  color: rgba(255,255,255,0.35);
  letter-spacing: 1px;
  text-transform: uppercase;
  flex-shrink: 0;
  min-width: 80px;
}
.proof-field-value {
  font-size: 11px;
  color: #fff;
  text-align: right;
  max-width: 260px;
  word-break: break-all;
  line-height: 1.6;
}
.proof-field-value.hash {
  font-size: 10px;
  color: #00c8ff;
}
.proof-field-value.green {
  color: #00ff87;
  font-weight: 700;
}
.proof-field-value.cyan {
  color: #00c8ff;
}
.proof-field-value.location {
  color: #a78bfa;
}

.proof-hash-full {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0,200,255,0.06);
}
.proof-hash-label {
  font-size: 9px;
  color: rgba(0,200,255,0.5);
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.proof-hash-value {
  font-size: 9px;
  color: #00c8ff;
  word-break: break-all;
  line-height: 1.8;
  background: rgba(0,200,255,0.04);
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(0,200,255,0.08);
}

.proof-footer {
  text-align: center;
  margin-top: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.proof-footer-chain {
  font-size: 9px;
  color: rgba(255,255,255,0.25);
  letter-spacing: 1.5px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.proof-footer-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: #00c864;
  box-shadow: 0 0 6px #00c864;
}
.proof-footer-link {
  font-size: 10px;
  color: #00c8ff;
  text-decoration: none;
}
.proof-footer-link:hover { text-decoration: underline; }

.proof-cta {
  width: 100%;
  max-width: 420px;
  margin-top: 20px;
  height: 48px;
  border-radius: 14px;
  border: 1px solid rgba(0,200,255,0.2);
  background: rgba(0,200,255,0.06);
  color: #00c8ff;
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}
.proof-cta:hover {
  background: rgba(0,200,255,0.12);
  border-color: rgba(0,200,255,0.4);
}
`;

function ProofContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  const hashShort = params.hash as string || '0x000000';
  const fullHash = '0x' + hashShort.replace(/^0x/, '').padEnd(64, '0');
  const tParam = searchParams.get('t') || '';
  const location = searchParams.get('l') || '';

  // Convert Unix timestamp to readable format
  let timeDisplay = 'Pending verification';
  if (tParam) {
    try {
      const d = new Date(parseInt(tParam) * 1000);
      timeDisplay = d.toISOString().replace('T', ' ').split('.')[0] + ' UTC';
    } catch {
      timeDisplay = tParam;
    }
  }

  return (
    <>
      <style>{styles}</style>
      <div className="proof-page">
        <div className="proof-logo">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="white"/>
            <path d="m8 9.5 2.5 2.5 5-5" stroke="#00c864"/>
          </svg>
          <div className="proof-logo-text">
            <span className="proof-logo-zk">zk</span><span className="proof-logo-truth">Truth</span>
          </div>
        </div>

        <div className="proof-verified-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#00ff87" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5L20 7"/>
          </svg>
        </div>
        <div className="proof-status-title">Verified Capture</div>
        <div className="proof-status-sub">On-chain proof of authenticity</div>

        <div className="proof-card">
          <div className="proof-section">Capture Details</div>

          <div className="proof-field">
            <span className="proof-field-key">Status</span>
            <span className="proof-field-value green">✓ ZKP VERIFIED</span>
          </div>
          <div className="proof-field">
            <span className="proof-field-key">Chain</span>
            <span className="proof-field-value cyan">World Chain (480)</span>
          </div>
          <div className="proof-field">
            <span className="proof-field-key">Timestamp</span>
            <span className="proof-field-value">{timeDisplay}</span>
          </div>
          {location && (
            <div className="proof-field">
              <span className="proof-field-key">Location</span>
              <span className="proof-field-value location">📍 {location}</span>
            </div>
          )}

          <div className="proof-field">
            <span className="proof-field-key">Identity</span>
            <span className="proof-field-value green">World ID :: ZKP</span>
          </div>
          <div className="proof-field">
            <span className="proof-field-key">Protocol</span>
            <span className="proof-field-value">zkTRUTH v0.1</span>
          </div>

          <div className="proof-hash-full">
            <div className="proof-hash-label">SHA-256 Content Hash</div>
            <div className="proof-hash-value">{fullHash}</div>
          </div>
        </div>

        <button className="proof-cta" onClick={() => window.location.href = '/'}>
          ✦ OPEN zkTRUTH APP
        </button>

        <div className="proof-footer">
          <div className="proof-footer-chain"><div className="proof-footer-dot" />POWERED BY WORLD CHAIN</div>
          <a className="proof-footer-link" href="/">zktruth.xyz</a>
        </div>
      </div>
    </>
  );
}

export default function ProofPage() {
  return (
    <Suspense fallback={<div style={{background:'#080818',minHeight:'100dvh'}} />}>
      <ProofContent />
    </Suspense>
  );
}
