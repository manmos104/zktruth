'use client'

/**
 * WorldIdVerifyButton — wraps @worldcoin/idkit v4's `IDKitRequestWidget`.
 *
 * The v4 flow:
 *   1. Browser asks our backend (`/api/rp-signature`) to sign the request
 *      using the RP signer key (held only on the server).
 *   2. We hand the signed payload to `IDKitRequestWidget` as `rp_context`.
 *   3. World App generates a v4 (or v3 legacy) proof.
 *   4. Browser forwards the proof as-is to `/api/verify`, which posts it to
 *      Worldcoin's `https://developer.world.org/api/v4/verify/{rp_id}`.
 *
 * `return_to` tells World App to auto-redirect back to Safari after the
 * user approves the request, so the user no longer has to manually swipe
 * back to the browser.
 */

import { useEffect, useState } from 'react'
import {
  IDKitRequestWidget,
  proofOfHuman,
  type IDKitResult,
  type RpContext,
} from '@worldcoin/idkit'

interface Props {
  /** Bound to the verification — accepted for API compat but not forwarded. */
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
const ACTION = process.env.NEXT_PUBLIC_WORLD_ACTION || 'capture-proof'

export function WorldIdVerifyButton({
  signal: _signal,
  verifying,
  verified,
  onVerifying,
  onVerified,
  onError,
  className,
}: Props) {
  void _signal // accepted for API compat
  const [open, setOpen] = useState(false)
  const [rpContext, setRpContext] = useState<RpContext | null>(null)
  const [fetchingSig, setFetchingSig] = useState(false)

  // The IDKit v4 widget needs a fresh signed RP context every time it opens.
  // We lazily fetch one when the user starts a verification so we don't burn
  // signature TTLs on idle page loads.
  const ensureRpContext = async (): Promise<RpContext | null> => {
    if (rpContext) return rpContext
    setFetchingSig(true)
    try {
      const res = await fetch('/api/rp-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: ACTION }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg = (err && (err.error || err.detail)) || `sign request failed (${res.status})`
        onError(String(msg))
        return null
      }
      const data = await res.json() as {
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
      return ctx
    } catch (e) {
      onError(String(e))
      return null
    } finally {
      setFetchingSig(false)
    }
  }

  // When `open` flips to true we make sure an rp_context is loaded first.
  useEffect(() => {
    if (open && !rpContext) {
      ensureRpContext()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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
    // No-op: we already invoked onVerified in handleVerify, which gives us
    // the canonical bytes32 nullifier the contract expects.
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
    const ctx = await ensureRpContext()
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
      {rpContext && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={APP_ID}
          action={ACTION}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          // Tell World App to deep-link back to our page after the user
          // approves; this is what gives us the auto-return UX on iPhone.
          // We use the current page URL exactly so iOS Safari refocuses the
          // existing tab whenever possible (otherwise it would open a fresh
          // tab and the page-level sessionStorage snapshot would still
          // restore us, but tab-focus is the better UX).
          return_to={
            typeof window !== 'undefined'
              ? window.location.href
              : 'https://zktruth.vercel.app/'
          }
          preset={proofOfHuman({})}
          handleVerify={handleVerify}
          onSuccess={onSuccess}
          autoClose
        />
      )}
    </>
  )
}
