'use client'

/**
 * WorldIdVerifyButton — wraps @worldcoin/idkit IDKitWidget.
 *
 * Replaces the previous fake-nullifier setTimeout flow. The widget opens the
 * official World ID modal, runs the proof through our /api/verify route
 * (which talks to the Worldcoin developer-portal verify endpoint), and on
 * success returns a real nullifier_hash that can be used as the bytes32
 * argument to ZkTruthProof.mintVerifiedProof.
 */

import { IDKitWidget, VerificationLevel, type ISuccessResult } from '@worldcoin/idkit'

interface Props {
  /** Bound to the verification — typically the SHA-256 hash of the captured media. */
  signal?: string
  verifying: boolean
  verified: boolean
  onVerifying: () => void
  onVerified: (nullifierHash: `0x${string}`) => void
  onError: (msg: string) => void
  className?: string
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
  // New app `zkTruth Verify` registered Jun 10 2026.
  // - APP ID: app_1e1334283f3c12386ee55c5617ff5972
  // - RP ID:  rp_5c50700e68b83094 (used by World ID 4.0)
  // - Mode:   Managed (Developer Portal handles signer keys server-side).
  const appId = (process.env.NEXT_PUBLIC_WORLD_APP_ID ||
    'app_1e1334283f3c12386ee55c5617ff5972') as `app_${string}`
  const action = process.env.NEXT_PUBLIC_WORLD_ACTION || 'capture-proof'

  // Called by IDKit before onSuccess. Must throw on failure so IDKit shows an
  // error state and does not invoke onSuccess.
  const handleVerify = async (proof: ISuccessResult) => {
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proof: proof.proof,
        nullifier_hash: proof.nullifier_hash,
        merkle_root: proof.merkle_root,
        verification_level: proof.verification_level,
        signal: signal ?? '',
      }),
    })
    if (!res.ok) {
      // /api/verify now returns flattened { detail, code, attribute, worldcoin_status, error }
      const data: {
        detail?: string | null
        code?: string | null
        attribute?: string | null
        worldcoin_status?: number
        error?: { detail?: string; code?: string; attribute?: string } | unknown
      } = await res.json().catch(() => ({}))
      const innerErr = (data?.error && typeof data.error === 'object'
        ? data.error
        : null) as { detail?: string; code?: string; attribute?: string } | null
      const msg =
        data?.detail ||
        data?.code ||
        data?.attribute ||
        innerErr?.detail ||
        innerErr?.code ||
        innerErr?.attribute ||
        `Server verification failed${data?.worldcoin_status ? ` (${data.worldcoin_status})` : ''}`
      onError(msg)
      throw new Error(msg)
    }
  }

  const onSuccess = (result: ISuccessResult) => {
    // nullifier_hash is a 0x-prefixed bytes32 — exactly what the contract wants.
    onVerified(result.nullifier_hash as `0x${string}`)
  }

  const label = verifying ? 'VERIFYING...' : verified ? 'VERIFIED ✓' : 'VERIFY :: WORLD ID'

  return (
    <IDKitWidget
      app_id={appId}
      action={action}
      signal={signal}
      handleVerify={handleVerify}
      onSuccess={onSuccess}
      verification_level={VerificationLevel.Device}
    >
      {({ open }) => (
        <button
          className={className ?? 'wid-verify-btn'}
          disabled={verifying || verified}
          onClick={() => {
            onVerifying()
            open()
          }}
        >
          {label}
        </button>
      )}
    </IDKitWidget>
  )
}
