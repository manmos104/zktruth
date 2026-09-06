import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { TrustBadge, type TrustTier } from '../src/app/TrustBadge'
import { writeFileSync } from 'node:fs'

const tiers: TrustTier[] = ['Source','Whistleblower','Muckraker','Investigative Reporter','Truth-Teller']
const cards = tiers.map(t => {
  const svg = renderToStaticMarkup(React.createElement(TrustBadge, { tier: t, size: 200 }))
  return `<div class="card"><div class="badge">${svg}</div><div class="label">${t}</div></div>`
}).join('\n')
const html = `<!doctype html><html><head><meta charset="utf-8"><title>zkTruth Badge Preview</title>
<style>
  body{margin:0;background:#0a0a0a;color:#fff;font-family:-apple-system,system-ui,sans-serif;padding:32px}
  h1{font-size:20px;letter-spacing:2px;margin:0 0 24px;color:#ccc;text-transform:uppercase}
  .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:20px}
  .card{background:#141418;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:22px 14px;text-align:center}
  .badge{filter:drop-shadow(0 4px 12px rgba(0,0,0,0.6))}
  .label{margin-top:12px;font-size:12px;letter-spacing:1.2px;color:#e0e0e0;font-weight:700;text-transform:uppercase}
  @media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}
</style></head><body>
<h1>Trust Tier Badges — Preview</h1>
<div class="grid">${cards}</div>
</body></html>`
writeFileSync('/sessions/elegant-eager-ptolemy/mnt/outputs/trust-badge-preview.html', html)
console.log('wrote preview')
