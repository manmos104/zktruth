'use client'

/**
 * WorldIdVerifyButton — per-photo verification with auto-resume.
 *
 * Verification flow:
 *   1. Browser asks `/api/rp-signature` to sign a per-photo action.
 *   2. The signed RP context goes to `IDKitRequestWidget` as `rp_context`.
 *   3. World App generates a v3 (legacy) proof bound to the action.
 *   4. Browser forwards the proof to `/api/verify`, which posts it to
 *      Worldcoin's `v4/verify/{rp_id}` endpoint with
 *      `protocol_version: '3.0'`.
 *   5. `return_to` deep-links Safari back to the originating tab.
 *
 * Per-photo nullifiers: action embeds the SHA-256 hash chunk so two
 * different captures by the same human produce different nullifiers, and
 * the smart contract's `nullifierUsed[bytes32]` mapping doesn't lock the
 * user out after a single mint.
 *
 * Auto-resume on cold restore:
 *   When iOS Safari opens a fresh tab via `return_to` (instead of
 *   refocusing the original tab), the old widget instance dies before it
 *   can poll the bridge for the proof World App just dropped there. The
 *   user lands on the pre-verification screen with a "stuck" UI.
 *   We work around it by persisting the rp_context (signed payload) to
 *   localStorage; when the page mounts and we detect a still-valid context
 *   for the current photo, we re-open the widget so polling resumes and
 *   the proof — which World App often re-sends instantly from cache — is
 *   picked up immediately. The end-user sees a brief modal flash, then the
 *   share screen.
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
const RP_CTX_STORAGE_KEY = 'zktruth_rpcontext_v1'

interface PersistedRpContext {
  ctx: RpContext
  action: string
  expiresAt: number
}

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

function loadPersistedRpContext(): PersistedRpContext | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(RP_CTX_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as PersistedRpContext
    // Reject if missing fields or expired (with a 30s grace window so a
    // request that just landed isn't thrown out by clock skew).
    if (!data?.ctx?.signature || !data?.action) return null
    const nowSec = Math.floor(Date.now() / 1000)
    if (typeof data.expiresAt !== 'number' || data.expiresAt < nowSec - 30) {
      return null
    }
    return data
  } catch {
    return null
  }
}

function persistRpContext(data: PersistedRpContext) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(RP_CTX_STORAGE_KEY, JSON.stringify(data))
  } catch { /* ignore */ }
}

function clearPersistedRpContext() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(RP_CTX_STORAGE_KEY) } catch { /* ignore */ }
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
  const signedActionRef = useRef<string | null>(null)
  const autoResumedRef = useRef(false)

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
      persistRpContext({ ctx, action: forAction, expiresAt: data.expires_at })
      return ctx
    } catch (e) {
      onError(String(e))
      return null
    } finally {
      setFetchingSig(false)
    }
  }

  // On first mount, try to restore a persisted RP context. If it's for the
  // same action as the current photo and the verification hasn't completed,
  // we auto-open the widget so its polling can pick up the proof that
  // World App may already have left on the bridge.
  useEffect(() => {
    if (autoResumedRef.current) return
    autoResumedRef.current = true
    if (verified) return
    const persisted = loadPersistedRpContext()
    if (!persisted) return
    if (persisted.action !== action) {
      // Different photo than the last attempt — clear stale context.
      clearPersistedRpContext()
      return
    }
    setRpContext(persisted.ctx)
    signedActionRef.current = persisted.action
    // Defer the auto-open by a tick so the widget can mount first.
    onVerifying()
    setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // If the user opens the widget but we don't yet have a matching context,
  // fetch one. (Covers the manual click path; the auto-resume path above
  // already sets one before flipping `open`.)
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
    // We're done with this rp_context — drop it so the next photo gets a
    // fresh one and we don't try to auto-resume into a finished flow.
    clearPersistedRpContext()
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
