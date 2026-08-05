import { beginCell, toNano, type Cell } from '@ton/core'
import type { SendTransactionRequest } from '@tonconnect/ui-react'

/**
 * On-chain mint helper — builds the raw Cell payload + TON Connect
 * transaction that fires a `MintProof` message at the zkTruth NFT
 * collection contract.
 *
 * The 32-bit opcode is Tact's default crc32-of-message-name for
 * `MintProof`, lifted from the compiled ABI at
 * `ton/build/ZkTruthCollection/tact_ZkTruthCollection.ts` (search for
 * `"MintProof": 3892411072`). Hard-coding it here avoids having to
 * import the whole Tact-generated wrapper into the Next.js bundle.
 *
 * Field layout matches the Tact `MintProof` struct:
 *   contentHash        Int as int257
 *   gpsHash            Int as int257
 *   captureTimestamp   Int as uint64
 *   telegramMessageId  Int as uint64
 */

const OP_MINT_PROOF = 3892411072

// User-visible amount attached to every mint.
// - 0.05 TON  ≈ gas + one-off storage of the new NFT Item contract
// - 0.10 TON  ≈ service fee, forwarded to `treasury` by the contract
export const MINT_PRICE_TON = '0.15'

export interface MintProofArgs {
  contentHash: bigint       // 256-bit SHA-256 as bigint
  gpsHash: bigint           // 0 when the user opted out of GPS
  captureTimestamp: bigint  // Unix seconds
  telegramMessageId: bigint // 0 if not posted to the channel yet
}

export function buildMintProofPayload(args: MintProofArgs): Cell {
  return beginCell()
    .storeUint(OP_MINT_PROOF, 32)
    .storeInt(args.contentHash, 257)
    .storeInt(args.gpsHash, 257)
    .storeUint(args.captureTimestamp, 64)
    .storeUint(args.telegramMessageId, 64)
    .endCell()
}

export function buildMintTransaction(
  collectionAddress: string,
  args: MintProofArgs,
): SendTransactionRequest {
  const payload = buildMintProofPayload(args)
  return {
    validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minute quorum
    messages: [
      {
        address: collectionAddress,
        amount: toNano(MINT_PRICE_TON).toString(),
        payload: payload.toBoc().toString('base64'),
      },
    ],
  }
}

// Convert a hex hash string ("0xdeadbeef..." or "deadbeef...") to a
// bigint suitable for storeInt(_, 257). SHA-256 hashes are ≤ 256 bits
// so the 257-bit sign bit stays 0 and the value round-trips as
// unsigned on chain.
export function hashHexToBigInt(hex: string | undefined): bigint {
  if (!hex) return 0n
  const clean = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex
  if (clean.length === 0) return 0n
  try {
    return BigInt('0x' + clean)
  } catch {
    return 0n
  }
}

// Parse an ISO timestamp string or Unix seconds to bigint seconds.
export function timestampToBigInt(iso: string | undefined): bigint {
  if (!iso) return 0n
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 0n
  return BigInt(Math.floor(t / 1000))
}

// Extract the numeric Telegram message id from a post URL like
// https://t.me/channel_name/42 → 42n. Returns 0n when the URL is
// missing or malformed.
export function messageIdFromPostUrl(url: string | undefined): bigint {
  if (!url) return 0n
  const m = url.match(/\/(\d+)(?:\?|$)/)
  if (!m) return 0n
  try {
    return BigInt(m[1])
  } catch {
    return 0n
  }
}
