import { beginCell, toNano, type Cell } from '@ton/core'
import type { SendTransactionRequest } from '@tonconnect/ui-react'

/**
 * On-chain mint helper — builds the raw Cell payload + TON Connect
 * transaction that fires a `MintProof` message at the zkTruth NFT
 * collection contract (v2).
 *
 * v2 change vs v1: MintProof now carries a pre-built `individualContent`
 * cell so each Item stores a UNIQUE metadata URL like
 *   https://zktruth.vercel.app/api/nft/item/<hex-hash>
 * instead of every NFT pointing at the same generic collection prefix.
 * Building the URL client-side avoids Tact's lack of Int→hex support.
 *
 * The 32-bit opcode is crc32 of the message name "MintProof". The value
 * is unchanged from v1 (opcode is derived from the name, not the field
 * layout), but the payload BODY layout is different — v1 wallets/clients
 * cannot talk to a v2 collection and vice versa.
 *
 * Field layout of MintProof v2:
 *   contentHash        Int as int257
 *   gpsHash            Int as int257
 *   captureTimestamp   Int as uint64
 *   telegramMessageId  Int as uint64
 *   individualContent  Cell (TEP-64 offchain content, ref)
 */

const OP_MINT_PROOF = 3892411072

// Metadata endpoint that will serve the per-hash JSON. The `.hex` suffix
// is the SHA-256 of the capture (no 0x prefix, lowercase). Kept as a
// module constant so the same value is used to build both the on-chain
// URL and the off-chain Blob key.
export const METADATA_URL_PREFIX = 'https://zktruth.vercel.app/api/nft/item/'

// User-visible amount attached to every mint.
// - 0.05 TON  ≈ gas + one-off storage of the new NFT Item contract
// - 0.10 TON  ≈ service fee, forwarded to `treasury` by the contract
export const MINT_PRICE_TON = '0.15'

export interface MintProofArgs {
  contentHashHex: string    // lowercase hex, no 0x prefix (SHA-256 → 64 chars)
  gpsHash: bigint           // 0 when the user opted out of GPS
  captureTimestamp: bigint  // Unix seconds
  telegramMessageId: bigint // 0 if not posted to the channel yet
}

// TEP-64 offchain content cell — a single 0x01 prefix byte followed by
// the ASCII bytes of the metadata URL. Wallets recognise this format
// and fetch the URL to render the NFT's name/image/etc.
function buildOffchainContentCell(url: string): Cell {
  return beginCell().storeUint(1, 8).storeStringTail(url).endCell()
}

export function buildMintProofPayload(args: MintProofArgs): Cell {
  const contentHash = hashHexToBigInt(args.contentHashHex)
  const metadataUrl = METADATA_URL_PREFIX + args.contentHashHex.toLowerCase()
  const individualContent = buildOffchainContentCell(metadataUrl)
  return beginCell()
    .storeUint(OP_MINT_PROOF, 32)
    .storeInt(contentHash, 257)
    .storeInt(args.gpsHash, 257)
    .storeUint(args.captureTimestamp, 64)
    .storeUint(args.telegramMessageId, 64)
    .storeRef(individualContent)
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

// Normalise a SHA-256 hex string for use as a Blob key / URL suffix.
// Strips leading 0x, lowercases, validates it's 64 hex chars. Returns
// null when the input is missing or malformed so callers can bail.
export function normaliseHashHex(hex: string | undefined): string | null {
  if (!hex) return null
  const clean = (hex.startsWith('0x') || hex.startsWith('0X')
    ? hex.slice(2)
    : hex
  ).toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(clean)) return null
  return clean
}
