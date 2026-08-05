import { Config } from '@ton/blueprint'

export const config: Config = {
  // Prefer Toncenter for RPC — it's the most stable public gateway
  // and Blueprint's default deployer supports it out of the box.
  network: {
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    type: 'mainnet',
    version: 'v2',
  },
}
