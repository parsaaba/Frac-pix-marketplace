import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Signer, Contract, BigNumber, constants, utils } from 'ethers';
import { advanceTime } from './utils';

const rewardPerBlock = BigNumber.from(10);
const period = BigNumber.from(1000);

describe('PIXTStakingLottery', function () {
  let owner: Signer;
  let distributor: Signer;
  let alice: Signer;
  let bob: Signer;
  let aliceAddress: string;
  let bobAddress: string;

  let pixt: Contract;
  let pixtStaking: Contract;
  let ownerStaking: Contract;
  let aliceStaking: Contract;
  let bobStaking: Contract;

  let periodStart: BigNumber;

  const reward = utils.parseEther('100');
  const rewardPeriod = 10 * 86400;

  before(async function () {
    [owner, distributor, alice, bob] = await ethers.getSigners();
    aliceAddress = await alice.getAddress();
    bobAddress = await bob.getAddress();

    const PIXTFactory = await ethers.getContractFactory('PIXT');
    pixt = await PIXTFactory.deploy();

    const PIXTStakingFactory = await ethers.getContractFactory('PIXTStakingLottery');
    pixtStaking = await upgrades.deployProxy(PIXTStakingFactory, [
      pixt.address,
      rewardPerBlock,
      period,
    ]);

    aliceStaking = pixtStaking.connect(alice);
    bobStaking = pixtStaking.connect(bob);
    ownerStaking = pixtStaking.connect(owner);
    await pixt.transfer(await distributor.getAddress(), reward.mul(3));
    await pixt.transfer(aliceAddress, reward);
    await pixt.transfer(bobAddress, reward);
    await pixt.transfer(pixtStaking.address, reward);
    await pixt.connect(alice).approve(pixtStaking.address, reward);
    await pixt.connect(bob).approve(pixtStaking.address, reward);
  });

  describe('#initialize', () => {
    it('revert if pixt is zero address', async function () {
      const PIXTStaking = await ethers.getContractFactory('PIXTStaking');
      await expect(upgrades.deployProxy(PIXTStaking, [constants.AddressZero])).to.revertedWith(
        'Staking: INVALID_PIXT',
      );
    });

    it('check initial values', async function () {
      expect(await pixtStaking.pixToken()).equal(pixt.address);
    });
  });

  describe('#stake', () => {
    it('revert if amount is zero', async () => {
      await expect(aliceStaking.stake(0)).to.revertedWith('Staking: STAKE_ZERO');
    });

    it('alice stakes 10 pixt', async () => {
      const prevBalance = await pixt.balanceOf(aliceAddress);
      const tx = await aliceStaking.stake(10);
      expect(tx).to.emit(aliceStaking, 'Staked').withArgs(aliceAddress, 10);
      expect(await aliceStaking.totalStaked()).to.equal(BigNumber.from(10));
      expect(await pixt.balanceOf(aliceAddress)).to.equal(prevBalance.sub(10));
    });

    it('bob stakes 10 pixt after 1 day', async () => {
      await bobStaking.stake(10);
    });

    it('alice stakes 10 pixt after 1 day', async () => {
      await aliceStaking.stake(10);
    });

    it('bob stakes 10 pixt after 1 day', async () => {
      await bobStaking.stake(10);
    });
  });

  describe('#unstake', () => {
    it('revert if amount is zero', async () => {
      await expect(aliceStaking.unstake(0)).to.revertedWith('Staking: UNSTAKE_ZERO');
    });

    it('alice unstakes 10 pixt', async () => {
      const prevBalance = await pixt.balanceOf(aliceAddress);
      const tx = await aliceStaking.unstake(10);
    });
  });

  describe('#claim', () => {
    it('alice claim reward', async () => {
      await ownerStaking.setRewardPerBlock(rewardPerBlock);

      await aliceStaking.stake(10);
      await ownerStaking.startLottery();
      await advanceTime(2000);
      await ownerStaking.setReward(await alice.getAddress());

      const prevBalance = await pixt.balanceOf(aliceAddress);
      const tx = await aliceStaking.claim();
      expect(await pixt.balanceOf(aliceAddress)).to.closeTo(prevBalance, 20000, '');
    });
  });
});
