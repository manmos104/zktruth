// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title zkTruth — Proof of Capture NFT
 * @notice Mints immutable proof records for authenticated media captures
 * @dev ERC-721 on World Chain (Chain ID: 480)
 */
contract ZkTruthProof is ERC721, Ownable {

    // ============================================================
    //  Data Structures
    // ============================================================

    struct CaptureProof {
        bytes32 contentHash;       // SHA-256 hash of original media
        bytes32 gpsHash;           // Hashed GPS coordinates (privacy)
        bytes32 nullifierHash;     // World ID nullifier (ZKP verified)
        uint256 timestamp;         // Capture timestamp (UTC)
        uint8 verificationLevel;   // 0: unverified, 1: device, 2: orb
        uint8 mediaType;           // 0: photo, 1: video
    }

    // ============================================================
    //  State
    // ============================================================

    uint256 private _nextTokenId;

    /// @notice Token ID → Capture Proof data
    mapping(uint256 => CaptureProof) public proofs;

    /// @notice Content hash → Token ID (prevents duplicate minting)
    mapping(bytes32 => uint256) public contentHashToTokenId;

    /// @notice Whether a nullifier has been used (Sybil resistance)
    mapping(bytes32 => bool) public nullifierUsed;

    /// @notice Gas fee for unverified mints (in WLD wei)
    uint256 public unverifiedMintFee;

    // ============================================================
    //  Events
    // ============================================================

    event ProofMinted(
        uint256 indexed tokenId,
        address indexed minter,
        bytes32 contentHash,
        uint8 verificationLevel,
        uint8 mediaType,
        uint256 timestamp
    );

    event MintFeeUpdated(uint256 newFee);

    // ============================================================
    //  Errors
    // ============================================================

    error ContentAlreadyMinted(bytes32 contentHash, uint256 existingTokenId);
    error InvalidContentHash();
    error InsufficientFee(uint256 required, uint256 sent);
    error NullifierAlreadyUsed(bytes32 nullifierHash);

    // ============================================================
    //  Constructor
    // ============================================================

    constructor() ERC721("zkTruth Proof of Capture", "ZKPROOF") Ownable(msg.sender) {
        _nextTokenId = 1;
        unverifiedMintFee = 0; // Free initially, can be set by owner
    }

    // ============================================================
    //  Core: Mint Proof (Verified — World ID)
    // ============================================================

    /**
     * @notice Mint a verified proof (gasless for World ID verified users)
     * @param contentHash SHA-256 hash of the captured media
     * @param gpsHash Hashed GPS coordinates
     * @param nullifierHash World ID nullifier hash
     * @param captureTimestamp UTC timestamp of capture
     * @param mediaType 0 = photo, 1 = video
     */
    function mintVerifiedProof(
        bytes32 contentHash,
        bytes32 gpsHash,
        bytes32 nullifierHash,
        uint256 captureTimestamp,
        uint8 mediaType
    ) external returns (uint256) {
        // Validate
        if (contentHash == bytes32(0)) revert InvalidContentHash();
        if (contentHashToTokenId[contentHash] != 0) {
            revert ContentAlreadyMinted(contentHash, contentHashToTokenId[contentHash]);
        }
        if (nullifierHash != bytes32(0) && nullifierUsed[nullifierHash]) {
            revert NullifierAlreadyUsed(nullifierHash);
        }

        // Mint
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        // Store proof
        proofs[tokenId] = CaptureProof({
            contentHash: contentHash,
            gpsHash: gpsHash,
            nullifierHash: nullifierHash,
            timestamp: captureTimestamp,
            verificationLevel: 2, // Orb-verified
            mediaType: mediaType
        });

        // Index
        contentHashToTokenId[contentHash] = tokenId;
        if (nullifierHash != bytes32(0)) {
            nullifierUsed[nullifierHash] = true;
        }

        emit ProofMinted(tokenId, msg.sender, contentHash, 2, mediaType, captureTimestamp);
        return tokenId;
    }

    // ============================================================
    //  Core: Mint Proof (Unverified — Pay Gas)
    // ============================================================

    /**
     * @notice Mint an unverified proof (requires fee payment)
     * @param contentHash SHA-256 hash of the captured media
     * @param gpsHash Hashed GPS coordinates
     * @param captureTimestamp UTC timestamp of capture
     * @param mediaType 0 = photo, 1 = video
     */
    function mintUnverifiedProof(
        bytes32 contentHash,
        bytes32 gpsHash,
        uint256 captureTimestamp,
        uint8 mediaType
    ) external payable returns (uint256) {
        // Validate
        if (contentHash == bytes32(0)) revert InvalidContentHash();
        if (contentHashToTokenId[contentHash] != 0) {
            revert ContentAlreadyMinted(contentHash, contentHashToTokenId[contentHash]);
        }
        if (unverifiedMintFee > 0 && msg.value < unverifiedMintFee) {
            revert InsufficientFee(unverifiedMintFee, msg.value);
        }

        // Mint
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        // Store proof
        proofs[tokenId] = CaptureProof({
            contentHash: contentHash,
            gpsHash: gpsHash,
            nullifierHash: bytes32(0),
            timestamp: captureTimestamp,
            verificationLevel: 0, // Unverified
            mediaType: mediaType
        });

        // Index
        contentHashToTokenId[contentHash] = tokenId;

        emit ProofMinted(tokenId, msg.sender, contentHash, 0, mediaType, captureTimestamp);
        return tokenId;
    }

    // ============================================================
    //  View Functions
    // ============================================================

    /**
     * @notice Get full proof data for a token
     */
    function getProof(uint256 tokenId) external view returns (CaptureProof memory) {
        require(tokenId > 0 && tokenId < _nextTokenId, "Token does not exist");
        return proofs[tokenId];
    }

    /**
     * @notice Verify a content hash exists on-chain
     * @return tokenId The token ID (0 if not found)
     */
    function verifyContent(bytes32 contentHash) external view returns (uint256) {
        return contentHashToTokenId[contentHash];
    }

    /**
     * @notice Get the total number of proofs minted
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // ============================================================
    //  Admin Functions
    // ============================================================

    /**
     * @notice Update the fee for unverified mints
     */
    function setUnverifiedMintFee(uint256 newFee) external onlyOwner {
        unverifiedMintFee = newFee;
        emit MintFeeUpdated(newFee);
    }

    /**
     * @notice Withdraw collected fees
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdraw failed");
    }
}
