import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Signer, Contract, BigNumber } from 'ethers';
import { PIXCategory, PIXSize, advanceTime } from './utils';
import { time } from '@openzeppelin/test-helpers';

describe('PIXStakingLottery', function () {
  let owner: Signer;
  let alice: Signer;
  let bob: Signer;
  let pixToken: Contract;
  let usdc: Contract;
  let pixNFT: Contract;
  let pixStaking: Contract;

  const rewardPerBlock = BigNumber.from(10);
  const period = BigNumber.from(1000);

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const PIXTFactory = await ethers.getContractFactory('PIXT');
    pixToken = await PIXTFactory.deploy();

    const MockTokenFactory = await ethers.getContractFactory('MockToken');
    usdc = await MockTokenFactory.deploy('Mock USDC', 'USDC', 6);

    const PIXFactory = await ethers.getContractFactory('PIX');
    pixNFT = await upgrades.deployProxy(PIXFactory, [pixToken.address, usdc.address]);

    const PIXStakingFactory = await ethers.getContractFactory('PIXStakingLottery');
    pixStaking = await upgrades.deployProxy(PIXStakingFactory, [
      pixToken.address,
      pixNFT.address,
      rewardPerBlock,
      period,
    ]);

    await pixNFT.setTrader(pixStaking.address, true);
    await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Common, PIXSize.Area]);
    await pixNFT.setTier(PIXCategory.Common, PIXSize.Area, 2);
    await pixToken.transfer(pixStaking.address, ethers.utils.parseEther('1000000'));
    await pixToken.transfer(await alice.getAddress(), BigNumber.from(10000));
    await pixToken.transfer(await bob.getAddress(), BigNumber.from(10000));
  });

  describe('setRewardPerBlock', () => {
    it('it should set reward amount correctly', async () => {
      await pixStaking.connect(owner).setRewardPerBlock(ethers.utils.parseEther('2.0'));
      expect(await pixStaking.rewardPerBlock()).to.equal(ethers.utils.parseEther('2.0'));
    });
  });

  describe('stake', () => {
    it('revert if nftId is zero', async function () {
      await expect(pixStaking.connect(alice).stake('0')).to.revertedWith(
        'Staking: INVALID_TOKEN_ID',
      );
    });

    it('should stake an NFT', async function () {
      await pixNFT.connect(alice).approve(pixStaking.address, 1);
      await pixStaking.connect(alice).stake(1);
      expect(await pixStaking.totalTiers()).to.equal('2');
    });
  });

  describe('claim', () => {
    beforeEach(async function () {
      // Stake an NFT from Alice
      await pixNFT.connect(alice).approve(pixStaking.address, 1);
      await pixStaking.connect(alice).stake(1);

      await pixStaking.connect(owner).startLottery();
      await advanceTime(2000);
      await pixStaking.connect(owner).setReward(await alice.getAddress());
    });

    it('should provide correct rewards', async function () {
      await pixStaking.connect(alice).claim();
      expect(await pixToken.balanceOf(await alice.getAddress())).to.closeTo(
        BigNumber.from(30000),
        10,
        '',
      );
    });

    it('should revert if didnt stake', async function () {
      await expect(pixStaking.connect(owner).claim()).to.revertedWith(
        'Claiming: NO_Tokens to withdraw',
      );
    });
  });

  describe('unstake', () => {
    beforeEach(async function () {
      // Stake an NFT from Alice
      await pixNFT.connect(alice).approve(pixStaking.address, 1);
      await pixStaking.connect(alice).stake(1);
    });
    it('should stake again', async function () {
      await pixStaking.connect(alice).unstake(1);
      await pixNFT.connect(alice).approve(pixStaking.address, 1);
      await pixStaking.connect(alice).stake(1);
    });
  });
});
