import { CompilerConfig } from '@ton/blueprint'

// Blueprint discovers this file, points at the Tact source, and calls
// the Tact compiler to produce the FunC / Fift / cell code + a
// TypeScript ABI wrapper the deployment script imports below.
export const compile: CompilerConfig = {
  lang: 'tact',
  target: 'contracts/zktruth_collection.tact',
  options: {
    debug: false,
  },
}
