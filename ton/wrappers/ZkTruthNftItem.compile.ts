import { CompilerConfig } from '@ton/blueprint'

export const compile: CompilerConfig = {
  lang: 'tact',
  target: 'contracts/zktruth_nft_item.tact',
  options: {
    debug: false,
  },
}
