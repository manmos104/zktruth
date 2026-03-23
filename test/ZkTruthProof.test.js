const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZkTruthProof", function () {
  let contract;
  let owner;
  let user1;
  let user2;

  const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("sample-photo-data"));
  const sampleGpsHash = ethers.keccak256(ethers.toUtf8Bytes("35.1815,136.9066"));
  const sampleNullifier = ethers.keccak256(ethers.toUtf8Bytes("world-id-nullifier-123"));
  const sampleTimestamp = Math.floor(Date.now() / 1000);

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const ZkTruthProof = await ethers.getContractFactory("ZkTruthProof");
    contract = await ZkTruthProof.deploy();
    await contract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await contract.name()).to.equal("zkTruth Proof of Capture");
      expect(await contract.symbol()).to.equal("ZKPROOF");
    });

    it("Should set the deployer as owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("Should start with 0 total supply", async function () {
      expect(await contract.totalSupply()).to.equal(0);
    });
  });

  describe("Verified Minting", function () {
    it("Should mint a verified proof", async function () {
      const tx = await contract.connect(user1).mintVerifiedProof(
        sampleHash, sampleGpsHash, sampleNullifier, sampleTimestamp, 0
      );
      await tx.wait();

      expect(await contract.totalSupply()).to.equal(1);
      expect(await contract.ownerOf(1)).to.equal(user1.address);

      const proof = await contract.getProof(1);
      expect(proof.contentHash).to.equal(sampleHash);
      expect(proof.verificationLevel).to.equal(2); // Orb verified
      expect(proof.mediaType).to.equal(0); // Photo
    });

    it("Should emit ProofMinted event", async function () {
      await expect(
        contract.connect(user1).mintVerifiedProof(
          sampleHash, sampleGpsHash, sampleNullifier, sampleTimestamp, 0
        )
      ).to.emit(contract, "ProofMinted")
        .withArgs(1, user1.address, sampleHash, 2, 0, sampleTimestamp);
    });

    it("Should prevent duplicate content hash", async function () {
      await contract.connect(user1).mintVerifiedProof(
        sampleHash, sampleGpsHash, sampleNullifier, sampleTimestamp, 0
      );
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("nullifier-2"));
      await expect(
        contract.connect(user2).mintVerifiedProof(
          sampleHash, sampleGpsHash, hash2, sampleTimestamp, 0
        )
      ).to.be.revertedWithCustomError(contract, "ContentAlreadyMinted");
    });

    it("Should prevent reuse of nullifier", async function () {
      await contract.connect(user1).mintVerifiedProof(
        sampleHash, sampleGpsHash, sampleNullifier, sampleTimestamp, 0
      );
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("different-photo"));
      await expect(
        contract.connect(user2).mintVerifiedProof(
          hash2, sampleGpsHash, sampleNullifier, sampleTimestamp, 0
        )
      ).to.be.revertedWithCustomError(contract, "NullifierAlreadyUsed");
    });

    it("Should reject empty content hash", async function () {
      await expect(
        contract.connect(user1).mintVerifiedProof(
          ethers.ZeroHash, sampleGpsHash, sampleNullifier, sampleTimestamp, 0
        )
      ).to.be.revertedWithCustomError(contract, "InvalidContentHash");
    });
  });

  describe("Unverified Minting", function () {
    it("Should mint an unverified proof for free when fee is 0", async function () {
      const tx = await contract.connect(user1).mintUnverifiedProof(
        sampleHash, sampleGpsHash, sampleTimestamp, 1
      );
      await tx.wait();

      expect(await contract.totalSupply()).to.equal(1);
      const proof = await contract.getProof(1);
      expect(proof.verificationLevel).to.equal(0); // Unverified
      expect(proof.mediaType).to.equal(1); // Video
    });

    it("Should require fee when set", async function () {
      const fee = ethers.parseEther("0.01");
      await contract.setUnverifiedMintFee(fee);

      await expect(
        contract.connect(user1).mintUnverifiedProof(
          sampleHash, sampleGpsHash, sampleTimestamp, 0
        )
      ).to.be.revertedWithCustomError(contract, "InsufficientFee");

      // Should work with correct fee
      await contract.connect(user1).mintUnverifiedProof(
        sampleHash, sampleGpsHash, sampleTimestamp, 0,
        { value: fee }
      );
      expect(await contract.totalSupply()).to.equal(1);
    });
  });

  describe("View Functions", function () {
    it("Should verify content hash", async function () {
      await contract.connect(user1).mintVerifiedProof(
        sampleHash, sampleGpsHash, sampleNullifier, sampleTimestamp, 0
      );
      expect(await contract.verifyContent(sampleHash)).to.equal(1);
      expect(await contract.verifyContent(ethers.keccak256(ethers.toUtf8Bytes("nonexistent")))).to.equal(0);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set fee", async function () {
      const fee = ethers.parseEther("0.05");
      await contract.setUnverifiedMintFee(fee);
      expect(await contract.unverifiedMintFee()).to.equal(fee);
    });

    it("Should not allow non-owner to set fee", async function () {
      await expect(
        contract.connect(user1).setUnverifiedMintFee(ethers.parseEther("0.05"))
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to withdraw", async function () {
      const fee = ethers.parseEther("0.01");
      await contract.setUnverifiedMintFee(fee);
      await contract.connect(user1).mintUnverifiedProof(
        sampleHash, sampleGpsHash, sampleTimestamp, 0,
        { value: fee }
      );

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await contract.withdraw();
      await tx.wait();
      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balanceAfter).to.be.greaterThan(balanceBefore);
    });
  });
});
