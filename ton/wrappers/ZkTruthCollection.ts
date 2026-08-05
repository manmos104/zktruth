// Thin re-export of the Tact-generated wrapper. Blueprint's convention
// is to have `wrappers/<Name>.ts` re-export from the compiled output so
// scripts can `import { ZkTruthCollection } from '../wrappers/ZkTruthCollection'`
// without knowing about the build directory structure.
export * from '../build/ZkTruthCollection/tact_ZkTruthCollection'
