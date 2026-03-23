export const ZKTRUTH_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000"; // TODO: Replace after deployment

export const ZKTRUTH_ABI = [
  // Verified Minting
  {
    inputs: [
      { name: "contentHash", type: "bytes32" },
      { name: "gpsHash", type: "bytes32" },
      { name: "nullifierHash", type: "bytes32" },
      { name: "captureTimestamp", type: "uint256" },
      { name: "mediaType", type: "uint8" },
    ],
    name: "mintVerifiedProof",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Unverified Minting
  {
    inputs: [
      { name: "contentHash", type: "bytes32" },
      { name: "gpsHash", type: "bytes32" },
      { name: "captureTimestamp", type: "uint256" },
      { name: "mediaType", type: "uint8" },
    ],
    name: "mintUnverifiedProof",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  // Get Proof
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getProof",
    outputs: [
      {
        components: [
          { name: "contentHash", type: "bytes32" },
          { name: "gpsHash", type: "bytes32" },
          { name: "nullifierHash", type: "bytes32" },
          { name: "timestamp", type: "uint256" },
          { name: "verificationLevel", type: "uint8" },
          { name: "mediaType", type: "uint8" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  // Verify Content
  {
    inputs: [{ name: "contentHash", type: "bytes32" }],
    name: "verifyContent",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Total Supply
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Unverified Mint Fee
  {
    inputs: [],
    name: "unverifiedMintFee",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "tokenId", type: "uint256" },
      { indexed: true, name: "minter", type: "address" },
      { indexed: false, name: "contentHash", type: "bytes32" },
      { indexed: false, name: "verificationLevel", type: "uint8" },
      { indexed: false, name: "mediaType", type: "uint8" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    name: "ProofMinted",
    type: "event",
  },
] as const;
