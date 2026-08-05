# zkTruth TON contracts

TEP-62 NFT collection for the zkTruth Proof of Capture app. Sub-project isolated from the Next.js app because Blueprint + Tact ship their own toolchain that would otherwise fight `next build`.

## Contracts

- `contracts/zktruth_collection.tact` — parent NFT collection. Deployed once. Receives `MintProof` messages from users, forwards the service fee to `treasury`, deploys a new `ZkTruthNftItem` for each capture.
- `contracts/zktruth_nft_item.tact` — one instance per NFT. Stores the SHA-256 content hash, GPS hash, capture timestamp, author wallet, and Telegram channel message id. Standard TEP-62 transfer/get_static_data support so it renders in Tonkeeper/MyTonWallet.

Fee split (default `MINT_PRICE = 0.15 TON`):
- `0.05 TON` gas + storage for the new item contract
- `0.10 TON` service fee → treasury wallet (`UQCOSu2zabkXTGWRMMLqDSx8k2hY-sxtEA1xIhGuKt1vvhHo`)

## First-time setup

```bash
cd ton
npm install
```

## Build

```bash
npm run build
```

Compiled contract code lands in `build/`. Blueprint auto-regenerates wrappers under `wrappers/` from the Tact ABI.

## Deploy — testnet (dry run)

Grab a few testnet TON from https://t.me/testgiver_ton_bot then:

```bash
npm run deploy:collection:testnet
```

Blueprint will prompt for a wallet. Pick **TON Connect compatible mobile wallet** and scan the QR from Tonkeeper (or the Wallet in Telegram) after switching that wallet to **testnet mode**. The deploy tx is signed on-device and sent — Blueprint prints the resulting collection address + a tonviewer link.

## Deploy — mainnet

Real TON, real deployment. Costs ≈ 0.5 TON.

```bash
npm run deploy:collection:mainnet
```

## After deployment

1. Copy the printed `Collection address` (starts with `EQ...` or `UQ...`).
2. Add to `zktruth/.env.local`:

   ```
   NEXT_PUBLIC_TON_COLLECTION_ADDRESS=EQ...
   ```

3. Also add the same key/value to Vercel env vars (all environments, Sensitive: OFF).
4. Redeploy the Next.js app so the frontend picks up the new address.

## Rotating the treasury / metadata

Every knob is behind an owner-only message on the collection:

- `UpdateCollectionContent { newContent: Cell }` — change the collection JSON URL
- `UpdateItemContentPrefix { newContent: Cell }` — change the per-item metadata URL prefix
- `UpdateTreasury { newTreasury: Address }` — send the service fee somewhere else
- `ChangeOwner { newOwner: Address }` — from the Ownable trait, hand off admin

Wrap these into small scripts under `scripts/` when needed.
