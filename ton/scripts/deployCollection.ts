/**
 * Deploy the zkTruth NFT collection to TON.
 *
 * Usage
 * -----
 *   npm run deploy:collection:testnet   # dry-run on TON testnet (free faucet TON)
 *   npm run deploy:collection:mainnet   # real deploy, spends ~0.5 TON
 *
 * On first run Blueprint prompts for a wallet: pick "Tonkeeper" or
 * "TON Connect compatible mobile wallet" and scan the QR from your
 * phone. Blueprint then signs & sends the collection deployment tx
 * with your wallet — no private key ever touches disk.
 *
 * After deployment the script prints the collection contract address
 * along with a tonviewer.com link. Save that address into the Next.js
 * env as `NEXT_PUBLIC_TON_COLLECTION_ADDRESS`; the frontend uses it
 * to point mint transactions at the right contract.
 */

import { Address, beginCell, toNano } from '@ton/core'
import { NetworkProvider } from '@ton/blueprint'
import { ZkTruthCollection } from '../wrappers/ZkTruthCollection'

// Treasury = the wallet that receives the 0.10 TON service fee on every
// mint. Locked in at deploy time; can be rotated later via the
// UpdateTreasury message the contract exposes.
const TREASURY_ADDRESS = 'UQCOSu2zabkXTGWRMMLqDSx8k2hY-sxtEA1xIhGuKt1vvhHo'

// Collection metadata pointer. TEP-64 offchain style — a base URL that
// resolves to a JSON blob describing the collection (name, cover art,
// description). We host this at the public Vercel deploy so it can be
// updated without touching the contract.
const COLLECTION_CONTENT_URI = 'https://zktruth.vercel.app/api/nft/collection.json'
// Prefix concatenated with each item's individual content string to
// build the full metadata URL. See the collection's `get_nft_content`
// getter for the join logic.
const ITEM_CONTENT_PREFIX = 'https://zktruth.vercel.app/api/nft/item/'

function encodeOffchainContent(uri: string) {
  // TEP-64 offchain content: single byte prefix 0x01 followed by the
  // ASCII bytes of the URI. Stored as a Cell so contracts can carry
  // it around without allocating dictionaries.
  return beginCell()
    .storeUint(0x01, 8)
    .storeStringTail(uri)
    .endCell()
}

export async function run(provider: NetworkProvider) {
  const ui = provider.ui()

  const treasury = Address.parse(TREASURY_ADDRESS)
  const collectionContent = encodeOffchainContent(COLLECTION_CONTENT_URI)
  const itemContentPrefix = encodeOffchainContent(ITEM_CONTENT_PREFIX)

  ui.write('')
  ui.write('=== zkTruth Collection Deployment ===')
  ui.write(`Owner       : ${provider.sender().address?.toString()}`)
  ui.write(`Treasury    : ${treasury.toString()}`)
  ui.write(`Collection  : ${COLLECTION_CONTENT_URI}`)
  ui.write(`Item prefix : ${ITEM_CONTENT_PREFIX}`)
  ui.write('')

  const collection = provider.open(
    await ZkTruthCollection.fromInit(
      provider.sender().address!,
      treasury,
      collectionContent,
      itemContentPrefix,
    ),
  )

  // Send the deploy transaction. 0.5 TON is enough for the code+data
  // deployment plus the first ~5 years of storage rent at current
  // TON economics; the contract keeps whatever it doesn't burn.
  await collection.send(
    provider.sender(),
    { value: toNano('0.5') },
    { $$type: 'Deploy', queryId: 0n },
  )

  ui.write('Deploy transaction sent — waiting for confirmation...')
  await provider.waitForDeploy(collection.address, 30)

  ui.write('')
  ui.write('=== Deployed ===')
  ui.write(`Collection address : ${collection.address.toString()}`)
  ui.write(
    `Explorer           : https://${
      (provider.network() as string) === 'testnet' ? 'testnet.' : ''
    }tonviewer.com/${collection.address.toString()}`,
  )
  ui.write('')
  ui.write('Add this to zktruth/.env.local (and Vercel env vars):')
  ui.write(`  NEXT_PUBLIC_TON_COLLECTION_ADDRESS=${collection.address.toString()}`)
}
