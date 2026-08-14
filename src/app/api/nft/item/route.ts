import { NextResponse } from 'next/server'

/**
 * TEP-64 offchain metadata for a zkTruth Proof NFT Item.
 *
 * The contract stores only the collection-level `itemContentPrefix`
 * ("https://zktruth.vercel.app/api/nft/item/") inside each Item's
 * content cell. Wallets that follow TEP-64 fetch that exact URL and
 * expect a JSON body describing the NFT — that's what this handler
 * returns.
 *
 * Because the contract does not yet append a per-item identifier
 * (contentHash) to the URL, every Item currently resolves to this
 * same generic metadata. That's enough to make the wallet render a
 * proper name, description, and image instead of a blank tile. When
 * we upgrade the contract to bake contentHash into individual_content,
 * we'll add a `[hash]` dynamic segment here that returns per-capture
 * metadata (with the actual photo URL).
 */
export async function GET() {
  const body = {
    name: 'zkTruth Proof of Capture',
    description:
      'On-chain, tamper-evident proof of a real-world capture — anchored to a Telegram channel post and verified by the zkTruth Mini App on TON.',
    image: 'https://zktruth.vercel.app/zktruth-logo-green.png',
    external_url: 'https://zktruth.vercel.app',
    attributes: [
      { trait_type: 'Protocol', value: 'zkTruth' },
      { trait_type: 'Chain', value: 'TON' },
      { trait_type: 'Standard', value: 'TEP-62' },
    ],
  }
  return NextResponse.json(body, {
    headers: {
      // Wallets cache metadata aggressively; keep it warm but short
      // enough that we can iterate on the JSON without redeploying.
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  })
}
