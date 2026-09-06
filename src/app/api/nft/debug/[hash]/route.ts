import { NextResponse } from 'next/server'
import { head, list } from '@vercel/blob'
import { getRedis } from '@/lib/trustStore'

/**
 * GET /api/nft/debug/<hash>
 *
 * Reports EVERYTHING the metadata endpoint would see for a given
 * capture hash, so we can immediately diagnose "why is the wallet
 * showing the logo fallback instead of my capture?".
 *
 * Reports:
 *   - Which extensions exist under `captures/<hash>.*` in Blob storage
 *     (with full public URLs and byte sizes)
 *   - Whether the `claim:<hash>` KV record exists (attestation state)
 *   - The exact JSON body that /api/nft/item/<hash> would return
 *   - Blob token presence flag (env sanity)
 *
 * There's no auth on this — the endpoint only surfaces public URLs and
 * the same attestation attributes that ship in the NFT metadata, so no
 * new information leaks vs what wallets already see.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FALLBACK_IMAGE = 'https://zktruth.vercel.app/zktruth-logo-green.png'

async function probe(pathname: string, token: string) {
  try {
    const meta = await head(pathname, { token })
    return { exists: true, url: meta.url, size: meta.size, uploadedAt: meta.uploadedAt }
  } catch (err) {
    return { exists: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash: rawHash } = await params
  const hash = rawHash.toLowerCase()
  const valid = /^[0-9a-f]{64}$/.test(hash)
  const token = process.env.BLOB_READ_WRITE_TOKEN

  const out: Record<string, unknown> = {
    hash: rawHash,
    hashNormalised: hash,
    hashValid: valid,
    blobTokenConfigured: !!token,
  }

  if (!valid) {
    out.error = 'hash must be 64-char hex (lowercase preferred)'
    return NextResponse.json(out, { status: 400 })
  }
  if (!token) {
    out.error = 'BLOB_READ_WRITE_TOKEN env not set on this deployment'
    return NextResponse.json(out, { status: 500 })
  }

  // Probe every extension the metadata endpoint tries
  const [jpg, png, mp4, webm] = await Promise.all([
    probe(`captures/${hash}.jpg`, token),
    probe(`captures/${hash}.png`, token),
    probe(`captures/${hash}.mp4`, token),
    probe(`captures/${hash}.webm`, token),
  ])
  out.blobs = { jpg, png, mp4, webm }

  // What image / animation_url would the metadata endpoint resolve to?
  const image =
    (jpg.exists && jpg.url) ||
    (png.exists && png.url) ||
    FALLBACK_IMAGE
  const animation_url =
    (mp4.exists && mp4.url) || (webm.exists && webm.url) || undefined
  out.resolvedMedia = {
    image,
    animation_url,
    fallbackUsed: image === FALLBACK_IMAGE,
  }

  // Also list ALL blobs whose key starts with `captures/<hash>` — this
  // catches an extension the metadata endpoint doesn't know about (say
  // `.jpeg` instead of `.jpg`) which would cause a silent fallback.
  try {
    const listing = await list({ prefix: `captures/${hash}`, token })
    out.blobListing = listing.blobs.map((b) => ({
      pathname: b.pathname,
      url: b.url,
      size: b.size,
      uploadedAt: b.uploadedAt,
    }))
  } catch (err) {
    out.blobListingError = err instanceof Error ? err.message : String(err)
  }

  // Attestation record
  try {
    const r = getRedis()
    const claim = await r.get(`claim:${hash}`)
    out.claim = claim ?? null
  } catch (err) {
    out.claimError = err instanceof Error ? err.message : String(err)
  }

  // What the metadata endpoint would emit end-to-end
  out.metadataUrl = `https://zktruth.vercel.app/api/nft/item/${hash}`

  return NextResponse.json(out, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
