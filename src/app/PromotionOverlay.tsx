'use client'

/**
 * PromotionOverlay — full-screen "tier up" celebration.
 *
 * Shown once, the first time a wallet opens the Trust profile after
 * their tier moved up. The old tier scrolls away, a shockwave and
 * sparkle burst blow out from the badge, and the new tier drops in
 * with a spinning bounce over a rotating sunburst + falling confetti
 * + score counter. Tap anywhere to dismiss; the last-seen tier is
 * persisted in localStorage so it never fires twice for the same
 * promotion.
 *
 * All animation is pure CSS keyframes so there is no runtime deps and
 * it still plays smoothly inside the Telegram Mini App WebView.
 */

import { useEffect, useState } from 'react'
import { TrustBadge, type TrustTier } from './TrustBadge'

export const TIER_ORDER: TrustTier[] = [
  'Source',
  'Whistleblower',
  'Muckraker',
  'Investigative Reporter',
  'Truth-Teller',
]

const TIER_COLOR: Record<TrustTier, string> = {
  'Source': '#8b8b8b',
  'Whistleblower': '#4dd4ff',
  'Muckraker': '#ffcf5c',
  'Investigative Reporter': '#ff7a4d',
  'Truth-Teller': '#00ff87',
}

const TIER_ACCENT: Record<TrustTier, string> = {
  'Source': '#c0c0c0',
  'Whistleblower': '#9beaff',
  'Muckraker': '#ffe89b',
  'Investigative Reporter': '#ffb896',
  'Truth-Teller': '#8effc3',
}

interface Props {
  fromTier: TrustTier
  toTier: TrustTier
  score: number
  onDone: () => void
}

const CONFETTI_COUNT = 42
const SPARK_COUNT = 24
const RAY_COUNT = 16

export function PromotionOverlay({ fromTier, toTier, score, onDone }: Props): React.ReactElement {
  const color = TIER_COLOR[toTier]
  const accent = TIER_ACCENT[toTier]

  // Count-up on the score. Starts at 0 and lands on `score` over
  // 1200ms once the new badge has settled (phase >= 3).
  const [displayScore, setDisplayScore] = useState(0)
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 40)     // old badge shrinks
    const t2 = setTimeout(() => setPhase(2), 900)    // shockwave + sparks + confetti
    const t3 = setTimeout(() => setPhase(3), 1700)   // new badge lands, text types in
    const t4 = setTimeout(() => setPhase(4), 3200)   // idle sparkle loop, wait for tap
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [])

  useEffect(() => {
    if (phase < 3) return
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 1200)
      // easeOutQuart for a satisfying decel
      const eased = 1 - Math.pow(1 - p, 4)
      setDisplayScore(Math.round(score * eased))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase, score])

  // Pre-computed randomised particle geometry frozen at mount via
  // useState lazy init. `Math.random()` inside useMemo trips React's
  // hooks-purity rule (impure calls during render); running it once
  // in useState's initializer is the sanctioned pattern for random
  // seed data that must not shuffle mid-animation.
  const [confetti] = useState(() =>
    Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * 100,       // vw
      delay: Math.random() * 900,   // ms
      duration: 2200 + Math.random() * 1800,
      hue: (['x', 'y', 'z'] as const)[i % 3], // placeholder, overridden below
      rot: Math.random() * 720 - 360,
      size: 6 + Math.random() * 8,
    })),
  )
  const [sparks] = useState(() =>
    Array.from({ length: SPARK_COUNT }, (_, i) => {
      const angle = (i / SPARK_COUNT) * Math.PI * 2
      const dist = 180 + Math.random() * 120
      return {
        id: i,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        delay: Math.random() * 120,
        useAccent: i % 3 === 0, // resolved to a colour at render time
      }
    }),
  )
  const rays = Array.from({ length: RAY_COUNT }, (_, i) => ({
    id: i,
    rot: (i / RAY_COUNT) * 360,
  }))

  return (
    <div
      onClick={onDone}
      style={{
        position: 'fixed',
        inset: 0,
        // Must be above `.privacy-modal-backdrop` (z-index 10005) so
        // the celebration paints on top of the profile modal — the
        // whole point of the effect. Was 2000 initially and the
        // modal completely covered it.
        zIndex: 20000,
        background: `radial-gradient(circle at 50% 45%, ${color}33 0%, ${color}0d 30%, #000000f2 65%, #000000f7 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <style>{`
        @keyframes zkPromoBackdrop {
          0% { opacity: 0 }
          100% { opacity: 1 }
        }
        @keyframes zkPromoRayRotate {
          from { transform: rotate(0deg) }
          to { transform: rotate(360deg) }
        }
        @keyframes zkPromoRayFade {
          0% { opacity: 0 }
          40% { opacity: 0.85 }
          100% { opacity: 0.45 }
        }
        @keyframes zkPromoOldOut {
          0% { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0px) }
          70% { transform: scale(1.15) rotate(-8deg); opacity: 0.9; filter: blur(0px) }
          100% { transform: scale(0.15) rotate(-40deg); opacity: 0; filter: blur(6px) }
        }
        @keyframes zkPromoShockwave {
          0% { transform: translate(-50%,-50%) scale(0.15); opacity: 0.95; border-width: 6px }
          100% { transform: translate(-50%,-50%) scale(3.4); opacity: 0; border-width: 1px }
        }
        @keyframes zkPromoSpark {
          0% { transform: translate(-50%,-50%) translate(0,0) scale(0.4); opacity: 0 }
          10% { opacity: 1 }
          70% { opacity: 1 }
          100% { transform: translate(-50%,-50%) translate(var(--dx), var(--dy)) scale(1.1); opacity: 0 }
        }
        @keyframes zkPromoConfetti {
          0% { transform: translate3d(0,-15vh,0) rotate(0deg); opacity: 0 }
          8% { opacity: 1 }
          100% { transform: translate3d(0,115vh,0) rotate(var(--rot)); opacity: 1 }
        }
        @keyframes zkPromoNewIn {
          0% { transform: translate3d(0, 60vh, 0) scale(0.2) rotate(-360deg); opacity: 0; filter: blur(10px) }
          55% { transform: translate3d(0, -6vh, 0) scale(1.28) rotate(20deg); opacity: 1; filter: blur(0px) }
          72% { transform: translate3d(0, 0, 0) scale(0.94) rotate(-6deg) }
          88% { transform: translate3d(0, -1vh, 0) scale(1.05) rotate(2deg) }
          100% { transform: translate3d(0, 0, 0) scale(1) rotate(0deg); opacity: 1; filter: blur(0px) }
        }
        @keyframes zkPromoNewIdle {
          0%,100% { transform: translateY(0) scale(1); filter: drop-shadow(0 0 24px ${color}aa) drop-shadow(0 0 60px ${color}55) }
          50% { transform: translateY(-8px) scale(1.02); filter: drop-shadow(0 0 40px ${color}dd) drop-shadow(0 0 90px ${color}77) }
        }
        @keyframes zkPromoTextIn {
          0% { transform: translateY(20px); opacity: 0; letter-spacing: 10px }
          100% { transform: translateY(0); opacity: 1; letter-spacing: 4px }
        }
        @keyframes zkPromoLabelIn {
          0% { transform: translateY(-14px); opacity: 0; letter-spacing: 24px }
          100% { transform: translateY(0); opacity: 1; letter-spacing: 8px }
        }
        @keyframes zkPromoTapHint {
          0%,100% { opacity: 0.4 }
          50% { opacity: 0.9 }
        }
        @keyframes zkPromoBigFlash {
          0% { opacity: 0 }
          20% { opacity: 1 }
          100% { opacity: 0 }
        }
      `}</style>

      {/* Backdrop wash — kicks the vignette in on mount */}
      <div style={{
        position: 'absolute', inset: 0,
        animation: 'zkPromoBackdrop 400ms ease-out both',
      }} />

      {/* Rotating sunburst rays behind the badge */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 720,
          height: 720,
          transform: 'translate(-50%,-50%)',
          animation: 'zkPromoRayRotate 22s linear infinite, zkPromoRayFade 1600ms ease-out both',
          pointerEvents: 'none',
        }}
      >
        {rays.map((r) => (
          <div key={r.id} style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 3,
            height: 360,
            transform: `translate(-50%,-100%) rotate(${r.rot}deg)`,
            transformOrigin: '50% 100%',
            background: `linear-gradient(to top, ${color}00 0%, ${color}66 40%, ${color}00 100%)`,
            filter: 'blur(0.5px)',
          }} />
        ))}
      </div>

      {/* White flash at the moment of the burst */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 45%, #ffffffee 0%, #ffffff00 40%)',
        animation: 'zkPromoBigFlash 700ms ease-out 800ms both',
        pointerEvents: 'none',
      }} />

      {/* Old badge sinks out */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '45%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          animation: 'zkPromoOldOut 900ms cubic-bezier(0.7,0,0.9,0.3) both',
          filter: `drop-shadow(0 0 18px ${TIER_COLOR[fromTier]}77)`,
          pointerEvents: 'none',
        }}
      >
        <TrustBadge tier={fromTier} size={200} />
      </div>

      {/* Shockwave rings + sparks — pinned to the badge's centre */}
      <div style={{
        position: 'absolute',
        top: '45%',
        left: '50%',
        width: 0,
        height: 0,
        pointerEvents: 'none',
      }}>
        {[0, 180, 360].map((delay) => (
          <div key={delay} style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 220,
            height: 220,
            borderRadius: '50%',
            border: `4px solid ${color}`,
            boxShadow: `0 0 60px ${color}`,
            transform: 'translate(-50%,-50%) scale(0.15)',
            animation: `zkPromoShockwave 1300ms cubic-bezier(0.2,0.8,0.3,1) ${800 + delay}ms both`,
          }} />
        ))}
        {sparks.map((s) => {
          // Resolve at render time so a colour change (unlikely but
          // possible if props ever animated) doesn't need to reshuffle
          // the pre-computed spark geometry.
          const hue = s.useAccent ? '#ffffff' : color
          return (
            <div key={s.id} style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 8,
              height: 8,
              borderRadius: 8,
              background: hue,
              boxShadow: `0 0 12px ${hue}, 0 0 22px ${hue}66`,
              ['--dx' as string]: `${s.dx}px`,
              ['--dy' as string]: `${s.dy}px`,
              animation: `zkPromoSpark 1400ms cubic-bezier(0.15,0.75,0.35,1) ${900 + s.delay}ms both`,
            } as React.CSSProperties} />
          )
        })}
      </div>

      {/* Confetti falling from the top edge */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {confetti.map((c, idx) => {
          // Rotate the palette across the 3 base colours so the storm
          // reads as branded rather than monochrome.
          const palette = [color, accent, '#ffffff']
          const hue = palette[idx % 3]
          return (
            <div key={c.id} style={{
              position: 'absolute',
              top: 0,
              left: `${c.x}vw`,
              width: c.size,
              height: c.size * 0.4,
              background: hue,
              borderRadius: 2,
              boxShadow: `0 0 6px ${hue}88`,
              ['--rot' as string]: `${c.rot}deg`,
              animation: `zkPromoConfetti ${c.duration}ms cubic-bezier(0.4,0.05,0.3,1) ${900 + c.delay}ms both`,
            } as React.CSSProperties} />
          )
        })}
      </div>

      {/* "PROMOTED" small label above the new badge */}
      {phase >= 3 && (
        <div style={{
          position: 'absolute',
          top: '18%',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'monospace',
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: 8,
          color: '#ffffff',
          textShadow: `0 0 12px ${color}aa`,
          animation: 'zkPromoLabelIn 600ms cubic-bezier(0.2,0.9,0.3,1) both',
          pointerEvents: 'none',
        }}>
          ⚡ PROMOTED ⚡
        </div>
      )}

      {/* New badge rises in */}
      {phase >= 2 && (
        <div style={{
          position: 'absolute',
          top: '45%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          animation: phase >= 4
            ? 'zkPromoNewIdle 3600ms ease-in-out infinite'
            : 'zkPromoNewIn 1400ms cubic-bezier(0.2,0.9,0.3,1.1) both',
          filter: `drop-shadow(0 0 24px ${color}bb) drop-shadow(0 0 60px ${color}55)`,
          pointerEvents: 'none',
        }}>
          <TrustBadge tier={toTier} size={220} />
        </div>
      )}

      {/* Tier name + score under the badge */}
      {phase >= 3 && (
        <div style={{
          position: 'absolute',
          top: '73%',
          left: 0,
          right: 0,
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: 4,
            color,
            textTransform: 'uppercase',
            textShadow: `0 0 20px ${color}cc, 0 0 40px ${color}88`,
            animation: 'zkPromoTextIn 700ms cubic-bezier(0.2,0.9,0.3,1) 200ms both',
          }}>
            {toTier}
          </div>
          <div style={{
            marginTop: 14,
            fontFamily: 'monospace',
            fontSize: 42,
            fontWeight: 800,
            color: '#ffffff',
            textShadow: `0 0 16px ${color}cc`,
            animation: 'zkPromoTextIn 700ms cubic-bezier(0.2,0.9,0.3,1) 400ms both',
          }}>
            {displayScore}
          </div>
        </div>
      )}

      {/* Tap-to-dismiss hint */}
      {phase >= 4 && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'monospace',
          fontSize: 12,
          letterSpacing: 4,
          color: '#ffffffaa',
          animation: 'zkPromoTapHint 1600ms ease-in-out infinite',
          pointerEvents: 'none',
        }}>
          TAP TO CONTINUE
        </div>
      )}
    </div>
  )
}
