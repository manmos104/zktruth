'use client'

/**
 * TrustBadge — US-Army / Air-Force style rank insignia rendered as
 * inline SVG. Every tier is a full military decoration built from
 * eagle wings, laurel/oak wreaths, star clusters, central shields
 * and ribbon banners. Higher tiers layer in more ornament (wider
 * wings, more stars, richer wreath, denser banner) so promotion
 * reads visually.
 *
 * Journalism ladder → visual concept:
 *   1  Source                — bronze single-chevron with folded wings
 *   2  Whistleblower         — silver spread-wings + 1 star + megaphone shield
 *   3  Muckraker             — gold spread-wings + 2 stars + torch shield + half-laurel
 *   4  Investigative Reporter— gold+copper eagle + 3 stars + magnifier shield + full laurel
 *   5  Truth-Teller          — grand-cross gold eagle + 5-star crown + scales medallion +
 *                              double wreath + banner scroll ("VERITAS")
 *
 * All five badges share a 120×120 viewBox so callers can drop them
 * into any size via the `size` prop.
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

// ---- Shared SVG defs -----------------------------------------------------

function BadgeDefs() {
  return (
    <defs>
      <radialGradient id="tb-bronze" cx="50%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#f0c194" />
        <stop offset="40%" stopColor="#c17a44" />
        <stop offset="80%" stopColor="#7a3f16" />
        <stop offset="100%" stopColor="#3a1b06" />
      </radialGradient>
      <radialGradient id="tb-silver" cx="50%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="35%" stopColor="#d8e4ec" />
        <stop offset="75%" stopColor="#8ea3b0" />
        <stop offset="100%" stopColor="#2e3d47" />
      </radialGradient>
      <radialGradient id="tb-gold" cx="50%" cy="28%" r="80%">
        <stop offset="0%" stopColor="#fff5c2" />
        <stop offset="35%" stopColor="#ffcf3d" />
        <stop offset="75%" stopColor="#b6800f" />
        <stop offset="100%" stopColor="#4a2f03" />
      </radialGradient>
      <radialGradient id="tb-copper" cx="50%" cy="28%" r="80%">
        <stop offset="0%" stopColor="#ffddb0" />
        <stop offset="40%" stopColor="#e8813a" />
        <stop offset="80%" stopColor="#8a3810" />
        <stop offset="100%" stopColor="#2b0d02" />
      </radialGradient>
      <radialGradient id="tb-emerald" cx="50%" cy="28%" r="80%">
        <stop offset="0%" stopColor="#c2ffd9" />
        <stop offset="45%" stopColor="#1cbf6a" />
        <stop offset="100%" stopColor="#053a20" />
      </radialGradient>
      <linearGradient id="tb-shield-red" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ff5966" />
        <stop offset="100%" stopColor="#7a1420" />
      </linearGradient>
      <linearGradient id="tb-shield-blue" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#4a7cff" />
        <stop offset="100%" stopColor="#0a1f5a" />
      </linearGradient>
      <linearGradient id="tb-ribbon-red" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#c9203a" />
        <stop offset="100%" stopColor="#6a0d19" />
      </linearGradient>
      <linearGradient id="tb-ribbon-gold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffcf3d" />
        <stop offset="100%" stopColor="#8a5a08" />
      </linearGradient>
      <linearGradient id="tb-highlight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
        <stop offset="45%" stopColor="#ffffff" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
      </linearGradient>
      <filter id="tb-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.8" stdDeviation="2" floodOpacity="0.6" />
      </filter>
      <filter id="tb-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.4" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  )
}

// ---- Reusable primitives -------------------------------------------------

function Star({ cx, cy, r, fill = '#fff', stroke }: {
  cx: number; cy: number; r: number; fill?: string; stroke?: string
}) {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? r : r * 0.42
    pts.push(`${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad}`)
  }
  return <polygon points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth={stroke ? 0.4 : 0} />
}

// Eagle wing built from a fan of feather-shaped paths. Draws one side
// (`side="left"`) and mirrors for the right. The `spread` controls how
// wide the wings extend, `feathers` how many primaries are shown.
function EagleWing({
  side, cx, cy, spread, feathers, fill = 'url(#tb-gold)',
}: {
  side: 'left' | 'right'
  cx: number
  cy: number
  spread: number
  feathers: number
  fill?: string
}) {
  const dir = side === 'left' ? -1 : 1
  const items = []
  const stepAngle = 80 / feathers
  for (let i = 0; i < feathers; i++) {
    const angle = (-40 + i * stepAngle) * (Math.PI / 180)
    const len = spread * (1 - i * 0.05)
    const tipX = cx + dir * Math.cos(angle) * len
    const tipY = cy + Math.sin(angle) * len * 0.55
    const midX = cx + dir * Math.cos(angle) * (len * 0.55)
    const midY = cy + Math.sin(angle) * (len * 0.55) - 2
    const w = 3.2 + (feathers - i) * 0.15
    items.push(
      <path
        key={i}
        d={`M${cx} ${cy} Q${midX - dir * w} ${midY} ${tipX} ${tipY} Q${midX + dir * w} ${midY + 2} ${cx} ${cy + 1} Z`}
        fill={fill}
        stroke="#000"
        strokeOpacity="0.25"
        strokeWidth="0.35"
      />,
    )
  }
  return <g>{items}</g>
}

// Eagle body/head sitting on top of the wings.
function EagleBody({ cx, cy, scale = 1, fill = 'url(#tb-gold)' }: {
  cx: number; cy: number; scale?: number; fill?: string
}) {
  const s = scale
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      {/* Body */}
      <path
        d="M-6 0 Q-8 -8 -3 -12 Q0 -14 3 -12 Q8 -8 6 0 Q4 4 0 4 Q-4 4 -6 0 Z"
        fill={fill}
        stroke="#000"
        strokeOpacity="0.35"
        strokeWidth="0.5"
      />
      {/* Head */}
      <ellipse cx="0" cy="-14" rx="4" ry="4.5" fill={fill} stroke="#000" strokeOpacity="0.35" strokeWidth="0.5" />
      {/* Beak */}
      <path d="M3.5 -13 L7 -12 L3.5 -11 Z" fill="#f5c400" stroke="#000" strokeOpacity="0.4" strokeWidth="0.3" />
      {/* Eye dot */}
      <circle cx="1.5" cy="-14.5" r="0.7" fill="#000" />
    </g>
  )
}

// Laurel / oak branch — used at the base of every mid+ tier.
function Wreath({ tint = '#ffe58a', full = false }: { tint?: string; full?: boolean }) {
  const branch = (side: 'left' | 'right') => {
    const flip = side === 'right' ? 'scale(-1 1) translate(-120 0)' : ''
    return (
      <g transform={flip} opacity={0.92}>
        <path d="M22 96 Q14 68 18 40" stroke={tint} strokeWidth="2" fill="none" strokeLinecap="round" />
        {[85, 74, 63, 52, 42].map((y, i) => (
          <ellipse
            key={y}
            cx={17 - i * 0.6}
            cy={y}
            rx={5 - i * 0.2}
            ry={2.8}
            fill={tint}
            transform={`rotate(${-32 - i * 4} ${17 - i * 0.6} ${y})`}
            stroke="#5a3a08"
            strokeOpacity="0.4"
            strokeWidth="0.35"
          />
        ))}
        {full && (
          <>
            <path d="M20 40 Q30 26 44 22" stroke={tint} strokeWidth="1.6" fill="none" strokeLinecap="round" />
            {[36, 30, 26].map((r, i) => (
              <ellipse
                key={r}
                cx={20 + i * 8}
                cy={r}
                rx="4"
                ry="2.4"
                fill={tint}
                transform={`rotate(${-70 + i * 12} ${20 + i * 8} ${r})`}
                stroke="#5a3a08"
                strokeOpacity="0.4"
                strokeWidth="0.35"
              />
            ))}
          </>
        )}
      </g>
    )
  }
  return (
    <g>
      {branch('left')}
      {branch('right')}
    </g>
  )
}

// Ribbon banner across the bottom.
function Ribbon({ label, fill = 'url(#tb-ribbon-red)' }: {
  label?: string; fill?: string
}) {
  return (
    <g>
      {/* Tail flourishes */}
      <path d="M18 96 L10 108 L22 104 Z" fill={fill} opacity="0.85" />
      <path d="M102 96 L110 108 L98 104 Z" fill={fill} opacity="0.85" />
      {/* Main scroll body */}
      <path d="M20 96 Q60 108 100 96 L100 104 Q60 116 20 104 Z" fill={fill} />
      <path d="M20 96 Q60 108 100 96 L100 104 Q60 116 20 104 Z"
        fill="url(#tb-highlight)" opacity="0.5" />
      {label && (
        <text
          x="60"
          y="106"
          textAnchor="middle"
          fontFamily="'Georgia', serif"
          fontSize="7"
          fontWeight="700"
          fill="#fff5c2"
          letterSpacing="1.3"
          style={{ textShadow: '0 1px 1px rgba(0,0,0,0.6)' }}
        >
          {label}
        </text>
      )}
    </g>
  )
}

// Central shield with heraldic stripes / chevron.
function Shield({
  x = 45, y = 40, w = 30, h = 40,
  fill = 'url(#tb-shield-blue)',
  stripes = false,
  chevron = false,
}: {
  x?: number; y?: number; w?: number; h?: number
  fill?: string; stripes?: boolean; chevron?: boolean
}) {
  const path = `M${x} ${y} L${x + w} ${y} L${x + w} ${y + h * 0.55} Q${x + w} ${y + h} ${x + w / 2} ${y + h} Q${x} ${y + h} ${x} ${y + h * 0.55} Z`
  return (
    <g>
      <path d={path} fill={fill} stroke="#fff" strokeOpacity="0.7" strokeWidth="0.8" />
      {stripes && (
        <g clipPath={`url(#tb-shield-clip-${x})`}>
          <rect x={x + 2} y={y + 2} width={w - 4} height="5" fill="#fff" />
          <rect x={x + 2} y={y + 10} width={w - 4} height="1.5" fill="#fff" opacity="0.5" />
          <rect x={x + 2} y={y + 14} width={w - 4} height="1.5" fill="#fff" opacity="0.5" />
          <rect x={x + 2} y={y + 18} width={w - 4} height="1.5" fill="#fff" opacity="0.5" />
        </g>
      )}
      <defs>
        <clipPath id={`tb-shield-clip-${x}`}>
          <path d={path} />
        </clipPath>
      </defs>
      {chevron && (
        <path
          d={`M${x + 4} ${y + h * 0.7} L${x + w / 2} ${y + h * 0.4} L${x + w - 4} ${y + h * 0.7} L${x + w - 8} ${y + h * 0.7} L${x + w / 2} ${y + h * 0.52} L${x + 8} ${y + h * 0.7} Z`}
          fill="#fff"
        />
      )}
    </g>
  )
}

// ---- Tier bodies ---------------------------------------------------------

function SourceBadge() {
  // Bronze folded-wings badge — modest entry-level insignia.
  return (
    <g filter="url(#tb-shadow)">
      {/* Small folded wings */}
      <EagleWing side="left"  cx={60} cy={70} spread={22} feathers={5} fill="url(#tb-bronze)" />
      <EagleWing side="right" cx={60} cy={70} spread={22} feathers={5} fill="url(#tb-bronze)" />
      {/* Central circular medal */}
      <circle cx="60" cy="68" r="20" fill="url(#tb-bronze)" />
      <circle cx="60" cy="68" r="20" fill="none" stroke="url(#tb-highlight)" strokeWidth="1.6" />
      <circle cx="60" cy="68" r="15" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="0.8" />
      {/* Single chevron mark */}
      <path d="M50 76 L60 66 L70 76 L64 76 L60 70 L56 76 Z" fill="#fff2c8" />
      <Star cx={60} cy={58} r={3} fill="#fff2c8" />
      <Ribbon fill="url(#tb-ribbon-gold)" />
    </g>
  )
}

function WhistleblowerBadge() {
  // Silver eagle with spread wings + 1 rank star + blue shield.
  return (
    <g filter="url(#tb-shadow)">
      <EagleWing side="left"  cx={60} cy={55} spread={42} feathers={7} fill="url(#tb-silver)" />
      <EagleWing side="right" cx={60} cy={55} spread={42} feathers={7} fill="url(#tb-silver)" />
      <EagleBody cx={60} cy={55} scale={1.1} fill="url(#tb-silver)" />
      {/* Central shield with stripes */}
      <Shield x={48} y={62} w={24} h={30} fill="url(#tb-shield-blue)" stripes />
      {/* 1 rank star above the eagle */}
      <Star cx={60} cy={22} r={5} fill="url(#tb-silver)" stroke="#000" />
      <Ribbon label="I" fill="url(#tb-ribbon-red)" />
    </g>
  )
}

function MuckrakerBadge() {
  // Gold eagle spread wings + red shield + torch + 2 stars + half-wreath.
  return (
    <g filter="url(#tb-shadow)">
      {/* Half laurel wreath at base */}
      <Wreath tint="#8a5a0f" />
      <EagleWing side="left"  cx={60} cy={52} spread={48} feathers={8} fill="url(#tb-gold)" />
      <EagleWing side="right" cx={60} cy={52} spread={48} feathers={8} fill="url(#tb-gold)" />
      <EagleBody cx={60} cy={52} scale={1.2} fill="url(#tb-gold)" />
      {/* Red shield with torch */}
      <Shield x={46} y={58} w={28} h={34} fill="url(#tb-shield-red)" stripes />
      {/* Torch */}
      <rect x="58" y="70" width="4" height="16" rx="1" fill="#4a2408" />
      <path d="M60 62 C54 66 54 72 60 74 C66 72 66 66 60 62 Z" fill="#fff5c2" />
      <path d="M60 65 C56 68 56 72 60 73 C64 72 64 68 60 65 Z" fill="#ff9a1f" />
      {/* 2 rank stars above */}
      <Star cx={48} cy={22} r={5} fill="url(#tb-gold)" stroke="#000" />
      <Star cx={72} cy={22} r={5} fill="url(#tb-gold)" stroke="#000" />
      <Ribbon label="II" fill="url(#tb-ribbon-red)" />
    </g>
  )
}

function InvestigativeReporterBadge() {
  // Copper+gold eagle with full spread + full laurel + 3 stars + magnifier shield.
  return (
    <g filter="url(#tb-shadow)">
      <Wreath tint="#f4b41a" />
      <EagleWing side="left"  cx={60} cy={50} spread={54} feathers={9} fill="url(#tb-copper)" />
      <EagleWing side="right" cx={60} cy={50} spread={54} feathers={9} fill="url(#tb-copper)" />
      <EagleBody cx={60} cy={50} scale={1.3} fill="url(#tb-gold)" />
      {/* Central shield with globe/magnifier */}
      <Shield x={44} y={54} w={32} h={38} fill="url(#tb-shield-blue)" stripes />
      {/* Magnifying glass */}
      <circle cx="60" cy="72" r="10" fill="none" stroke="#fff" strokeWidth="2.4" />
      <circle cx="60" cy="72" r="7"  fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="1" />
      <line x1="67" y1="79" x2="76" y2="88" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <line x1="67" y1="79" x2="76" y2="88" stroke="#5a2a0a" strokeWidth="1.4" strokeLinecap="round" />
      {/* 3 rank stars in arc */}
      <Star cx={40} cy={22} r={5} fill="url(#tb-gold)" stroke="#000" />
      <Star cx={60} cy={16} r={6} fill="url(#tb-gold)" stroke="#000" />
      <Star cx={80} cy={22} r={5} fill="url(#tb-gold)" stroke="#000" />
      <Ribbon label="III" fill="url(#tb-ribbon-red)" />
    </g>
  )
}

function TruthTellerBadge() {
  // Grand-cross ceremonial: full gold eagle + double wreath + 5-star crown +
  // central seal with scales + banner "VERITAS".
  return (
    <g filter="url(#tb-shadow)">
      {/* Double wreath (full oak+laurel) */}
      <Wreath tint="#fff2a8" full />
      {/* Grand eagle */}
      <EagleWing side="left"  cx={60} cy={52} spread={58} feathers={10} fill="url(#tb-gold)" />
      <EagleWing side="right" cx={60} cy={52} spread={58} feathers={10} fill="url(#tb-gold)" />
      {/* Additional secondary wing layer for depth */}
      <EagleWing side="left"  cx={60} cy={58} spread={40} feathers={6} fill="url(#tb-copper)" />
      <EagleWing side="right" cx={60} cy={58} spread={40} feathers={6} fill="url(#tb-copper)" />
      <EagleBody cx={60} cy={50} scale={1.4} fill="url(#tb-gold)" />
      {/* Central circular seal — gold ring + emerald face */}
      <circle cx="60" cy="72" r="18" fill="url(#tb-gold)" />
      <circle cx="60" cy="72" r="18" fill="none" stroke="url(#tb-highlight)" strokeWidth="1.5" />
      <circle cx="60" cy="72" r="14" fill="url(#tb-emerald)" />
      <circle cx="60" cy="72" r="14" fill="none" stroke="#000" strokeOpacity="0.4" strokeWidth="0.8" />
      {/* Scales of justice */}
      <rect x="59" y="60" width="2" height="22" fill="#fff5c2" />
      <rect x="48" y="66" width="24" height="1.6" fill="#fff5c2" />
      <path d="M46 68 Q49 76 52 68 Z" fill="#fff5c2" opacity="0.95" />
      <path d="M68 68 Q71 76 74 68 Z" fill="#fff5c2" opacity="0.95" />
      <circle cx="60" cy="60" r="2" fill="#fff5c2" />
      {/* 5-star crown across top */}
      <Star cx={30} cy={26} r={4} fill="url(#tb-gold)" stroke="#000" />
      <Star cx={44} cy={16} r={5} fill="url(#tb-gold)" stroke="#000" />
      <Star cx={60} cy={12} r={6} fill="url(#tb-gold)" stroke="#000" />
      <Star cx={76} cy={16} r={5} fill="url(#tb-gold)" stroke="#000" />
      <Star cx={90} cy={26} r={4} fill="url(#tb-gold)" stroke="#000" />
      <Ribbon label="VERITAS" fill="url(#tb-ribbon-gold)" />
    </g>
  )
}

// ---- Public component ----------------------------------------------------

export function TrustBadge({ tier, size = 64, className, style }: TrustBadgeProps) {
  return (
    <svg
      viewBox="0 0 120 120"
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
