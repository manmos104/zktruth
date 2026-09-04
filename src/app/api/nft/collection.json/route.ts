import { NextResponse } from 'next/server'

/**
 * TEP-64 offchain metadata for the zkTruth NFT Collection contract.
 *
 * The contract's `collectionContent` cell points at
 *   https://zktruth.vercel.app/api/nft/collection.json
 * — wallets and marketplaces fetch that URL and expect a JSON body
 * describing the collection's name, cover art, and description.
 *
 * We deliberately over-populate this response (social_links, marketing
 * copy, verified fields) because TON's NFT indexers — tonapi, Getgems,
 * tonviewer — treat sparse metadata as a spam signal and dump the
 * collection into their "SCAM" bucket, which then propagates to
 * Tonkeeper's default view. Rich, matching metadata is the cheapest
 * lever we have to move the collection out of that bucket.
 */
export async function GET() {
  const body = {
    name: 'zkTruth · Proof of Capture',
    description:
      'zkTruth turns every real-world capture into an on-chain, tamper-evident proof anchored on TON. Each NFT records the SHA-256 hash of a photo or video, the capture timestamp, GPS coordinates, and the Telegram channel post it was published in. Minted through the zkTruth Mini App on Telegram; verifiable by anyone via the zkTruth verification endpoint.',
    // Purpose-built assets: a 512×512 square avatar for wallet/tile
    // display, plus a 1200×400 banner for Getgems/tonviewer covers.
    // Feeding indexers the correctly-sized artwork avoids the auto-
    // crop that turned the wide wordmark into a "zkTr" fragment.
    image: 'https://zktruth.vercel.app/zktruth-avatar-512.png',
    cover_image: 'https://zktruth.vercel.app/zktruth-banner-1200x400.png',
    banner: 'https://zktruth.vercel.app/zktruth-banner-1200x400.png',
    external_link: 'https://zktruth.vercel.app',
    external_url: 'https://zktruth.vercel.app',
    marketplace: 'https://t.me/zktruth_bot/capture',
    // Contact + provenance hints. tonapi's spam filter downgrades
    // collections that don't expose a way to reach the team.
    social_links: [
      'https://t.me/zktruth_bot',
      'https://zktruth.vercel.app',
    ],
    // Attribution fields consumed by Getgems / tonviewer to render
    // "verified by" chips and de-scam checks.
    author: 'zkTruth',
    author_link: 'https://t.me/zktruth_bot',
    verified: false,
    // Explicit content policy so indexers don't treat proof captures
    // as user-generated spam.
    content_policy:
      'Every NFT is a cryptographic proof of a real-world capture. Content-address (SHA-256) uniqueness is enforced by the smart contract; media is stored in content-addressed public storage.',
    attributes: [
      { trait_type: 'Chain', value: 'TON' },
      { trait_type: 'Standard', value: 'TEP-62' },
      { trait_type: 'Attestation', value: 'Ed25519 + Telegram initData' },
    ],
  }
  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  })
}

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
