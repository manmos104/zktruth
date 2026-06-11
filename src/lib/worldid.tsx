'use client'

/**
 * WorldIdVerifyButton — per-photo verification with a dynamic action.
 *
 * The Worldcoin nullifier is derived from (person, app_id, action), so to
 * let the same human mint many verified photos we mint a fresh action per
 * photo. The action carries a chunk of the SHA-256 capture hash so two
 * different captures (even from the same person) produce two different
 * nullifiers. Pre-registration in the Developer Portal is NOT required —
 * Worldcoin treats any 1..32-char ASCII action as valid.
 *
 * Flow:
 *   1. The browser asks `/api/rp-signature` to sign the per-photo action.
 *   2. The signed payload is handed to `IDKitRequestWidget` as
 *      `rp_context`.
 *   3. World App generates a v3 (legacy) proof bound to the action.
 *   4. The browser forwards the proof to `/api/verify`, which posts it to
 *      Worldcoin's `v4/verify/{rp_id}` endpoint with
 *      `protocol_version: '3.0'`.
 *   5. `return_to` auto-redirects Safari back to the originating tab.
 */

import { useEffect, useRef, useState } from 'react'
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from '@worldcoin/idkit'

interface Props {
  /** SHA-256 of the captured media. Used to scope the action per photo. */
  signal?: string
  verifying: boolean
  verified: boolean
  onVerifying: () => void
  onVerified: (nullifierHash: `0x${string}`) => void
  onError: (msg: string) => void
  className?: string
}

const APP_ID = (process.env.NEXT_PUBLIC_WORLD_APP_ID ||
  'app_1e1334283f3c12386ee55c5617ff5972') as `app_${string}`
const RP_ID = process.env.NEXT_PUBLIC_WORLD_RP_ID || 'rp_5c50700e68b83094'

/**
 * Build a unique-per-photo action identifier. World App accepts arbitrary
 * action strings up to 32 ASCII characters; we use a stable `cap-` prefix
 * plus 28 chars of the capture hash (stripping any 0x prefix) so two
 * different photos can never collide.
 */
function buildAction(photoHash: string | undefined): string {
  const clean = (photoHash || 'unknown').replace(/^0x/, '')
  return `cap-${clean.slice(0, 28)}`
}

export function WorldIdVerifyButton({
  signal,
  verifying,
  verified,
  onVerifying,
  onVerified,
  onError,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [rpContext, setRpContext] = useState<RpContext | null>(null)
  const [fetchingSig, setFetchingSig] = useState(false)
  const action = buildAction(signal)
  // Track which action the current rpContext was signed for so a new
  // capture invalidates a stale signature.
  const signedActionRef = useRef<string | null>(null)

  const fetchRpContext = async (forAction: string): Promise<RpContext | null> => {
    setFetchingSig(true)
    try {
      const res = await fetch('/api/rp-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: forAction }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg = (err && (err.error || err.detail)) || `sign request failed (${res.status})`
        onError(String(msg))
        return null
      }
      const data = (await res.json()) as {
        sig: string
        nonce: string
        created_at: number
        expires_at: number
      }
      const ctx: RpContext = {
        rp_id: RP_ID,
        nonce: data.nonce,
        created_at: data.created_at,
        expires_at: data.expires_at,
        signature: data.sig,
      }
      setRpContext(ctx)
      signedActionRef.current = forAction
      return ctx
    } catch (e) {
      onError(String(e))
      return null
    } finally {
      setFetchingSig(false)
    }
  }

  // If the widget is open and we don't yet have a matching context, fetch.
  useEffect(() => {
    if (open && (!rpContext || signedActionRef.current !== action)) {
      fetchRpContext(action)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, action])

  const handleVerify = async (result: IDKitResult) => {
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idkitResponse: result }),
    })
    if (!res.ok) {
      const data: {
        detail?: string | null
        code?: string | null
        worldcoin_status?: number
      } = await res.json().catch(() => ({}))
      const msg =
        data?.detail ||
        data?.code ||
        `Server verification failed${data?.worldcoin_status ? ` (${data.worldcoin_status})` : ''}`
      onError(msg)
      throw new Error(msg)
    }
    const { nullifier_hash } = (await res.json()) as { nullifier_hash: string }
    onVerified(nullifier_hash as `0x${string}`)
  }

  const onSuccess = (_result: IDKitResult) => {
    void _result
  }

  const label = verifying
    ? fetchingSig
      ? 'SIGNING...'
      : 'VERIFYING...'
    : verified
      ? 'VERIFIED ✓'
      : 'VERIFY :: WORLD ID'

  const startFlow = async () => {
    if (verifying || verified) return
    onVerifying()
    const ctx = await fetchRpContext(action)
    if (!ctx) return
    setOpen(true)
  }

  return (
    <>
      <button
        className={className ?? 'wid-verify-btn'}
        disabled={verifying || verified || fetchingSig}
        onClick={startFlow}
      >
        {label}
      </button>
      {rpContext && signedActionRef.current === action && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={APP_ID}
          action={action}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          // `orbLegacy` works with v3 World IDs (device or orb level). For
          // Proof-of-Capture we don't need a higher tier of identity.
          preset={orbLegacy({})}
          return_to={
            typeof window !== 'undefined'
              ? window.location.href
              : 'https://zktruth.vercel.app/'
          }
          handleVerify={handleVerify}
          onSuccess={onSuccess}
          autoClose
        />
      )}
    </>
  )
}
