const hre = require("hardhat");

async function main() {
  console.log("Deploying ZkTruthProof to", hre.network.name, "...");

  const ZkTruthProof = await hre.ethers.getContractFactory("ZkTruthProof");
  const contract = await ZkTruthProof.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ ZkTruthProof deployed to:", address);
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", (await hre.ethers.provider.getNetwork()).chainId.toString());
  console.log("\n📋 Next steps:");
  console.log(`1. Update ZKTRUTH_CONTRACT_ADDRESS in src/lib/contract.ts to "${address}"`);
  console.log("2. Verify contract on block explorer");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
