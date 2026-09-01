'use client'

/**
 * TrustBadge — US-Army-inspired rank insignia rendered as inline SVG,
 * one design per Trust tier. Uses the same journalism-themed ladder
 * as the rest of the app (Source → Truth-Teller), but replaces the
 * plain emoji with a metallic medal so the profile modal + sidebar
 * chip read as an earned decoration rather than a text tag.
 *
 * All five badges share the same 100×100 viewBox so callers can drop
 * them into any container by setting the `size` prop. Every design
 * ramps up in complexity as the tier climbs:
 *
 *   1  Source              — bronze disc, single central mark
 *   2  Whistleblower       — steel shield + single chevron + 1 star
 *   3  Muckraker           — gold shield + laurel + 2 stars
 *   4  Investigative       — bronze shield + spread wings + 3 stars
 *   5  Truth-Teller        — gold medal + scales + wreath + 5 stars
 */

import type { CSSProperties } from 'react'

export type TrustTier =
  | 'Source'
  | 'Whistleblower'
  | 'Muckraker'
  | 'Investigative Reporter'
  | 'Truth-Teller'

interface TrustBadgeProps {
  tier: TrustTier
  size?: number
  className?: string
  style?: CSSProperties
}

// Shared metallic gradients used across every badge. Defined once at
// the SVG defs level so the badges look consistent side-by-side.
function BadgeDefs() {
  return (
    <defs>
      <radialGradient id="tb-bronze" cx="50%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#e6a675" />
        <stop offset="55%" stopColor="#9a5a2c" />
        <stop offset="100%" stopColor="#4b2a12" />
      </radialGradient>
      <radialGradient id="tb-steel" cx="50%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#e6f4ff" />
        <stop offset="55%" stopColor="#7fb7d9" />
        <stop offset="100%" stopColor="#1e3b52" />
      </radialGradient>
      <radialGradient id="tb-gold" cx="50%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#fff4c2" />
        <stop offset="45%" stopColor="#f4b41a" />
        <stop offset="100%" stopColor="#7a4a08" />
      </radialGradient>
      <radialGradient id="tb-copper" cx="50%" cy="35%" r="75%">
        <stop offset="0%" stopColor="#ffd0a1" />
        <stop offset="55%" stopColor="#c56528" />
        <stop offset="100%" stopColor="#3d1908" />
      </radialGradient>
      <radialGradient id="tb-emerald" cx="50%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#a7ffd8" />
        <stop offset="45%" stopColor="#1fbf67" />
        <stop offset="100%" stopColor="#053a20" />
      </radialGradient>
      <linearGradient id="tb-ring" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
        <stop offset="50%" stopColor="#ffffff" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
      </linearGradient>
      <filter id="tb-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodOpacity="0.55" />
      </filter>
    </defs>
  )
}

// Small 5-pointed star at (cx, cy) with the given radius. Used for
// rank ornaments on the higher tiers.
function Star({ cx, cy, r, fill = '#fff' }: { cx: number; cy: number; r: number; fill?: string }) {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? r : r * 0.42
    pts.push(`${cx + Math.cos(angle) * rad},${cy + Math.sin(angle) * rad}`)
  }
  return <polygon points={pts.join(' ')} fill={fill} />
}

// Laurel-branch half — used mirrored on both sides of gold-and-above tiers.
function LaurelBranch({ side, tint = '#ffe58a' }: { side: 'left' | 'right'; tint?: string }) {
  const flip = side === 'right' ? 'scale(-1 1) translate(-100 0)' : ''
  return (
    <g transform={flip} opacity={0.85}>
      <path d="M20 80 Q14 55 22 30" stroke={tint} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {[70, 60, 50, 40].map((y, i) => (
        <ellipse
          key={y}
          cx={17 - i * 0.4}
          cy={y}
          rx="4"
          ry="2.4"
          fill={tint}
          transform={`rotate(${-30 - i * 4} ${17 - i * 0.4} ${y})`}
        />
      ))}
    </g>
  )
}

// ---- Individual badge bodies ---------------------------------------------

function SourceBadge() {
  // Simple bronze disc with a candle mark centered — the lowest rank
  // reads as basic-issue, no ornaments earned yet.
  return (
    <g filter="url(#tb-shadow)">
      <circle cx="50" cy="50" r="40" fill="url(#tb-bronze)" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="url(#tb-ring)" strokeWidth="3" />
      <circle cx="50" cy="50" r="34" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="1" />
      {/* Candle flame + wick */}
      <path d="M50 32 C 46 38 46 42 50 46 C 54 42 54 38 50 32 Z" fill="#ffe28c" />
      <rect x="47" y="46" width="6" height="20" rx="1" fill="#f2e4c8" />
      <rect x="45" y="66" width="10" height="3" rx="1" fill="#6b3d17" />
    </g>
  )
}

function WhistleblowerBadge() {
  // Steel shield + chevron + 1 star above.
  return (
    <g filter="url(#tb-shadow)">
      <path d="M50 8 L86 22 L86 55 Q86 78 50 92 Q14 78 14 55 L14 22 Z" fill="url(#tb-steel)" />
      <path d="M50 8 L86 22 L86 55 Q86 78 50 92 Q14 78 14 55 L14 22 Z" fill="none" stroke="url(#tb-ring)" strokeWidth="2.5" />
      <Star cx={50} cy={26} r={7} fill="#fff" />
      {/* Chevron */}
      <path d="M28 62 L50 46 L72 62 L64 62 L50 52 L36 62 Z" fill="#fff" opacity="0.95" />
      <path d="M28 74 L50 58 L72 74 L64 74 L50 64 L36 74 Z" fill="#fff" opacity="0.7" />
    </g>
  )
}

function MuckrakerBadge() {
  // Gold shield + laurel + 2 stars + central torch (muckraking light).
  return (
    <g filter="url(#tb-shadow)">
      <path d="M50 6 L88 22 L88 56 Q88 80 50 94 Q12 80 12 56 L12 22 Z" fill="url(#tb-gold)" />
      <path d="M50 6 L88 22 L88 56 Q88 80 50 94 Q12 80 12 56 L12 22 Z" fill="none" stroke="url(#tb-ring)" strokeWidth="2.5" />
      <LaurelBranch side="left" tint="#8a5a0f" />
      <LaurelBranch side="right" tint="#8a5a0f" />
      <Star cx={38} cy={26} r={6} fill="#fff" />
      <Star cx={62} cy={26} r={6} fill="#fff" />
      {/* Torch handle + flame */}
      <rect x="46" y="52" width="8" height="28" rx="2" fill="#5b3308" />
      <path d="M50 40 C 42 46 42 54 50 58 C 58 54 58 46 50 40 Z" fill="#fff2b0" />
      <path d="M50 44 C 45 48 45 54 50 56 C 55 54 55 48 50 44 Z" fill="#ff9a1f" />
    </g>
  )
}

function InvestigativeReporterBadge() {
  // Copper eagle-wing spread + magnifier center + 3 stars in an arc.
  return (
    <g filter="url(#tb-shadow)">
      {/* Wings — two elongated ellipses arced outward from the shield */}
      <g fill="url(#tb-copper)" opacity="0.9">
        <path d="M14 44 Q4 52 14 62 L28 60 Q26 50 22 46 Z" />
        <path d="M22 40 Q10 42 12 52 L26 54 Q28 46 30 42 Z" />
        <path d="M86 44 Q96 52 86 62 L72 60 Q74 50 78 46 Z" />
        <path d="M78 40 Q90 42 88 52 L74 54 Q72 46 70 42 Z" />
      </g>
      {/* Central shield */}
      <path d="M50 12 L78 24 L78 52 Q78 74 50 88 Q22 74 22 52 L22 24 Z" fill="url(#tb-copper)" />
      <path d="M50 12 L78 24 L78 52 Q78 74 50 88 Q22 74 22 52 L22 24 Z" fill="none" stroke="url(#tb-ring)" strokeWidth="2.2" />
      <Star cx={50} cy={22} r={6} fill="#fff" />
      <Star cx={34} cy={30} r={4.5} fill="#fff" />
      <Star cx={66} cy={30} r={4.5} fill="#fff" />
      {/* Magnifier */}
      <circle cx="50" cy="56" r="12" fill="none" stroke="#fff" strokeWidth="3" />
      <line x1="58" y1="64" x2="70" y2="78" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <line x1="58" y1="64" x2="70" y2="78" stroke="#5a2a0a" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  )
}

function TruthTellerBadge() {
  // Full circular gold-emerald medal + laurel wreath + scales + 5 stars.
  return (
    <g filter="url(#tb-shadow)">
      {/* Outer ring */}
      <circle cx="50" cy="50" r="46" fill="url(#tb-gold)" />
      <circle cx="50" cy="50" r="46" fill="none" stroke="url(#tb-ring)" strokeWidth="3" />
      {/* Inner disc */}
      <circle cx="50" cy="50" r="34" fill="url(#tb-emerald)" />
      <circle cx="50" cy="50" r="34" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="1" />
      {/* Full laurel wreath along the ring */}
      <LaurelBranch side="left" tint="#fff2a8" />
      <LaurelBranch side="right" tint="#fff2a8" />
      {/* 5 stars arced across the top */}
      {[
        { cx: 28, cy: 22, r: 4 },
        { cx: 39, cy: 15, r: 5 },
        { cx: 50, cy: 12, r: 6 },
        { cx: 61, cy: 15, r: 5 },
        { cx: 72, cy: 22, r: 4 },
      ].map((s, i) => (
        <Star key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#fff" />
      ))}
      {/* Scales of justice — vertical column + horizontal beam + two pans */}
      <rect x="49" y="36" width="2" height="30" fill="#fff" />
      <rect x="34" y="46" width="32" height="1.6" fill="#fff" />
      <path d="M30 48 Q34 60 38 48 Z" fill="#fff" opacity="0.9" />
      <path d="M62 48 Q66 60 70 48 Z" fill="#fff" opacity="0.9" />
      <circle cx="50" cy="34" r="2.5" fill="#fff" />
    </g>
  )
}

// ---- Public component ----------------------------------------------------

export function TrustBadge({ tier, size = 64, className, style }: TrustBadgeProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`${tier} badge`}
    >
      <BadgeDefs />
      {tier === 'Source' && <SourceBadge />}
      {tier === 'Whistleblower' && <WhistleblowerBadge />}
      {tier === 'Muckraker' && <MuckrakerBadge />}
      {tier === 'Investigative Reporter' && <InvestigativeReporterBadge />}
      {tier === 'Truth-Teller' && <TruthTellerBadge />}
    </svg>
  )
}
