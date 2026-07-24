'use client'

import { WagmiProvider, createConfig, http } from 'wagmi'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { defineChain } from 'viem'
import { TonConnectUIProvider } from '@tonconnect/ui-react'

import { TelegramInit } from './telegram-init'

// Legacy World Chain config — kept only so existing wagmi-dependent
// code paths (IDKit, mint) still resolve during the incremental pivot
// to TON. Once page.tsx has been rewritten to use TON Connect, the
// WagmiProvider wrapper can be removed entirely.
const worldChain = defineChain({
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

const config = createConfig({
  chains: [worldChain],
  transports: {
    [worldChain.id]: http(),
  },
})

const queryClient = new QueryClient()

// TON Connect needs an absolute URL to a JSON manifest so wallets can
// display the connecting app's identity to the user. The manifest is
// served from /public/tonconnect-manifest.json and points back at the
// production Vercel deploy.
const TONCONNECT_MANIFEST_URL =
  process.env.NEXT_PUBLIC_TONCONNECT_MANIFEST_URL ||
  'https://zktruth.vercel.app/tonconnect-manifest.json'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl={TONCONNECT_MANIFEST_URL}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <TelegramInit />
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </TonConnectUIProvider>
  )
}
