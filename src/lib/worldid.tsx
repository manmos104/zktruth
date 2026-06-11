'use client'

/**
 * WorldIdVerifyButton — Session-based World ID verification.
 *
 * We use IDKit v4's `IDKitSessionWidget` rather than the action-bound
 * `IDKitRequestWidget` because the latter ties a single nullifier to
 * `(person, action)`. For a Proof-of-Capture flow the same human will
 * mint many photos, and each one needs its own fresh nullifier — exactly
 * what session proofs give us (`session_nullifier` is per `(person,
 * session_id)`, and we mint a new `session_id` per verification).
 *
 * Architecture:
 *   1. The browser asks `/api/rp-signature` to sign a session-style RP
 *      context (no action embedded — sessions don't carry actions).
 *   2. The signed payload + a `proof_of_human` constraint are handed to
 *      `IDKitSessionWidget`.
 *   3. World App generates a session proof; the browser polls the IDKit
 *      bridge and forwards the `IDKitResultSession` to `/api/verify`,
 *      which posts it to Worldcoin's `v4/verify/{rp_id}` endpoint.
 *   4. `return_to` brings Safari back to the foreground after the user
 *      approves in World App.
 */

import { useEffect, useState } from 'react'
import {
  IDKitSessionWidget,
  type IDKitResult,
  type IDKitResultSession,
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

export function WorldIdVerifyButton({
  signal: _signal,
  verifying,
  verified,
  onVerifying,
  onVerified,
  onError,
  className,
}: Props) {
  void _signal
  const [open, setOpen] = useState(false)
  const [rpContext, setRpContext] = useState<RpContext | null>(null)
  const [fetchingSig, setFetchingSig] = useState(false)

  // Fetch a fresh session-mode signed RP context. We bust whatever we had
  // cached from a previous verification because each new photo gets a
  // fresh session.
  const fetchRpContext = async (): Promise<RpContext | null> => {
    setFetchingSig(true)
    try {
      const res = await fetch('/api/rp-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Note: no `action` — session proofs are not action-bound.
        body: JSON.stringify({}),
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
      return ctx
    } catch (e) {
      onError(String(e))
      return null
    } finally {
      setFetchingSig(false)
    }
  }

  // If the user (re-)opens the widget, make sure we have a context for it.
  useEffect(() => {
    if (open && !rpContext) {
      fetchRpContext()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // IDKit calls handleVerify with the proof payload before resolving the
  // widget. We forward to our verify proxy and surface a clean error if
  // the v4 endpoint rejects.
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

  const onSuccess = (_result: IDKitResultSession) => {
    // No-op — handleVerify already invoked onVerified with the canonical
    // bytes32 nullifier that the smart contract expects.
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
    // Always refetch — a session signature is single-use, and re-using
    // one across photos gives nondeterministic results.
    const ctx = await fetchRpContext()
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
        <IDKitSessionWidget
          open={open}
          onOpenChange={setOpen}
          app_id={APP_ID}
          rp_context={rpContext}
          // `proof_of_human` constraint = "any World ID-verified human can
          // satisfy this". No document or selfie required.
          constraints={{ type: 'proof_of_human' }}
          // Deep-link Safari back to the originating tab after approval.
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
