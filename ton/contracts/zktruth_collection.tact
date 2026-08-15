// ============================================================================
// zkTruth NFT Collection (TEP-62 compliant)
// ---------------------------------------------------------------------------
// Deploys a new NFT Item contract for every zkTruth capture the user mints
// on-chain. Each Item stores the SHA-256 content hash of the capture, an
// optional GPS hash, the capture timestamp, the original author's wallet
// address, and the Telegram channel message id so anyone can trace an NFT
// back to its channel post.
//
// Payment model
// -------------
//   User sends >= MINT_PRICE (default 0.15 TON). Breakdown:
//     0.05 TON — gas + storage for the new NFT Item contract
//     0.10 TON — service fee, forwarded to `treasury` (the deployer's wallet)
//
// If less than MINT_PRICE arrives, the message reverts and the sender's
// wallet gets its TON back.
// ============================================================================

import "@stdlib/deploy";
import "@stdlib/ownable";
import "./zktruth_nft_item";

// The full 0.15 TON that the user must attach when calling `mint`.
const MINT_PRICE: Int = ton("0.15");
// Amount forwarded to the newly-deployed NFT Item contract to cover its
// deployment gas + one-off storage. Any leftover is refunded to the item.
const ITEM_GAS: Int = ton("0.03");
// Amount reserved for the collection contract's own execution gas.
const COLLECTION_GAS: Int = ton("0.02");

// Payload sent by the user's wallet to mint a new proof NFT. Carries every
// scrap of metadata we want to lock on-chain forever.
message MintProof {
    contentHash: Int;         // 256-bit SHA-256 of the captured media
    gpsHash: Int;             // 256-bit hash of GPS coords (0 if opted out)
    captureTimestamp: Int as uint64;
    telegramMessageId: Int as uint64;  // channel message id for the post
    // TEP-64 offchain content cell built by the frontend. Encodes the
    // per-item metadata URL (e.g. https://zktruth.vercel.app/api/nft/item/<hex-hash>).
    // Building it client-side sidesteps Tact's lack of Int→hex conversion.
    individualContent: Cell;
}

// Standard TEP-62 collection data getter response.
struct CollectionData {
    nextItemIndex: Int;
    content: Cell;
    ownerAddress: Address;
}

// Standard TEP-62 royalty params response.
struct RoyaltyParams {
    numerator: Int;
    denominator: Int;
    destination: Address;
}

contract ZkTruthCollection with Deployable, Ownable {
    owner: Address;                // the deployer, can change parameters
    treasury: Address;             // where the 0.10 TON fee flows
    nextItemIndex: Int as uint32;
    collectionContent: Cell;       // TEP-64 pointer to collection metadata
    itemContentPrefix: Cell;       // prepended to every item's content_uri

    init(owner: Address, treasury: Address, collectionContent: Cell, itemContentPrefix: Cell) {
        self.owner = owner;
        self.treasury = treasury;
        self.nextItemIndex = 0;
        self.collectionContent = collectionContent;
        self.itemContentPrefix = itemContentPrefix;
    }

    // ----- Mint entry point -------------------------------------------------
    // Anyone can call this. Requires MINT_PRICE (0.15 TON) attached.
    receive(msg: MintProof) {
        let ctx: Context = context();
        require(ctx.value >= MINT_PRICE, "Insufficient payment. Requires 0.15 TON.");

        let itemIndex: Int = self.nextItemIndex;
        self.nextItemIndex = itemIndex + 1;

        // Deploy the NFT Item. Its address is deterministic (StateInit-based)
        // so callers can compute it off-chain without waiting for a receipt.
        let itemInit: StateInit = initOf ZkTruthNftItem(myAddress(), itemIndex);
        let itemAddress: Address = contractAddress(itemInit);

        // 1) Forward the service fee to the treasury BEFORE deploying the
        //    item — that way if the item deployment fails for any reason,
        //    the fee has already been captured.
        let serviceFee: Int = MINT_PRICE - ITEM_GAS - COLLECTION_GAS;
        send(SendParameters{
            to: self.treasury,
            value: serviceFee,
            mode: SendPayGasSeparately,
            body: "zkTruth mint fee".asComment(),
        });

        // 2) Deploy the NFT Item with the metadata baked in.
        send(SendParameters{
            to: itemAddress,
            value: ITEM_GAS,
            mode: SendPayGasSeparately,
            code: itemInit.code,
            data: itemInit.data,
            body: InitProof{
                queryId: 0,
                ownerAddress: ctx.sender,
                content: msg.individualContent,
                contentHash: msg.contentHash,
                gpsHash: msg.gpsHash,
                captureTimestamp: msg.captureTimestamp,
                telegramMessageId: msg.telegramMessageId,
            }.toCell(),
        });
    }

    // ----- Owner-only knobs -------------------------------------------------
    // Lets the deployer point the collection metadata elsewhere (e.g. after
    // uploading updated artwork). Ownership can be transferred via the
    // Ownable trait's built-in ChangeOwner message.
    receive(msg: UpdateCollectionContent) {
        self.requireOwner();
        self.collectionContent = msg.newContent;
    }
    receive(msg: UpdateItemContentPrefix) {
        self.requireOwner();
        self.itemContentPrefix = msg.newContent;
    }
    receive(msg: UpdateTreasury) {
        self.requireOwner();
        self.treasury = msg.newTreasury;
    }

    // ----- TEP-62 getters --------------------------------------------------
    get fun get_collection_data(): CollectionData {
        return CollectionData{
            nextItemIndex: self.nextItemIndex,
            content: self.collectionContent,
            ownerAddress: self.owner,
        };
    }

    get fun get_nft_address_by_index(index: Int): Address {
        let itemInit: StateInit = initOf ZkTruthNftItem(myAddress(), index);
        return contractAddress(itemInit);
    }

    get fun get_nft_content(index: Int, individual_content: Cell): Cell {
        // Each NFT Item stores its FULL metadata URL in its own
        // individual_content cell — that's what the frontend passes
        // when it calls MintProof. We just pass it through here so
        // wallets/marketplaces reading the collection also see the
        // per-item URL directly. Avoids the string-concat gymnastics
        // that Tact's stdlib doesn't cleanly support.
        return individual_content;
    }

    get fun royalty_params(): RoyaltyParams {
        // No secondary-market royalty for now. If the collection ever gets
        // listed on Getgems etc. we can turn this into 5% back to treasury
        // via an UpdateRoyalty message + a self.royalty stored field.
        return RoyaltyParams{
            numerator: 0,
            denominator: 100,
            destination: self.treasury,
        };
    }

    // Convenience getters unique to zkTruth for the Web frontend.
    get fun mint_price(): Int { return MINT_PRICE; }
    get fun treasury(): Address { return self.treasury; }
}

message UpdateCollectionContent { newContent: Cell; }
message UpdateItemContentPrefix { newContent: Cell; }
message UpdateTreasury { newTreasury: Address; }
