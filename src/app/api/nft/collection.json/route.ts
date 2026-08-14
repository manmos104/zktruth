import { NextResponse } from 'next/server'

/**
 * TEP-64 offchain metadata for the zkTruth NFT Collection contract.
 *
 * The contract's `collectionContent` cell points at
 *   https://zktruth.vercel.app/api/nft/collection.json
 * — wallets and marketplaces fetch that URL and expect a JSON body
 * describing the collection's name, cover art, and description.
 */
export async function GET() {
  const body = {
    name: 'zkTruth Proof of Capture',
    description:
      'A collection of on-chain, tamper-evident proofs of real-world captures. Each NFT is anchored to a Telegram channel post and minted through the zkTruth Mini App on TON.',
    image: 'https://zktruth.vercel.app/zktruth-logo-green.png',
    cover_image: 'https://zktruth.vercel.app/zktruth-logo-green.png',
    external_link: 'https://zktruth.vercel.app',
    social_links: [],
  }
  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  })
}
