import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { defineChain } from 'viem'

export const worldChain = defineChain({
  id: 480,
  name: 'World Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://worldchain-mainnet.g.alchemy.com/public'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://worldchain-mainnet.explorer.alchemy.com' },
  },
})

export const config = getDefaultConfig({
  appName: 'zkTruth',
  projectId: 'demo-project-id',
  chains: [worldChain],
  ssr: true,
})
