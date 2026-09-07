import { NextResponse } from 'next/server'
import { getProofByHash, type ProofRecord } from '@/lib/proofStore'
import { resolveCaptureMedia } from '@/lib/mediaResolver'

/**
 * GET /api/proof/<hash>
 *
 * The read-side of Phase 5: given a SHA-256 content hash, look up the
 * client-declared proof record from KV, then independently confirm the
 * NFT actually landed on-chain by asking tonapi.io for the collection's
 * items around the expected index.
 *
 * The response layers:
 *   1. `proof`         — what the client TOLD us at mint time (KV)
 *   2. `onchain`       — what tonapi CONFIRMS about the collection right now
 *   3. `verified`      — the AND of (proof exists) AND (onchain item found)
 *
 * A caller (e.g. the /proof/<hash> page) can render "✓ On-chain" only
 * when `verified === true`. Otherwise it shows "Pending confirmation"
 * or "Not found" depending on which layer is missing.
 *
 * We deliberately avoid installing a full `ton-http-lib` for this — a
 * single fetch against tonapi's public REST is more than enough for a
 * read-only verification, and it also side-steps a bunch of build-time
 * bundling grief for the Next.js edge.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COLLECTION = 'EQBHzSXx-b8tXjka-TfBeEomFpzxGJujIIeUgFzEohvfjMU_'
const TONAPI_BASE = 'https://tonapi.io/v2'

interface TonapiNftItem {
  address: string
  index: number
  owner?: { address: string }
  metadata?: Record<string, unknown> & {
    name?: string
    image?: string
    animation_url?: string
    attributes?: Array<{ trait_type?: string; value?: unknown }>
  }
  verified?: boolean
  trust?: string
  sale?: unknown
}

async function fetchCollectionItems(limit = 100, offset = 0): Promise<TonapiNftItem[]> {
  // tonapi is public; no auth needed for read. If we ever hit rate
  // limits we'll add TONAPI_KEY as an env, but 28 items × read-heavy
  // usage on `/proof` is nowhere near the free tier ceiling yet.
  const url = `${TONAPI_BASE}/nfts/collections/${COLLECTION}/items?limit=${limit}&offset=${offset}`
  const res = await fetch(url, {
    // Short cache — the collection metadata rarely changes intra-request
    // but new mints should show up promptly.
    next: { revalidate: 30 },
  })
  if (!res.ok) {
    throw new Error(`tonapi collection items ${res.status}`)
  }
  const json = (await res.json()) as { nft_items?: TonapiNftItem[] }
  return json.nft_items ?? []
}

/**
 * Scan the collection for an Item whose metadata's Content Hash trait
 * matches. Our /api/nft/item/<hash> endpoint sets this attribute, so
 * tonapi's cached metadata carries the hash back to us as a string.
 */
function findItemByHash(items: TonapiNftItem[], hash: string): TonapiNftItem | null {
  const target = hash.toLowerCase()
  for (const it of items) {
    const attrs = it.metadata?.attributes ?? []
    for (const a of attrs) {
      if (
        typeof a?.trait_type === 'string'
        && a.trait_type.toLowerCase() === 'content hash'
        && typeof a.value === 'string'
        && a.value.toLowerCase() === target
      ) {
        return it
      }
    }
  }
  return null
}

interface ProofResponse {
  hash: string
  proof: ProofRecord | null
  onchain: {
    itemAddress?: string
    itemIndex?: number
    ownerAddress?: string
    imageUrl?: string
    animationUrl?: string
    marketplaceUrl?: string
    tonviewerUrl?: string
  } | null
  /**
   * Direct-from-Blob media. Independent of tonapi's cache — a fresh
   * mint whose Item metadata isn't indexed yet still has playable
   * media as long as the upload landed on Blob. The /proof page
   * prefers this over `onchain.imageUrl` / `onchain.animationUrl`
   * so freshly-minted videos play right away.
   */
  media: {
    imageUrl?: string
    animationUrl?: string
    posterUrl?: string
    hasMedia: boolean
  }
  verified: boolean
  reason?: string
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash: rawHash } = await params
  const hash = rawHash.toLowerCase()

  const out: ProofResponse = {
    hash,
    proof: null,
    onchain: null,
    media: { hasMedia: false },
    verified: false,
  }

  if (!/^[0-9a-f]{64}$/.test(hash)) {
    out.reason = 'invalid hash format — expected 64-char hex'
    return NextResponse.json(out, { status: 400 })
  }

  // Kick off proofStore read + Blob media resolution in parallel with
  // the tonapi scan below. All three are independent so waiting for
  // them serially would triple the /proof latency for no reason.
  const [proofRes, mediaRes] = await Promise.all([
    getProofByHash(hash).catch((err) => {
      console.warn('[proof] KV read failed', err); return null
    }),
    resolveCaptureMedia(hash).catch((err) => {
      console.warn('[proof] Blob resolve failed', err)
      return { hasMedia: false, imageUrl: undefined, animationUrl: undefined, posterUrl: undefined }
    }),
  ])
  out.proof = proofRes
  out.media = mediaRes

  // Cross-check on-chain via tonapi. If proof is absent we still try to
  // find the item — this lets /proof/<hash> work for older NFTs that
  // predate the proofStore write path.
  try {
    // Pull the first batch. The collection currently sits at ~30 items;
    // we'll iterate more pages only when the miss happens. Keeps the
    // typical latency at one round-trip.
    let items = await fetchCollectionItems(100, 0)
    let match = findItemByHash(items, hash)
    let offset = 100
    while (!match && items.length === 100 && offset < 1000) {
      items = await fetchCollectionItems(100, offset)
      if (items.length === 0) break
      match = findItemByHash(items, hash)
      offset += 100
    }
    if (match) {
      out.onchain = {
        itemAddress: match.address,
        itemIndex: match.index,
        ownerAddress: match.owner?.address,
        imageUrl: match.metadata?.image,
        animationUrl: match.metadata?.animation_url,
        marketplaceUrl: `https://getgems.io/collection/${COLLECTION}/${match.address}`,
        tonviewerUrl: `https://tonviewer.com/${match.address}`,
      }
    }
  } catch (err) {
    console.warn('[proof] tonapi scan failed', err)
    out.reason = 'on-chain lookup temporarily unavailable'
  }

  out.verified = !!out.onchain?.itemAddress
  if (!out.verified && !out.proof) {
    out.reason = out.reason
      ?? 'no proof record found and on-chain scan yielded no match'
  }

  return NextResponse.json(out, {
    headers: {
      'Cache-Control': 'public, max-age=15, s-maxage=30',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
