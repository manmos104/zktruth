'use client'

import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { keccak256, toHex, encodeAbiParameters, parseAbiParameters } from 'viem'
import { ZKTRUTH_CONTRACT_ADDRESS, ZKTRUTH_ABI } from './contract'

// Helper: Convert string to bytes32 hash
export function toBytes32Hash(data: string): `0x${string}` {
  return keccak256(toHex(data))
}

// Helper: Convert GPS string to hashed bytes32
export function hashGps(lat: number, lon: number): `0x${string}` {
  return keccak256(toHex(`${lat.toFixed(6)},${lon.toFixed(6)}`))
}

// Hook: Mint Verified Proof (World ID verified)
export function useMintVerifiedProof() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const mint = async ({
    contentHash,
    gpsHash,
    nullifierHash,
    captureTimestamp,
    mediaType,
  }: {
    contentHash: `0x${string}`
    gpsHash: `0x${string}`
    nullifierHash: `0x${string}`
    captureTimestamp: bigint
    mediaType: number
  }) => {
    writeContract({
      address: ZKTRUTH_CONTRACT_ADDRESS as `0x${string}`,
      abi: ZKTRUTH_ABI,
      functionName: 'mintVerifiedProof',
      args: [contentHash, gpsHash, nullifierHash, captureTimestamp, mediaType],
    })
  }

  return { mint, txHash: hash, isPending, isConfirming, isSuccess, error }
}

// Hook: Mint Unverified Proof (pay gas)
export function useMintUnverifiedProof() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const mint = async ({
    contentHash,
    gpsHash,
    captureTimestamp,
    mediaType,
    fee,
  }: {
    contentHash: `0x${string}`
    gpsHash: `0x${string}`
    captureTimestamp: bigint
    mediaType: number
    fee?: bigint
  }) => {
    writeContract({
      address: ZKTRUTH_CONTRACT_ADDRESS as `0x${string}`,
      abi: ZKTRUTH_ABI,
      functionName: 'mintUnverifiedProof',
      args: [contentHash, gpsHash, captureTimestamp, mediaType],
      value: fee || BigInt(0),
    })
  }

  return { mint, txHash: hash, isPending, isConfirming, isSuccess, error }
}

// Hook: Get proof data by token ID
export function useGetProof(tokenId: bigint | undefined) {
  return useReadContract({
    address: ZKTRUTH_CONTRACT_ADDRESS as `0x${string}`,
    abi: ZKTRUTH_ABI,
    functionName: 'getProof',
    args: tokenId ? [tokenId] : undefined,
    query: { enabled: !!tokenId },
  })
}

// Hook: Verify content hash exists on-chain
export function useVerifyContent(contentHash: `0x${string}` | undefined) {
  return useReadContract({
    address: ZKTRUTH_CONTRACT_ADDRESS as `0x${string}`,
    abi: ZKTRUTH_ABI,
    functionName: 'verifyContent',
    args: contentHash ? [contentHash] : undefined,
    query: { enabled: !!contentHash },
  })
}

// Hook: Get total supply
export function useTotalSupply() {
  return useReadContract({
    address: ZKTRUTH_CONTRACT_ADDRESS as `0x${string}`,
    abi: ZKTRUTH_ABI,
    functionName: 'totalSupply',
  })
}
