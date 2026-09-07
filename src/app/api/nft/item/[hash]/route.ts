import { NextResponse } from 'next/server'
import { getRedis } from '@/lib/trustStore'
import { resolveCaptureMedia } from '@/lib/mediaResolver'

/**
 * Dynamic TEP-64 offchain metadata for a zkTruth Proof NFT.
 *
 * Each Item minted by the v2 collection contract stores its own URL
 *   https://zktruth.vercel.app/api/nft/item/<sha256-hex>
 * inside `individualContent`. Wallets fetch that URL and expect JSON
 * describing the specific capture — which is what we assemble here.
 *
 * The media URL is resolved by asking Vercel Blob for the metadata of
 * a deterministic key. The frontend uploads captured media to
 *   captures/<sha256-hex>.<ext>
 * right before firing the mint tx, so by the time a wallet fetches
 * this JSON, the blob is already published and `head()` returns the
 * public https URL — no BLOB_BASE_URL env wrangling required.
 *
 * Media types handled:
 *   .jpg / .png  → sets `image` to the blob URL
 *   .mp4 / .webm → sets `animation_url` to the blob URL, keeps `image`
 *                  as the fallback logo so wallets that only render
 *                  `image` still have something to show
 *
 * If nothing exists under any extension we fall back to the generic
 * wordmark so the wallet still renders a tile instead of a broken
 * icon.
 */

const FALLBACK_IMAGE = 'https://zktruth.vercel.app/zktruth-logo-green.png'

interface ResolvedMedia {
  image: string
  animation_url?: string
}

function shortHash(hash: string): string {
  return hash.length > 10 ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : hash
}

async function resolveMedia(hash: string): Promise<ResolvedMedia> {
  // Delegates to the shared mediaResolver so this route and the
  // /api/proof/<hash> route always see the same media. Falls back to
  // the wordmark logo when the capture never made it to Blob (early
  // beta records, upload failures).
  const r = await resolveCaptureMedia(hash)
  const resolved: ResolvedMedia = { image: r.imageUrl ?? FALLBACK_IMAGE }
  if (r.animationUrl) resolved.animation_url = r.animationUrl
  return resolved
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

  const media: ResolvedMedia = hash
    ? await resolveMedia(hash)
    : { image: FALLBACK_IMAGE }

  // Attestation lookup — surface Telegram + anomaly + signed C2PA
  // claim state in the NFT attributes so wallets / marketplaces (and
  // Grant reviewers) can see the extra evidence at a glance.
  let attestations: {
    telegramVerified?: boolean
    anomalySeverity?: number
    claimDigest?: string
    claimSignatureB64?: string
  } | null = null
  if (hash) {
    try {
      const r = getRedis()
      const rec = await r.get<{
        claim?: { digestHex?: string; signatureB64?: string }
        anomaly?: { severity?: number }
        telegramVerified?: boolean
      }>(`claim:${hash}`)
      if (rec) {
        attestations = {
          telegramVerified: !!rec.telegramVerified,
          anomalySeverity: rec.anomaly?.severity,
          claimDigest: rec.claim?.digestHex,
          claimSignatureB64: rec.claim?.signatureB64,
        }
      }
    } catch { /* cold KV — skip attestation attrs */ }
  }

  const body: Record<string, unknown> = {
    name: hash
      ? `zkTruth Proof #${shortHash(hash)}`
      : 'zkTruth Proof of Capture',
    description:
      'On-chain, tamper-evident proof of a real-world capture. The SHA-256 hash of the captured media is anchored on TON and linked to the original Telegram channel post.',
    image: media.image,
    // Alternate media fields for wallets that don't parse animation_url
    // yet. Getgems / newer Tonkeeper look at `content_url` and `media`,
    // Ecosystem NFT viewers (tonviewer, tonapi) prefer `preview` for
    // stills and check every listed field for playable media. Emit all
    // of them so we degrade gracefully across the fragmented tooling.
    ...(media.animation_url
      ? {
          content_url: media.animation_url,
          media: media.animation_url,
          preview: media.image,
        }
      : {}),
    external_url: hash
      ? `https://zktruth.vercel.app/proof/${hash}`
      : 'https://zktruth.vercel.app',
    attributes: [
      { trait_type: 'Protocol', value: 'zkTruth' },
      { trait_type: 'Chain', value: 'TON' },
      { trait_type: 'Standard', value: 'TEP-62' },
      ...(hash ? [{ trait_type: 'Content Hash', value: hash }] : []),
      ...(attestations
        ? [
            { trait_type: 'Telegram Verified', value: attestations.telegramVerified ? 'Yes' : 'No' },
            {
              trait_type: 'Anomaly Severity',
              value: typeof attestations.anomalySeverity === 'number'
                ? attestations.anomalySeverity
                : 'Unknown',
            },
            ...(attestations.claimDigest
              ? [{ trait_type: 'C2PA Claim Digest', value: attestations.claimDigest }]
              : []),
          ]
        : []),
    ],
  }
  if (media.animation_url) body.animation_url = media.animation_url

  return NextResponse.json(body, {
    headers: {
      // Wallets cache metadata aggressively. Keep it warm for CDN but
      // short at the edge so we can iterate without waiting hours.
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      // CORS wide open — TON wallet indexers fetch metadata from
      // untrusted origins and skip anything without permissive CORS.
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  })
}

// Preflight support so browser-based indexers (like Getgems) don't
// choke on OPTIONS probes when checking cross-origin availability.
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  })
}
