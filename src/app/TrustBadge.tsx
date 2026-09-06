'use client'

/**
 * TrustBadge — heirloom-grade heraldic insignia.
 *
 * Design goals: the badges should read as antique jewelry (deep,
 * saturated stones set in aged precious metal) rather than flat vector
 * art. To achieve that we lean on:
 *
 *   1. Aged, low-saturation metal palettes with 5-stop gradients so
 *      each frame has a genuine polish → mid-tone → recess arc.
 *   2. Layered shadow / highlight passes — every frame gets an outer
 *      drop shadow, a top bevel gloss, an inner rim brightener, and
 *      a recessed panel with its own inset shadow.
 *   3. Faceted brilliant-cut diamond gems with a specular sweep, a
 *      pinpoint fire glint, and a bottom pavilion darken. Facet cuts
 *      are hand-authored per side so the gem catches light unevenly.
 *   4. Bead-and-reel borders + engraved filigree on the frames, so
 *      the metal has the tooling detail of a struck medal rather
 *      than a plain silhouette.
 *   5. Feather plumage built from a spine + individually shaded
 *      barbs + tip highlight — not leaf silhouettes.
 *   6. Ribbon banners with double-fold shadows, gold trim, and a
 *      Serif-only Roman numeral / motto.
 *
 * Journalism ladder → visual concept:
 *   1  Source                — gunmetal shield, deep garnet, minimal plumage
 *   2  Whistleblower         — aged bronze shield, pigeon-blood ruby, laurel base
 *   3  Muckraker             — antique silver + gold entwined medallion, twin plumage
 *   4  Investigative Reporter— antique gold shield, cascading plumage, crest
 *   5  Truth-Teller          — 24k medallion, sunburst, full wreath, star crown
 */

import type { CSSProperties, ReactElement } from 'react'

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
      {/* Antique metals. Five gradient stops each so the sweep goes
          polish → mid-tone → dark shadow → deep recess without any
          hard color band. Angle is a slight diagonal (15°/85°) so the
          light source reads as "upper-left" — a jeweler's convention. */}
      <linearGradient id="tb-steel" x1="15%" y1="0%" x2="85%" y2="100%">
        <stop offset="0%"   stopColor="#e0e6ed" />
        <stop offset="18%"  stopColor="#a8b2be" />
        <stop offset="42%"  stopColor="#5a6570" />
        <stop offset="72%"  stopColor="#2c333c" />
        <stop offset="100%" stopColor="#0d1015" />
      </linearGradient>
      <linearGradient id="tb-bronze" x1="15%" y1="0%" x2="85%" y2="100%">
        <stop offset="0%"   stopColor="#f4d5a4" />
        <stop offset="18%"  stopColor="#c69352" />
        <stop offset="42%"  stopColor="#7c4a1a" />
        <stop offset="72%"  stopColor="#3a1e08" />
        <stop offset="100%" stopColor="#150802" />
      </linearGradient>
      <linearGradient id="tb-silver" x1="15%" y1="0%" x2="85%" y2="100%">
        <stop offset="0%"   stopColor="#f6f9fc" />
        <stop offset="18%"  stopColor="#c8d0d8" />
        <stop offset="42%"  stopColor="#7a8590" />
        <stop offset="72%"  stopColor="#2e353d" />
        <stop offset="100%" stopColor="#0e1115" />
      </linearGradient>
      <linearGradient id="tb-gold" x1="15%" y1="0%" x2="85%" y2="100%">
        <stop offset="0%"   stopColor="#fff2b8" />
        <stop offset="18%"  stopColor="#dcaa30" />
        <stop offset="42%"  stopColor="#8a5808" />
        <stop offset="72%"  stopColor="#3a2402" />
        <stop offset="100%" stopColor="#150c02" />
      </linearGradient>
      <linearGradient id="tb-gold-bright" x1="15%" y1="0%" x2="85%" y2="100%">
        <stop offset="0%"   stopColor="#fff8d4" />
        <stop offset="18%"  stopColor="#ffd642" />
        <stop offset="42%"  stopColor="#c48a10" />
        <stop offset="72%"  stopColor="#4a2f03" />
        <stop offset="100%" stopColor="#180d02" />
      </linearGradient>

      {/* Rim gradients — thin bright strokes used to fake a beveled
          edge on top of the main frame. Kept vertical so the bright
          side sits at the top regardless of frame rotation. */}
      <linearGradient id="tb-rim-gold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"  stopColor="#fff4bc" />
        <stop offset="50%" stopColor="#c48a10" />
        <stop offset="100%" stopColor="#3a2402" />
      </linearGradient>
      <linearGradient id="tb-rim-silver" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"  stopColor="#ffffff" />
        <stop offset="50%" stopColor="#a8b2be" />
        <stop offset="100%" stopColor="#2c333c" />
      </linearGradient>

      {/* Gemstones. Multi-stop radials, highlight biased to the upper
          left, dark red-black core at the pavilion. The last stop is
          nearly black so the gem sits well against dark frame panels. */}
      <radialGradient id="tb-gem-garnet" cx="30%" cy="26%" r="90%">
        <stop offset="0%"  stopColor="#9a4a4a" />
        <stop offset="18%" stopColor="#6a2020" />
        <stop offset="45%" stopColor="#3a0e0e" />
        <stop offset="75%" stopColor="#1a0404" />
        <stop offset="100%" stopColor="#080101" />
      </radialGradient>
      <radialGradient id="tb-gem-ruby" cx="28%" cy="24%" r="95%">
        <stop offset="0%"  stopColor="#ffb4bc" />
        <stop offset="14%" stopColor="#ff4858" />
        <stop offset="38%" stopColor="#c00a20" />
        <stop offset="68%" stopColor="#5a0510" />
        <stop offset="100%" stopColor="#180206" />
      </radialGradient>
      <radialGradient id="tb-gem-crimson" cx="28%" cy="24%" r="95%">
        <stop offset="0%"  stopColor="#ff8090" />
        <stop offset="14%" stopColor="#ee2438" />
        <stop offset="38%" stopColor="#a0091c" />
        <stop offset="68%" stopColor="#480510" />
        <stop offset="100%" stopColor="#140206" />
      </radialGradient>
      <radialGradient id="tb-gem-flame" cx="28%" cy="22%" r="100%">
        <stop offset="0%"  stopColor="#ffd4d8" />
        <stop offset="12%" stopColor="#ff5464" />
        <stop offset="35%" stopColor="#d80a24" />
        <stop offset="65%" stopColor="#68081c" />
        <stop offset="100%" stopColor="#0e0104" />
      </radialGradient>

      {/* Specular highlight sweep on top of the gem — a diagonal white
          gradient that fades quickly, sold as a fine polish streak. */}
      <linearGradient id="tb-gem-specular" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="45%"  stopColor="#ffffff" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>

      {/* Feather plumage — layered gradients for the outer edge (dark
          spine-side) and inner core (bright barb tips). */}
      <linearGradient id="tb-feather-outer" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#ff5060" />
        <stop offset="30%"  stopColor="#c00a24" />
        <stop offset="70%"  stopColor="#5a0812" />
        <stop offset="100%" stopColor="#150204" />
      </linearGradient>
      <linearGradient id="tb-feather-inner" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#ff9098" />
        <stop offset="55%"  stopColor="#a20a1e" />
        <stop offset="100%" stopColor="#3a0510" />
      </linearGradient>

      {/* Ribbon fills — a two-tone cloth with a subtle centre sheen. */}
      <linearGradient id="tb-ribbon-red" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"  stopColor="#e83a52" />
        <stop offset="50%" stopColor="#9c142a" />
        <stop offset="100%" stopColor="#3a0510" />
      </linearGradient>
      <linearGradient id="tb-ribbon-gold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"  stopColor="#ffd642" />
        <stop offset="50%" stopColor="#a06808" />
        <stop offset="100%" stopColor="#3a2402" />
      </linearGradient>

      {/* Frame gloss overlay — used to fake a top polish sweep. */}
      <linearGradient id="tb-frame-gloss" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"  stopColor="#ffffff" stopOpacity="0.75" />
        <stop offset="35%" stopColor="#ffffff" stopOpacity="0.18" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
      </linearGradient>

      {/* Sunburst ray — bright at the centre, fades to nothing at the
          tip; used behind the Truth-Teller gem for the fire-glow. */}
      <linearGradient id="tb-ray" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%"  stopColor="#fff8d4" stopOpacity="0.75" />
        <stop offset="60%" stopColor="#ffd642" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#ffd642" stopOpacity="0" />
      </linearGradient>

      {/* Filters. A dual-layer drop shadow gives a soft, deep base
          shadow. Inset shadow simulates a recessed panel. */}
      <filter id="tb-shadow" x="-25%" y="-25%" width="150%" height="160%">
        <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodOpacity="0.55" />
        <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodOpacity="0.35" />
      </filter>
      <filter id="tb-inset" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" />
        <feOffset dx="0" dy="0.8" result="off" />
        <feComponentTransfer result="shadow">
          <feFuncA type="linear" slope="0.9" />
        </feComponentTransfer>
        <feComposite in2="SourceGraphic" operator="arithmetic"
          k2="-1" k3="1" result="inset" />
        <feComposite in="SourceGraphic" in2="inset" operator="over" />
      </filter>
      <filter id="tb-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="1.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  )
}

// ---- Diamond gem primitive ----------------------------------------------

/**
 * Brilliant-cut faceted gem with specular sweep + fire glint.
 * Draws: base kite, girdle band, 4 crown facets, 3 pavilion facets,
 * top-left specular polygon (semi-transparent white), a pinpoint
 * white glint at the star facet, and a subtle bottom shadow at the
 * culet. Every stone in the badge lineup uses this — the tier's
 * identity comes from the `fill` gradient.
 */
function DiamondGem({
  cx, cy, size, fill, rim = '#fff4bc', ratio = 0.72,
}: {
  cx: number; cy: number; size: number; fill: string
  rim?: string; ratio?: number
}) {
  const h = size
  const w = size * ratio
  const top = { x: cx, y: cy - h / 2 }
  const right = { x: cx + w / 2, y: cy - h * 0.05 }
  const bot = { x: cx, y: cy + h / 2 }
  const left = { x: cx - w / 2, y: cy - h * 0.05 }
  const tableTop = h * 0.28
  const tableW = w * 0.55
  const tl = { x: cx - tableW / 2, y: cy - tableTop }
  const tr = { x: cx + tableW / 2, y: cy - tableTop }
  const outline = `${top.x},${top.y} ${right.x},${right.y} ${bot.x},${bot.y} ${left.x},${left.y}`
  return (
    <g>
      {/* Base kite with warm rim + hair-line inner stroke for depth */}
      <polygon points={outline} fill={fill} stroke={rim}
        strokeWidth="1.2" strokeOpacity="0.95" />
      <polygon points={outline} fill="none" stroke="#000"
        strokeOpacity="0.5" strokeWidth="0.4" />

      {/* Bottom pavilion darken — subtle triangle below the girdle */}
      <polygon
        points={`${left.x},${left.y} ${right.x},${right.y} ${bot.x},${bot.y}`}
        fill="#000000" opacity="0.22"
      />

      {/* Girdle — bright band at widest point */}
      <line x1={left.x} y1={left.y} x2={right.x} y2={right.y}
        stroke="#fff" strokeOpacity="0.5" strokeWidth="1.1" />

      {/* Crown facet cuts (top half) */}
      <line x1={top.x} y1={top.y} x2={tl.x} y2={tl.y}
        stroke="#fff" strokeOpacity="0.35" strokeWidth="0.55" />
      <line x1={top.x} y1={top.y} x2={tr.x} y2={tr.y}
        stroke="#fff" strokeOpacity="0.32" strokeWidth="0.55" />
      <line x1={left.x} y1={left.y} x2={tl.x} y2={tl.y}
        stroke="#fff" strokeOpacity="0.28" strokeWidth="0.55" />
      <line x1={right.x} y1={right.y} x2={tr.x} y2={tr.y}
        stroke="#fff" strokeOpacity="0.28" strokeWidth="0.55" />
      <line x1={tl.x} y1={tl.y} x2={tr.x} y2={tr.y}
        stroke="#fff" strokeOpacity="0.5" strokeWidth="0.65" />

      {/* Pavilion facet cuts (bottom half) */}
      <line x1={left.x} y1={left.y} x2={bot.x} y2={bot.y}
        stroke="#000" strokeOpacity="0.35" strokeWidth="0.55" />
      <line x1={right.x} y1={right.y} x2={bot.x} y2={bot.y}
        stroke="#000" strokeOpacity="0.32" strokeWidth="0.55" />
      <line x1={cx} y1={cy - h * 0.05} x2={bot.x} y2={bot.y}
        stroke="#000" strokeOpacity="0.28" strokeWidth="0.55" />

      {/* Specular sweep — a diagonal glossy band tucked over the
          upper-left crown */}
      <polygon
        points={`${top.x},${top.y} ${tl.x},${tl.y} ${left.x},${left.y}`}
        fill="url(#tb-gem-specular)"
      />
      {/* Fire glint — bright pinprick on the star facet */}
      <ellipse cx={tl.x + tableW * 0.32} cy={tl.y + 1.2}
        rx={tableW * 0.18} ry="1.6" fill="#ffffff" opacity="0.7" />
      {/* Secondary micro-glint */}
      <circle cx={tl.x + tableW * 0.08} cy={tl.y + 3}
        r="0.6" fill="#ffffff" opacity="0.85" />
    </g>
  )
}

// ---- Feather primitive with barbs ---------------------------------------

function Feather({
  x, y, angle, length, barbs = 8,
}: {
  x: number; y: number; angle: number; length: number; barbs?: number
}) {
  const w = length * 0.34
  const barbLines: ReactElement[] = []
  for (let i = 1; i <= barbs; i++) {
    const t = i / (barbs + 1)
    const spineY = -length * t
    const barbLen = w * (0.92 - Math.abs(t - 0.5) * 0.7)
    barbLines.push(
      <line
        key={`L${i}`}
        x1={0} y1={spineY}
        x2={-barbLen * 0.9}
        y2={spineY + barbLen * 0.35}
        stroke="#1e0308"
        strokeOpacity="0.55"
        strokeWidth="0.4"
      />,
      <line
        key={`R${i}`}
        x1={0} y1={spineY}
        x2={barbLen * 0.9}
        y2={spineY + barbLen * 0.35}
        stroke="#1e0308"
        strokeOpacity="0.55"
        strokeWidth="0.4"
      />,
    )
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      {/* Outer silhouette */}
      <path
        d={`M0 0
            Q${w * 0.5} ${-length * 0.28} ${w * 0.22} ${-length * 0.65}
            Q${w * 0.08} ${-length * 0.9} 0 ${-length}
            Q${-w * 0.08} ${-length * 0.9} ${-w * 0.22} ${-length * 0.65}
            Q${-w * 0.5} ${-length * 0.28} 0 0 Z`}
        fill="url(#tb-feather-outer)"
        stroke="#1a0408"
        strokeOpacity="0.7"
        strokeWidth="0.55"
      />
      {/* Inner bright core */}
      <path
        d={`M0 ${-length * 0.05}
            Q${w * 0.28} ${-length * 0.3} ${w * 0.12} ${-length * 0.62}
            Q${w * 0.05} ${-length * 0.82} 0 ${-length * 0.95}
            Q${-w * 0.05} ${-length * 0.82} ${-w * 0.12} ${-length * 0.62}
            Q${-w * 0.28} ${-length * 0.3} 0 ${-length * 0.05} Z`}
        fill="url(#tb-feather-inner)"
        opacity="0.8"
      />
      {/* Spine */}
      <line x1="0" y1="0" x2="0" y2={-length}
        stroke="#1e0308" strokeOpacity="0.9" strokeWidth="0.6" />
      {barbLines}
      {/* Tip highlight */}
      <ellipse cx="0" cy={-length * 0.94} rx={w * 0.11} ry="1.6"
        fill="#ffb0b8" opacity="0.65" />
      {/* Root gathered wrap */}
      <ellipse cx="0" cy="1.2" rx={w * 0.38} ry="1.6"
        fill="#4a0810" opacity="0.85" />
    </g>
  )
}

// ---- Bead-and-reel border ----------------------------------------------

/**
 * String of small pearl beads laid along an arc between two angles.
 * Emulates the bead-and-reel tooling on high-end minted medals.
 */
function BeadedArc({
  cx, cy, r, from, to, count = 20, beadR = 1.2,
  fill = 'url(#tb-gold-bright)',
}: {
  cx: number; cy: number; r: number
  from: number; to: number
  count?: number; beadR?: number; fill?: string
}) {
  const beads: ReactElement[] = []
  for (let i = 0; i <= count; i++) {
    const t = i / count
    const a = from + (to - from) * t
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    beads.push(
      <g key={i}>
        <circle cx={x} cy={y} r={beadR} fill={fill}
          stroke="#000" strokeOpacity="0.55" strokeWidth="0.3" />
        <circle cx={x - beadR * 0.3} cy={y - beadR * 0.35}
          r={beadR * 0.32} fill="#fff" opacity="0.55" />
      </g>,
    )
  }
  return <g>{beads}</g>
}

// ---- Ribbon banner ------------------------------------------------------

function Ribbon({ label, fill = 'url(#tb-ribbon-red)' }: {
  label?: string; fill?: string
}) {
  return (
    <g>
      {/* Left tail with cut notch + inner fold shadow */}
      <path d="M22 98 L8 114 L18 108 L26 105 Z" fill={fill} />
      <path d="M8 114 L14 108 L18 108 Z" fill="#000" opacity="0.55" />
      {/* Right tail */}
      <path d="M98 98 L112 114 L102 108 L94 105 Z" fill={fill} />
      <path d="M112 114 L106 108 L102 108 Z" fill="#000" opacity="0.55" />
      {/* Main scroll body */}
      <path d="M24 98 Q60 112 96 98 L96 108 Q60 122 24 108 Z" fill={fill} />
      <path d="M24 98 Q60 112 96 98 L96 108 Q60 122 24 108 Z"
        fill="url(#tb-frame-gloss)" opacity="0.4" />
      {/* Fold-line embossment */}
      <path d="M24 98 Q60 112 96 98" fill="none"
        stroke="#000" strokeOpacity="0.4" strokeWidth="0.55" />
      {/* Gold trim along the bottom edge */}
      <path d="M25 107 Q60 121 95 107" fill="none"
        stroke="url(#tb-gold-bright)" strokeOpacity="0.85"
        strokeWidth="0.7" strokeLinecap="round" />
      {label && (
        <text
          x="60" y="108"
          textAnchor="middle"
          fontFamily="'Georgia', 'Cormorant Garamond', serif"
          fontSize={label.length > 3 ? 6.2 : 8.4}
          fontWeight="700"
          fill="#fff4bc"
          letterSpacing="1.3"
          style={{ textShadow: '0 1px 1.5px rgba(0,0,0,0.85)' }}
        >
          {label}
        </text>
      )}
    </g>
  )
}

// ---- Laurel wreath ------------------------------------------------------

function LaurelBranch({
  side, tint = 'url(#tb-gold)', full = false,
}: {
  side: 'left' | 'right'; tint?: string; full?: boolean
}) {
  const flip = side === 'right' ? 'scale(-1 1) translate(-120 0)' : ''
  const leafSpec = full
    ? [86, 78, 70, 62, 54, 46, 38, 30]
    : [82, 72, 62, 52, 42]
  return (
    <g transform={flip} opacity={0.96}>
      {/* Main stem with a dark under-shadow for depth */}
      <path
        d={full ? "M28 96 Q16 66 22 26" : "M28 96 Q18 72 24 42"}
        stroke="#3a2402" strokeWidth="2.3" fill="none" strokeLinecap="round"
      />
      <path
        d={full ? "M28 96 Q16 66 22 26" : "M28 96 Q18 72 24 42"}
        stroke={tint} strokeWidth="1.6" fill="none" strokeLinecap="round"
      />
      {leafSpec.map((y, i) => {
        const jitter = ((i * 37) % 7) - 3
        const baseAngle = -32 - i * 4 + jitter
        const cx = 22 - i * 0.5
        const rx = 5.9 - i * 0.28
        return (
          <g key={y}>
            {/* Leaf under-shadow */}
            <ellipse
              cx={cx + 0.4} cy={y + 0.6} rx={rx} ry={2.6}
              fill="#000" opacity="0.4"
              transform={`rotate(${baseAngle} ${cx} ${y})`}
            />
            {/* Leaf body */}
            <ellipse
              cx={cx} cy={y} rx={rx} ry={2.6}
              fill={tint}
              transform={`rotate(${baseAngle} ${cx} ${y})`}
              stroke="#3a2402"
              strokeOpacity="0.55"
              strokeWidth="0.4"
            />
            {/* Vein highlight */}
            <line
              x1={cx - rx * 0.75} y1={y}
              x2={cx + rx * 0.6} y2={y}
              stroke="#fff4bc"
              strokeOpacity="0.45"
              strokeWidth="0.4"
              transform={`rotate(${baseAngle} ${cx} ${y})`}
            />
            {/* Tip highlight glint */}
            <circle cx={cx - rx * 0.7} cy={y - 0.4} r="0.4"
              fill="#fff8d4" opacity="0.7"
              transform={`rotate(${baseAngle} ${cx} ${y})`} />
          </g>
        )
      })}
      {/* Gold berries between leaf groups */}
      {leafSpec.filter((_, i) => i % 2 === 0).map((y, i) => (
        <g key={`b${y}`}>
          <circle cx={18 - i * 0.3} cy={y - 3.2} r="1.6"
            fill="#c48a10" stroke="#3a2402"
            strokeOpacity="0.6" strokeWidth="0.35" />
          <circle cx={17.6 - i * 0.3} cy={y - 3.5} r="0.55"
            fill="#fff4bc" opacity="0.85" />
        </g>
      ))}
    </g>
  )
}

function LaurelWreath({ tint, full = false }: {
  tint?: string; full?: boolean
}) {
  return (
    <g>
      <LaurelBranch side="left"  tint={tint} full={full} />
      <LaurelBranch side="right" tint={tint} full={full} />
    </g>
  )
}

// ---- Frames --------------------------------------------------------------

/**
 * Pointed shield with layered construction:
 *   1. Dark under-shadow (thin dark stroke behind the outline)
 *   2. Main body with 5-stop metal gradient
 *   3. Top bevel gloss sweep (crescent of white gradient)
 *   4. Beaded gold pin at each shoulder
 *   5. Inner rim brightener
 *   6. Recessed panel with subtle dark radial
 *   7. Engraved decorative lines at the top notch
 */
function ShieldFrame({
  cx = 60, cy = 60, w = 62, h = 78,
  frameFill = 'url(#tb-gold)',
  panelFill = '#0a0a0f',
  rimStroke = 'url(#tb-rim-gold)',
  beadFill = 'url(#tb-gold-bright)',
}: {
  cx?: number; cy?: number; w?: number; h?: number
  frameFill?: string; panelFill?: string
  rimStroke?: string; beadFill?: string
}) {
  const x = cx - w / 2
  const y = cy - h / 2
  const outer = `
    M${x + 6} ${y}
    L${x + w * 0.38} ${y}
    L${x + w * 0.44} ${y + 3.5}
    L${x + w * 0.56} ${y + 3.5}
    L${x + w * 0.62} ${y}
    L${x + w - 6} ${y}
    Q${x + w} ${y} ${x + w} ${y + 7}
    L${x + w} ${y + h * 0.55}
    Q${x + w} ${y + h * 0.82} ${x + w / 2} ${y + h}
    Q${x} ${y + h * 0.82} ${x} ${y + h * 0.55}
    L${x} ${y + 7}
    Q${x} ${y} ${x + 6} ${y}
    Z
  `
  const inset = 7
  const ix = x + inset
  const iy = y + inset
  const iw = w - inset * 2
  const ih = h - inset * 2
  const inner = `
    M${ix + 3} ${iy}
    L${ix + iw - 3} ${iy}
    Q${ix + iw} ${iy} ${ix + iw} ${iy + 3}
    L${ix + iw} ${iy + ih * 0.55}
    Q${ix + iw} ${iy + ih * 0.82} ${ix + iw / 2} ${iy + ih}
    Q${ix} ${iy + ih * 0.82} ${ix} ${iy + ih * 0.55}
    L${ix} ${iy + 3}
    Q${ix} ${iy} ${ix + 3} ${iy}
    Z
  `
  return (
    <g>
      {/* Deep under-shadow */}
      <path d={outer} fill="#000" opacity="0.6"
        transform="translate(0 1.6)" />
      {/* Body */}
      <path d={outer} fill={frameFill}
        stroke="#000" strokeOpacity="0.7" strokeWidth="0.9" />
      {/* Top bevel gloss — crescent shape hugging the upper edge */}
      <path
        d={`M${x + 8} ${y + 1.8}
            L${x + w - 8} ${y + 1.8}
            Q${x + w - 3} ${y + 1.8} ${x + w - 3} ${y + 6}
            L${x + w - 4} ${y + 14}
            Q${x + w - 6} ${y + 9} ${x + 6} ${y + 9}
            L${x + 4} ${y + 14}
            Q${x + 3} ${y + 9} ${x + 3} ${y + 6}
            Q${x + 3} ${y + 1.8} ${x + 8} ${y + 1.8}
            Z`}
        fill="url(#tb-frame-gloss)" opacity="0.7"
      />
      {/* Engraved chevron marks at the top notch */}
      <g stroke="#000" strokeOpacity="0.7" strokeWidth="0.55" fill="none">
        <path d={`M${x + w * 0.44} ${y + 4} L${x + w * 0.56} ${y + 4}`} />
        <path d={`M${x + w * 0.45} ${y + 5.4} L${x + w * 0.55} ${y + 5.4}`} />
      </g>
      {/* Inner rim brightener — a thin bright stroke just inside */}
      <path d={outer} fill="none" stroke={rimStroke}
        strokeWidth="0.55" strokeOpacity="0.55"
        transform="scale(0.96) translate(2.5 2.5)" />
      {/* Recessed panel */}
      <path d={inner} fill={panelFill}
        stroke="#000" strokeOpacity="0.8" strokeWidth="0.65" />
      {/* Inner panel top-edge highlight */}
      <path
        d={`M${ix + 4} ${iy + 1.6} L${ix + iw - 4} ${iy + 1.6}`}
        stroke="#fff" strokeOpacity="0.35" strokeWidth="0.55"
      />
      {/* Beaded gold pins at each shoulder */}
      {[
        { cx: x + w * 0.12, cy: y + h * 0.16 },
        { cx: x + w * 0.88, cy: y + h * 0.16 },
      ].map((p) => (
        <g key={`${p.cx}-${p.cy}`}>
          <circle cx={p.cx} cy={p.cy} r="2.4" fill={beadFill}
            stroke="#000" strokeOpacity="0.6" strokeWidth="0.4" />
          <circle cx={p.cx - 0.7} cy={p.cy - 0.8} r="0.8"
            fill="#fff" opacity="0.75" />
        </g>
      ))}
    </g>
  )
}

/**
 * Round medallion with layered construction:
 *   1. Dark under-shadow
 *   2. Body circle with metal gradient
 *   3. Beaded outer ring
 *   4. Inner concentric rings (recessed + brightener)
 *   5. Recessed panel
 *   6. Top gloss crescent
 */
function RoundMedal({
  cx = 60, cy = 60, r = 34,
  frameFill = 'url(#tb-gold)',
  panelFill = '#0a0a0f',
  beadFill = 'url(#tb-gold-bright)',
  rimStroke = 'url(#tb-rim-gold)',
}: {
  cx?: number; cy?: number; r?: number
  frameFill?: string; panelFill?: string
  beadFill?: string; rimStroke?: string
}) {
  return (
    <g>
      {/* Under-shadow */}
      <circle cx={cx} cy={cy + 1.8} r={r} fill="#000" opacity="0.55" />
      {/* Body */}
      <circle cx={cx} cy={cy} r={r} fill={frameFill}
        stroke="#000" strokeOpacity="0.7" strokeWidth="0.9" />
      {/* Top gloss crescent */}
      <path
        d={`M ${cx - r * 0.9} ${cy - r * 0.3}
            A ${r} ${r} 0 0 1 ${cx + r * 0.9} ${cy - r * 0.3}
            L ${cx + r * 0.55} ${cy - r * 0.6}
            A ${r * 0.75} ${r * 0.75} 0 0 0 ${cx - r * 0.55} ${cy - r * 0.6} Z`}
        fill="url(#tb-frame-gloss)" opacity="0.55"
      />
      {/* Beaded outer ring — pearl-and-reel border */}
      <BeadedArc cx={cx} cy={cy} r={r - 2.2}
        from={-Math.PI} to={Math.PI} count={38} beadR={1.15}
        fill={beadFill} />
      {/* Rim brightener */}
      <circle cx={cx} cy={cy} r={r - 5.5} fill="none"
        stroke={rimStroke} strokeWidth="1.3" opacity="0.9" />
      <circle cx={cx} cy={cy} r={r - 5.5} fill="none"
        stroke="#000" strokeOpacity="0.4" strokeWidth="0.4" />
      {/* Recessed panel */}
      <circle cx={cx} cy={cy} r={r - 7.5} fill={panelFill}
        stroke="#000" strokeOpacity="0.75" strokeWidth="0.6" />
      {/* Panel inner shadow ring */}
      <circle cx={cx} cy={cy + 0.6} r={r - 7.5} fill="none"
        stroke="#000" strokeOpacity="0.5" strokeWidth="1.4" />
    </g>
  )
}

// ---- Entwined knot ornament (Muckraker) --------------------------------

function EntwinedKnot({ cx, cy, r, count = 8 }: {
  cx: number; cy: number; r: number; count?: number
}) {
  const arcs: ReactElement[] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const nextA = ((i + 1) / count) * Math.PI * 2
    const midA = (a + nextA) / 2
    const x1 = cx + Math.cos(a) * r
    const y1 = cy + Math.sin(a) * r
    const x2 = cx + Math.cos(nextA) * r
    const y2 = cy + Math.sin(nextA) * r
    const outerR = r + 3
    const cxLoop = cx + Math.cos(midA) * outerR
    const cyLoop = cy + Math.sin(midA) * outerR
    // Shadow pass
    arcs.push(
      <path key={`s${i}`}
        d={`M ${x1} ${y1} Q ${cxLoop} ${cyLoop} ${x2} ${y2}`}
        stroke="#000" strokeOpacity="0.5" strokeWidth="2.6"
        fill="none" strokeLinecap="round" />,
    )
    // Body pass
    arcs.push(
      <path key={`b${i}`}
        d={`M ${x1} ${y1} Q ${cxLoop} ${cyLoop} ${x2} ${y2}`}
        stroke="url(#tb-gold-bright)" strokeWidth="1.7"
        fill="none" strokeLinecap="round" />,
    )
    // Highlight pass
    arcs.push(
      <path key={`h${i}`}
        d={`M ${x1} ${y1} Q ${cxLoop} ${cyLoop} ${x2} ${y2}`}
        stroke="#fff8d4" strokeOpacity="0.55" strokeWidth="0.55"
        fill="none" strokeLinecap="round" />,
    )
  }
  return <g>{arcs}</g>
}

// ---- Corner scroll flourish --------------------------------------------

/**
 * Baroque acanthus curl. Filled leaf body + secondary spring + berry
 * tip. Uses the metal gradient so it looks like it was struck from
 * the same die as the frame.
 */
function ScrollFlourish({
  x, y, scale = 1, angle = 0, fill = 'url(#tb-gold)', flip = false,
}: {
  x: number; y: number; scale?: number; angle?: number
  fill?: string; flip?: boolean
}) {
  const s = flip ? -scale : scale
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${s} ${scale})`}>
      {/* Leaf body — filled */}
      <path
        d="M0 0
           C 3 -5, 8 -7, 12 -6
           C 17 -4, 17 2, 12 4
           C 8 5, 4 3, 3 -1
           C 2 -3, 4 -4, 6 -2
           Z"
        fill={fill}
        stroke="#000"
        strokeOpacity="0.55"
        strokeWidth="0.4"
      />
      {/* Vein */}
      <path
        d="M0 0 C 5 -3, 10 -5, 14 -4"
        fill="none"
        stroke="#fff4bc"
        strokeOpacity="0.5"
        strokeWidth="0.45"
      />
      {/* Secondary sprig */}
      <path
        d="M12 -6 C 16 -9, 20 -8, 22 -4"
        fill="none"
        stroke={fill}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Berry tip */}
      <circle cx="22" cy="-4" r="1.6" fill={fill}
        stroke="#000" strokeOpacity="0.55" strokeWidth="0.35" />
      <circle cx="21.6" cy="-4.4" r="0.55" fill="#fff" opacity="0.75" />
    </g>
  )
}

// ---- Tier bodies ---------------------------------------------------------

/**
 * SOURCE — gunmetal shield, deep garnet gem, minimal plumage.
 */
function SourceBadge() {
  return (
    <g filter="url(#tb-shadow)">
      {/* Small plumage peeking behind the shield base */}
      <Feather x={30} y={92} angle={-45} length={30} barbs={6} />
      <Feather x={90} y={92} angle={45}  length={30} barbs={6} />

      {/* Corner scrolls in gunmetal */}
      <ScrollFlourish x={22} y={42} scale={0.9} fill="#7a8590" angle={-15} />
      <ScrollFlourish x={98} y={42} scale={0.9} flip fill="#7a8590" angle={15} />

      <ShieldFrame
        cx={60} cy={60} w={56} h={74}
        frameFill="url(#tb-steel)"
        panelFill="#111418"
        rimStroke="url(#tb-rim-silver)"
        beadFill="url(#tb-silver)"
      />

      {/* Engraved arch inside the panel */}
      <path d="M42 46 Q60 40 78 46" fill="none"
        stroke="#c1cdd6" strokeOpacity="0.6" strokeWidth="0.65" />
      <path d="M42 48 Q60 42 78 48" fill="none"
        stroke="#000" strokeOpacity="0.5" strokeWidth="0.4" />

      {/* Central gem */}
      <DiamondGem cx={60} cy={62} size={34}
        fill="url(#tb-gem-garnet)" rim="#c1cdd6" />

      {/* Beaded pearl at the top pin */}
      <circle cx="60" cy="28" r="3" fill="url(#tb-silver)"
        stroke="#000" strokeOpacity="0.55" strokeWidth="0.4" />
      <circle cx="60" cy="28" r="1.5" fill="#0d1015" />
      <circle cx="59.4" cy="27.4" r="0.7" fill="#fff" opacity="0.85" />
    </g>
  )
}

/**
 * WHISTLEBLOWER — aged bronze shield, pigeon-blood ruby, laurel base.
 */
function WhistleblowerBadge() {
  return (
    <g filter="url(#tb-shadow)">
      <LaurelWreath tint="url(#tb-bronze)" />

      <ScrollFlourish x={20} y={40} scale={1} fill="url(#tb-bronze)" angle={-20} />
      <ScrollFlourish x={100} y={40} scale={1} flip fill="url(#tb-bronze)" angle={20} />

      <ShieldFrame
        cx={60} cy={58} w={58} h={74}
        frameFill="url(#tb-bronze)"
        panelFill="#1a0c04"
        rimStroke="url(#tb-rim-gold)"
        beadFill="url(#tb-gold-bright)"
      />

      {/* Engraved arc + centreline */}
      <path d="M40 48 Q60 42 80 48" fill="none"
        stroke="#f4d5a4" strokeOpacity="0.55" strokeWidth="0.65" />
      <path d="M40 50 Q60 44 80 50" fill="none"
        stroke="#000" strokeOpacity="0.4" strokeWidth="0.4" />
      <line x1="60" y1="34" x2="60" y2="43" stroke="#f4d5a4"
        strokeOpacity="0.6" strokeWidth="0.55" />

      {/* Central ruby gem */}
      <DiamondGem cx={60} cy={58} size={38}
        fill="url(#tb-gem-ruby)" rim="#f4d5a4" />

      {/* Top crest — small trefoil with berry */}
      <path
        d="M52 24 Q60 15 68 24 Q64 22 60 22 Q56 22 52 24 Z"
        fill="url(#tb-bronze)"
        stroke="#000" strokeOpacity="0.6" strokeWidth="0.45"
      />
      <circle cx="60" cy="18" r="2.2" fill="url(#tb-gem-ruby)"
        stroke="#f4d5a4" strokeWidth="0.5" />
      <circle cx="59.5" cy="17.5" r="0.55" fill="#fff" opacity="0.85" />

      <Ribbon label="I" fill="url(#tb-ribbon-red)" />
    </g>
  )
}

/**
 * MUCKRAKER — antique silver + gold entwined round medal, twin plumage.
 */
function MuckrakerBadge() {
  return (
    <g filter="url(#tb-shadow)">
      {/* Feather cascade — three per side */}
      <Feather x={16} y={54} angle={-60} length={40} barbs={8} />
      <Feather x={22} y={70} angle={-38} length={34} barbs={7} />
      <Feather x={28} y={84} angle={-18} length={26} barbs={6} />
      <Feather x={104} y={54} angle={60} length={40} barbs={8} />
      <Feather x={98}  y={70} angle={38} length={34} barbs={7} />
      <Feather x={92}  y={84} angle={18} length={26} barbs={6} />

      {/* Medal frame — silver with gold accents */}
      <RoundMedal
        cx={60} cy={58} r={30}
        frameFill="url(#tb-silver)"
        panelFill="#0e0e14"
        beadFill="url(#tb-gold-bright)"
        rimStroke="url(#tb-rim-gold)"
      />

      {/* Entwined gold knot band on the panel edge */}
      <EntwinedKnot cx={60} cy={58} r={22} count={10} />

      {/* Central ruby diamond */}
      <DiamondGem cx={60} cy={58} size={30}
        fill="url(#tb-gem-ruby)" rim="#fff4bc" />

      {/* Top crest — pointed silver spike with gold berry */}
      <path
        d="M54 24 L60 14 L66 24 L63 24 L60 18 L57 24 Z"
        fill="url(#tb-silver)"
        stroke="#000" strokeOpacity="0.6" strokeWidth="0.45"
      />
      <circle cx="60" cy="14" r="2.2" fill="url(#tb-gold-bright)"
        stroke="#000" strokeOpacity="0.55" strokeWidth="0.4" />
      <circle cx="59.5" cy="13.5" r="0.6" fill="#fff" opacity="0.85" />

      <Ribbon label="II" fill="url(#tb-ribbon-red)" />
    </g>
  )
}

/**
 * INVESTIGATIVE REPORTER — antique gold shield, cascading plumage, crest.
 */
function InvestigativeReporterBadge() {
  return (
    <g filter="url(#tb-shadow)">
      {/* Full plumage cascade — four feathers per side */}
      <Feather x={12} y={52} angle={-70} length={48} barbs={10} />
      <Feather x={18} y={62} angle={-52} length={42} barbs={9} />
      <Feather x={24} y={74} angle={-32} length={36} barbs={8} />
      <Feather x={30} y={88} angle={-12} length={28} barbs={6} />
      <Feather x={108} y={52} angle={70} length={48} barbs={10} />
      <Feather x={102} y={62} angle={52} length={42} barbs={9} />
      <Feather x={96}  y={74} angle={32} length={36} barbs={8} />
      <Feather x={90}  y={88} angle={12} length={28} barbs={6} />

      {/* Corner scrolls */}
      <ScrollFlourish x={16} y={36} scale={1.15} fill="url(#tb-gold-bright)" angle={-25} />
      <ScrollFlourish x={104} y={36} scale={1.15} flip fill="url(#tb-gold-bright)" angle={25} />

      <ShieldFrame
        cx={60} cy={58} w={58} h={76}
        frameFill="url(#tb-gold)"
        panelFill="#180508"
        rimStroke="url(#tb-rim-gold)"
        beadFill="url(#tb-gold-bright)"
      />

      {/* Elaborate engraving inside the panel — cartouche border */}
      <g stroke="#ffd642" strokeOpacity="0.55" strokeWidth="0.6" fill="none">
        <path d="M38 46 Q60 40 82 46" />
        <path d="M40 88 Q60 92 80 88" />
        <path d="M40 42 L40 88" />
        <path d="M80 42 L80 88" />
      </g>
      <g stroke="#000" strokeOpacity="0.4" strokeWidth="0.4" fill="none">
        <path d="M38 48 Q60 42 82 48" />
      </g>

      {/* Central crimson gem */}
      <DiamondGem cx={60} cy={62} size={42}
        fill="url(#tb-gem-crimson)" rim="#fff4bc" />

      {/* Ornate top crest — three-point fleur with berry */}
      <path
        d="M52 24 L60 12 L68 24 L64 24 L60 16 L56 24 Z"
        fill="url(#tb-gold-bright)"
        stroke="#000" strokeOpacity="0.65" strokeWidth="0.55"
      />
      <path d="M48 22 L52 20 L52 26 Z"
        fill="url(#tb-gold-bright)"
        stroke="#000" strokeOpacity="0.65" strokeWidth="0.45" />
      <path d="M72 22 L68 20 L68 26 Z"
        fill="url(#tb-gold-bright)"
        stroke="#000" strokeOpacity="0.65" strokeWidth="0.45" />
      <circle cx="60" cy="14" r="2.6" fill="url(#tb-gem-crimson)"
        stroke="#fff4bc" strokeWidth="0.7" />
      <circle cx="59.3" cy="13.3" r="0.7" fill="#fff" opacity="0.85" />

      <Ribbon label="III" fill="url(#tb-ribbon-red)" />
    </g>
  )
}

/**
 * TRUTH-TELLER — 24k medallion, sunburst, full wreath, star crown.
 */
function TruthTellerBadge() {
  return (
    <g filter="url(#tb-shadow)">
      {/* Full wreath enveloping the medallion */}
      <LaurelWreath tint="url(#tb-gold-bright)" full />

      {/* Twin plumage tucked behind the medal */}
      <Feather x={14} y={60} angle={-78} length={38} barbs={9} />
      <Feather x={106} y={60} angle={78} length={38} barbs={9} />
      <Feather x={20} y={84} angle={-28} length={28} barbs={6} />
      <Feather x={100} y={84} angle={28} length={28} barbs={6} />

      {/* Corner scrolls */}
      <ScrollFlourish x={16} y={44} scale={1.15} fill="url(#tb-gold-bright)" angle={-20} />
      <ScrollFlourish x={104} y={44} scale={1.15} flip fill="url(#tb-gold-bright)" angle={20} />

      {/* Grand medallion */}
      <RoundMedal
        cx={60} cy={62} r={34}
        frameFill="url(#tb-gold-bright)"
        panelFill="#3a0410"
        beadFill="#fff8d4"
        rimStroke="url(#tb-rim-gold)"
      />

      {/* Inner rim brightener */}
      <circle cx="60" cy="62" r="24" fill="none"
        stroke="url(#tb-gold-bright)" strokeWidth="1.4" opacity="0.9" />
      <circle cx="60" cy="62" r="24" fill="none"
        stroke="#000" strokeOpacity="0.5" strokeWidth="0.55" />

      {/* Sunburst rays behind the gem */}
      <g opacity="0.45">
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i / 16) * Math.PI * 2 - Math.PI / 2
          const x1 = 60 + Math.cos(a) * 12
          const y1 = 62 + Math.sin(a) * 12
          const x2 = 60 + Math.cos(a) * 24
          const y2 = 62 + Math.sin(a) * 24
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="url(#tb-ray)" strokeWidth="1.6"
              strokeLinecap="round" />
          )
        })}
      </g>

      {/* Central flame gem */}
      <g filter="url(#tb-glow)">
        <DiamondGem cx={60} cy={62} size={44}
          fill="url(#tb-gem-flame)" rim="#fff8d4" />
      </g>

      {/* 5-star crown */}
      {[
        { cx: 26, cy: 22, r: 3.8 },
        { cx: 42, cy: 12, r: 4.8 },
        { cx: 60, cy:  8, r: 5.8 },
        { cx: 78, cy: 12, r: 4.8 },
        { cx: 94, cy: 22, r: 3.8 },
      ].map((s) => {
        const pts: string[] = []
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI / 5) * i - Math.PI / 2
          const rad = i % 2 === 0 ? s.r : s.r * 0.42
          pts.push(`${s.cx + Math.cos(a) * rad},${s.cy + Math.sin(a) * rad}`)
        }
        return (
          <g key={`${s.cx}-${s.cy}`}>
            {/* Under-shadow */}
            <polygon points={pts.join(' ')} fill="#000" opacity="0.6"
              transform="translate(0 1)" />
            <polygon points={pts.join(' ')} fill="url(#tb-gold-bright)"
              stroke="#000" strokeOpacity="0.55" strokeWidth="0.5" />
            <circle cx={s.cx} cy={s.cy} r={s.r * 0.24}
              fill="#fff8d4" opacity="0.8" />
          </g>
        )
      })}

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
