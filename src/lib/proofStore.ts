import { getRedis } from '@/lib/trustStore'

/**
 * Proof-by-hash store — the source of truth for /proof/<hash> pages and
 * for /api/proof/<hash>. We deliberately keep this separate from
 * `trustStore` (user/reaction/mint bookkeeping) so the read path stays
 * one KV hit instead of scanning the user's mint history.
 *
 * Written by /api/trust/mint at MINT time — the mint tx is already in
 * the mempool by then, so the client-side data (contentHash, wallet,
 * timestamps, GPS hash, Telegram message id, media URL) is authoritative
 * for how the NFT WAS DECLARED to exist.
 *
 * Independent on-chain verification is layered on top by /api/proof
 * via tonapi.io: given the Item Index computed from the collection's
 * `nextItemIndex` we look up the item address and confirm the Item
 * contract actually exists — this is what turns a client-supplied hash
 * into an on-chain proof.
 *
 * Redis key layout:
 *   proof:<hash>                → ProofRecord (see below)
 *   proof:hashByMsg:<messageId> → hash string (reverse lookup by TG msg)
 */

export interface ProofRecord {
  /** SHA-256 hex, lowercase, no 0x prefix. */
  contentHashHex: string
  /** TON address in user-friendly (UQ…) form. */
  wallet: string
  /** Unix seconds captured on-device at shoot time. */
  captureTimestampSec: number
  /** Telegram channel post that carries the capture. 0 if no post. */
  telegramMessageId: number
  /** Convenience: URL to the Telegram post if known. */
  telegramPostUrl?: string
  /** Vercel Blob public URL of the primary media (image or video). */
  mediaUrl?: string
  /** Blob URL of the video poster JPEG (video mints only). */
  posterUrl?: string
  /** GPS hash stored on-chain (bigint stringified). "0" if opted out. */
  gpsHashDec?: string
  /** Server-observed mint request timestamp (ms since epoch). */
  mintedAt: number
  /** Chain: always "ton-mainnet" for now; kept explicit for later chains. */
  chain: 'ton-mainnet'
  /** Collection contract address (user-friendly form). */
  collection: string
}

const K_PROOF = (hash: string) => `proof:${hash}`
const K_HASH_BY_MSG = (mid: number | string) => `proof:hashByMsg:${mid}`

/**
 * Save a proof record. Idempotent — a retry with the same hash will
 * overwrite (never lose data) and refresh the `mintedAt` timestamp.
 */
export async function saveProof(rec: ProofRecord): Promise<void> {
  const r = getRedis()
  await r.set(K_PROOF(rec.contentHashHex), rec)
  if (rec.telegramMessageId > 0) {
    await r.set(K_HASH_BY_MSG(rec.telegramMessageId), rec.contentHashHex)
  }
}

/** Fetch a proof record by content hash, or null if not seen. */
export async function getProofByHash(hash: string): Promise<ProofRecord | null> {
  const r = getRedis()
  return (await r.get<ProofRecord>(K_PROOF(hash))) ?? null
}

/**
 * Reverse lookup — find a hash given a Telegram message id. Useful when
 * a share link carries the TG post URL and we need to jump to /proof/<hash>.
 */
export async function getHashByMessageId(mid: number | string): Promise<string | null> {
  const r = getRedis()
  return (await r.get<string>(K_HASH_BY_MSG(mid))) ?? null
}
