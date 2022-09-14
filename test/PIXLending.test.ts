import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Signer, Contract, BigNumber, providers } from 'ethers';
import { PIXCategory, PIXSize } from './utils';
import { time } from '@openzeppelin/test-helpers';

describe('PIXLending', function () {
  let owner: Signer;
  let alice: Signer;
  let bob: Signer;

  let usdc: Contract;
  let pixToken: Contract;
  let pixNFT: Contract;
  let pixLending: Contract;

  const feePerSecond = BigNumber.from(100);

  const duration = 5000;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const PIXTFactory = await ethers.getContractFactory('PIXT');
    pixToken = await PIXTFactory.deploy();

    const MockTokenFactory = await ethers.getContractFactory('MockToken');
    usdc = await MockTokenFactory.deploy('Mock USDC', 'USDC', 6);

    const PIXFactory = await ethers.getContractFactory('PIX');
    pixNFT = await upgrades.deployProxy(PIXFactory, [pixToken.address, usdc.address]);

    const PIXLendingFactory = await ethers.getContractFactory('PIXLending');
    pixLending = await upgrades.deployProxy(PIXLendingFactory, [
      pixToken.address,
      pixNFT.address,
      feePerSecond,
    ]);

    await pixNFT.setTrader(pixLending.address, true);
    await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Common, PIXSize.Area]);
    await pixToken.transfer(await alice.getAddress(), BigNumber.from(100000000));
    await pixToken.transfer(await bob.getAddress(), BigNumber.from(100000000));
  });

  describe('setfeePerSecond', () => {
    it('it should set fee amount correctly', async () => {
      await pixLending.connect(owner).setFeePerSecond(BigNumber.from(10));
      expect(await pixLending.feePerSecond()).to.equal(BigNumber.from(10));
    });
  });

  describe('createRequest', () => {
    it('it should return owner address of the NFT', async () => {
      expect(await pixNFT.ownerOf(1)).to.equal(await alice.getAddress());
    });

    it('it should create request correctly', async () => {
      await pixNFT.connect(alice).approve(pixLending.address, 1);
      await pixLending.connect(alice).createRequest(1, BigNumber.from(1000), 10000);
      expect(await pixNFT.ownerOf(1)).to.equal(pixLending.address);
    });
  });

  describe('Lend PIX', () => {
    beforeEach(async function () {
      // Listing
      await pixNFT.connect(alice).approve(pixLending.address, 1);
      await pixLending.connect(alice).createRequest(1, BigNumber.from(1000), 10000);
    });
    it('it should be owner', async () => {
      expect(await pixNFT.ownerOf(1)).to.equal(pixLending.address);
    });
    it('it should lend PIX correctly', async () => {
      await pixToken.connect(bob).approve(pixLending.address, (await pixLending.info(1))[1]); // amount
      await pixLending.connect(bob).acceptRequest(1);
      expect(await pixNFT.ownerOf(1)).to.equal(pixLending.address);
    });
  });

  describe('payDebt', () => {
    beforeEach(async function () {
      // Listing & Borrowing
      await pixNFT.connect(alice).approve(pixLending.address, 1);
      await pixLending.connect(alice).createRequest(1, BigNumber.from(1000), 10000);

      await pixToken.connect(bob).approve(pixLending.address, (await pixLending.info(1))[1] * 2); // amount
      await pixLending.connect(bob).acceptRequest(1);

      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
    });
    it('it should be owner', async () => {
      expect(await pixNFT.ownerOf(1)).to.equal(pixLending.address);
    });

    it('it should Transfer the NFT to lender', async () => {
      await pixToken.connect(alice).approve(pixLending.address, BigNumber.from(50000000));
      await pixToken.connect(bob).approve(await alice.getAddress(), BigNumber.from(50000000));
      await pixLending.connect(alice).payDebt(1);

      expect(await pixNFT.ownerOf(1)).to.equal(await alice.getAddress());
    });
  });
});
