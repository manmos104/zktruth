import { NextResponse } from 'next/server'
import { head } from '@vercel/blob'

/**
 * Dynamic TEP-64 offchain metadata for a zkTruth Proof NFT.
 *
 * Each Item minted by the v2 collection contract stores its own URL
 *   https://zktruth.vercel.app/api/nft/item/<sha256-hex>
 * inside `individualContent`. Wallets fetch that URL and expect JSON
 * describing the specific capture — which is what we assemble here.
 *
 * The image URL is resolved by asking Vercel Blob for the metadata of
 * the deterministic key `captures/<sha256-hex>.jpg` (also `.png`).
 * The frontend uploads to that exact key right before it fires the
 * mint tx, so by the time a wallet requests this JSON, the Blob is
 * already published and `head()` returns the public https URL — no
 * env var wrangling required.
 *
 * If Blob returns 404 (upload didn't happen for some reason) we fall
 * back to the generic wordmark so the wallet still renders something
 * instead of a broken tile.
 */

const FALLBACK_IMAGE = 'https://zktruth.vercel.app/zktruth-logo-green.png'

function shortHash(hash: string): string {
  return hash.length > 10 ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : hash
}

async function resolveImageUrl(hash: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return FALLBACK_IMAGE
  // Try jpg first (our default capture format), then png. head() throws
  // on 404, so we swallow and fall through.
  for (const ext of ['jpg', 'png']) {
    try {
      const meta = await head(`captures/${hash}.${ext}`, { token })
      if (meta?.url) return meta.url
    } catch {
      // not found under this extension — try the next one
    }
  }
  return FALLBACK_IMAGE
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash: rawHash } = await params
  // Sanity-check the hash so we don't emit metadata pointing at absurd
  // Blob paths. Accept lowercase 64-char hex; anything else falls back.
  const isValidHash = /^[0-9a-f]{64}$/.test(rawHash)
  const hash = isValidHash ? rawHash : ''

  const image = hash ? await resolveImageUrl(hash) : FALLBACK_IMAGE

  const body = {
    name: hash
      ? `zkTruth Proof #${shortHash(hash)}`
      : 'zkTruth Proof of Capture',
    description:
      'On-chain, tamper-evident proof of a real-world capture. The SHA-256 hash of the captured media is anchored on TON and linked to the original Telegram channel post.',
    image,
    external_url: hash
      ? `https://zktruth.vercel.app/proof/${hash}`
      : 'https://zktruth.vercel.app',
    attributes: [
      { trait_type: 'Protocol', value: 'zkTruth' },
      { trait_type: 'Chain', value: 'TON' },
      { trait_type: 'Standard', value: 'TEP-62' },
      ...(hash ? [{ trait_type: 'Content Hash', value: hash }] : []),
    ],
  }
  return NextResponse.json(body, {
    headers: {
      // Wallets cache metadata aggressively. Keep it warm for CDN but
      // short at the edge so we can iterate without waiting hours.
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  })
}
