// ============================================================================
// zkTruth NFT Item (TEP-62 compliant)
// ---------------------------------------------------------------------------
// Deployed by the ZkTruthCollection contract, one per capture. Holds the
// immutable capture metadata plus standard TEP-62 fields so wallets like
// Tonkeeper and MyTonWallet render it as a real NFT.
// ============================================================================

import "@stdlib/deploy";

message InitProof {
    queryId: Int as uint64;
    ownerAddress: Address;
    content: Cell;
    contentHash: Int;
    gpsHash: Int;
    captureTimestamp: Int as uint64;
    telegramMessageId: Int as uint64;
}

message Transfer {
    queryId: Int as uint64;
    newOwner: Address;
    responseDestination: Address;
    customPayload: Cell?;
    forwardAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message OwnershipAssigned {
    queryId: Int as uint64;
    prevOwner: Address;
    forwardPayload: Slice as remaining;
}

message GetStaticData {
    queryId: Int as uint64;
}

message ReportStaticData {
    queryId: Int as uint64;
    index: Int;
    collection: Address;
}

struct NftData {
    init: Bool;
    index: Int;
    collectionAddress: Address;
    ownerAddress: Address;
    individualContent: Cell;
}

// zkTruth-specific getter payload — lets the frontend query capture
// metadata without stitching together a URI parse.
struct ProofData {
    contentHash: Int;
    gpsHash: Int;
    captureTimestamp: Int;
    telegramMessageId: Int;
    author: Address;
}

contract ZkTruthNftItem with Deployable {
    collectionAddress: Address;
    itemIndex: Int as uint32;
    owner: Address;
    individualContent: Cell;
    contentHash: Int as uint256;
    gpsHash: Int as uint256;
    captureTimestamp: Int as uint64;
    telegramMessageId: Int as uint64;
    initialized: Bool;

    init(collectionAddress: Address, itemIndex: Int) {
        self.collectionAddress = collectionAddress;
        self.itemIndex = itemIndex;
        self.owner = collectionAddress;
        self.individualContent = emptyCell();
        self.contentHash = 0;
        self.gpsHash = 0;
        self.captureTimestamp = 0;
        self.telegramMessageId = 0;
        self.initialized = false;
    }

    // ----- Initialisation ---------------------------------------------------
    // Only the parent collection can send this message. It flips the item
    // from an empty shell into a full proof record.
    receive(msg: InitProof) {
        require(!self.initialized, "Already initialised");
        require(sender() == self.collectionAddress, "Only collection may init");
        self.owner = msg.ownerAddress;
        self.individualContent = msg.content;
        self.contentHash = msg.contentHash;
        self.gpsHash = msg.gpsHash;
        self.captureTimestamp = msg.captureTimestamp;
        self.telegramMessageId = msg.telegramMessageId;
        self.initialized = true;
    }

    // ----- TEP-62 transfer -------------------------------------------------
    receive(msg: Transfer) {
        require(self.initialized, "Not initialised yet");
        require(sender() == self.owner, "Only current owner may transfer");
        let prevOwner: Address = self.owner;
        self.owner = msg.newOwner;

        // Notify the new owner if requested (forwardAmount > 0).
        if (msg.forwardAmount > 0) {
            send(SendParameters{
                to: msg.newOwner,
                value: msg.forwardAmount,
                mode: SendPayGasSeparately,
                bounce: false,
                body: OwnershipAssigned{
                    queryId: msg.queryId,
                    prevOwner: prevOwner,
                    forwardPayload: msg.forwardPayload,
                }.toCell(),
            });
        }

        // Refund the rest to the responseDestination (usually the sender).
        nativeReserve(myBalance() - context().value, ReserveExact);
        send(SendParameters{
            to: msg.responseDestination,
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
        });
    }

    // TEP-62 static data query — used by explorers to render the NFT card.
    receive(msg: GetStaticData) {
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: ReportStaticData{
                queryId: msg.queryId,
                index: self.itemIndex,
                collection: self.collectionAddress,
            }.toCell(),
        });
    }

    // ----- Getters ---------------------------------------------------------
    get fun get_nft_data(): NftData {
        return NftData{
            init: self.initialized,
            index: self.itemIndex,
            collectionAddress: self.collectionAddress,
            ownerAddress: self.owner,
            individualContent: self.individualContent,
        };
    }

    // zkTruth-specific view — one call to get every capture attribute.
    get fun get_proof_data(): ProofData {
        return ProofData{
            contentHash: self.contentHash,
            gpsHash: self.gpsHash,
            captureTimestamp: self.captureTimestamp,
            telegramMessageId: self.telegramMessageId,
            author: self.owner,
        };
    }
}
