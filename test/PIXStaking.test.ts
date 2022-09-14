import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Signer, Contract, BigNumber, constants } from 'ethers';
import { PIXCategory, PIXSize, increaseTime } from './utils';
describe('PIXStaking', function () {
  let owner: Signer;
  let alice: Signer;
  let bob: Signer;
  let pixToken: Contract;
  let usdc: Contract;
  let pixNFT: Contract;
  let pixStaking: Contract;

  const rewardPerBlock = BigNumber.from(10);

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const PIXTFactory = await ethers.getContractFactory('PIXT');
    pixToken = await PIXTFactory.deploy();

    const MockTokenFactory = await ethers.getContractFactory('MockToken');
    usdc = await MockTokenFactory.deploy('Mock USDC', 'USDC', 6);

    const PIXFactory = await ethers.getContractFactory('PIX');
    pixNFT = await upgrades.deployProxy(PIXFactory, [pixToken.address, usdc.address]);

    const PIXStakingFactory = await ethers.getContractFactory('PIXStaking');
    pixStaking = await upgrades.deployProxy(PIXStakingFactory, [pixToken.address, pixNFT.address]);

    await pixNFT.setTrader(pixStaking.address, true);
    await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Common, PIXSize.Area]);
    await pixToken.transfer(pixStaking.address, ethers.utils.parseEther('1000000'));
    await pixToken.transfer(await alice.getAddress(), BigNumber.from(10000));
    await pixToken.transfer(await bob.getAddress(), BigNumber.from(10000));

    await pixStaking.connect(owner).setRewardDistributor(await owner.getAddress());
    await pixStaking.connect(owner).notifyRewardAmount(BigNumber.from(864000));
  });

  describe('setRewardDistributor', () => {
    it('it should set reward amount correctly', async () => {
      await pixStaking.connect(owner).setRewardDistributor(await alice.getAddress());
      expect(await pixStaking.rewardDistributor()).to.equal(await alice.getAddress());
    });

    it('it should revert if the caller is not a owner', async () => {
      await expect(
        pixStaking.connect(alice).setRewardDistributor(await bob.getAddress()),
      ).to.revertedWith('Ownable: caller is not the owner');
    });

    it('it should revert if the distributor address is zero address', async () => {
      await expect(
        pixStaking.connect(owner).setRewardDistributor(constants.AddressZero),
      ).to.revertedWith('Staking: INVALID_DISTRIBUTOR');
    });
  });

  describe('stake', () => {
    it('revert if nftId is zero', async function () {
      await expect(pixStaking.connect(alice).stake('0')).to.revertedWith(
        'Staking: INVALID_TOKEN_ID',
      );
    });

    it("revert if tier didn't set", async function () {
      await pixNFT.setTier(PIXCategory.Common, PIXSize.Area, 0);
      await expect(pixStaking.connect(alice).stake(1)).to.revertedWith('Staking: INVALID_TIER');
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

      await increaseTime(BigNumber.from(50));
    });

    it('should return correct rewards amount', async function () {
      expect(await pixStaking.earned(await alice.getAddress())).to.closeTo(
        BigNumber.from(50),
        1,
        '',
      );
    });

    it('should provide correct rewards', async function () {
      await pixStaking.connect(alice).claim();
      expect(await pixToken.balanceOf(await alice.getAddress())).to.closeTo(
        BigNumber.from(10050),
        1,
        '',
      );
    });
  });

  describe('unstake', () => {
    beforeEach(async function () {
      // Stake an NFT from Alice
      await pixNFT.connect(alice).approve(pixStaking.address, 1);
      await pixStaking.connect(alice).stake(1);
    });

    it('revert if msg.sender is not staker', async function () {
      await expect(pixStaking.unstake(1)).to.revertedWith('Staking: NOT_STAKER');
    });

    it('should provide correct rewards', async function () {
      await pixStaking.connect(alice).unstake(1);
      expect(await pixToken.balanceOf(await alice.getAddress())).to.closeTo(
        BigNumber.from(10000),
        1,
        '',
      );
    });

    it('should stake again', async function () {
      await pixStaking.connect(alice).unstake(1);
      await pixNFT.connect(alice).approve(pixStaking.address, 1);
      await pixStaking.connect(alice).stake(1);
    });
  });
});
