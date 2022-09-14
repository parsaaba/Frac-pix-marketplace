import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Signer, Contract, BigNumber, providers, constants, utils } from 'ethers';
import { PIXCategory, PIXSize } from './utils';
import { time } from '@openzeppelin/test-helpers';

const period = 3600;
const proposal = 'Test Proposal';
const amount = 100000;
describe('PIXLending', function () {
  let owner: Signer;
  let alice: Signer;
  let bob: Signer;

  let usdc: Contract;
  let pixToken: Contract;
  let pixNFT: Contract;
  let pixGovernance: Contract;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const PIXTFactory = await ethers.getContractFactory('PIXT');
    pixToken = await PIXTFactory.deploy();

    const PIXGovernanceFactory = await ethers.getContractFactory('Governance');
    pixGovernance = await upgrades.deployProxy(PIXGovernanceFactory, [pixToken.address, period]);

    await pixToken.transfer(await alice.getAddress(), utils.parseEther('100'));
    await pixToken.connect(alice).approve(pixGovernance.address, utils.parseEther('100'));
    await pixToken.connect(bob).approve(pixGovernance.address, utils.parseEther('100'));
  });

  describe('#setModerator', () => {
    it('revert if msg.sender is not owner', async () => {
      await expect(
        pixGovernance.connect(alice).setModerator(await alice.getAddress(), true),
      ).to.revertedWith('Ownable: caller is not the owner');
    });

    it('revert if moderator is zero address', async () => {
      await expect(
        pixGovernance.connect(owner).setModerator(constants.AddressZero, true),
      ).to.revertedWith('setModerator: INVALID_MODERATOR');
    });

    it('should set moderator by owner', async () => {
      await pixGovernance.setModerator(await alice.getAddress(), true);
      expect(await pixGovernance.moderators(await alice.getAddress())).to.be.equal(true);

      await pixGovernance.setModerator(await alice.getAddress(), false);
      expect(await pixGovernance.moderators(await alice.getAddress())).to.be.equal(false);
    });
  });

  describe('#createProposal', () => {
    it('revert if balance is 0', async () => {
      await expect(pixGovernance.connect(bob).createProposal(proposal)).to.revertedWith(
        'createProposal: insufficiency balance',
      );
    });

    it('revert if description length is 0', async () => {
      await expect(pixGovernance.connect(alice).createProposal('')).to.revertedWith(
        'createProposal:INVALID_DESCRIPTION',
      );
    });

    it('should create a proposal by alice', async () => {
      await pixGovernance.connect(alice).createProposal(proposal);
      expect((await pixGovernance.proposal('0'))[0]).to.be.equal(proposal);
    });
  });

  describe('#vote', () => {
    it('revert if balance is not enough', async () => {
      await pixGovernance.connect(alice).createProposal(proposal);
      await expect(pixGovernance.connect(bob).voting('0', amount, true)).to.revertedWith(
        'voting: insufficiency balance',
      );
    });

    it('should transfer token successfully', async () => {
      await pixGovernance.connect(alice).createProposal(proposal);
      await pixGovernance.connect(alice).voting('0', amount, true);
      expect(await pixToken.balanceOf(pixGovernance.address)).to.be.equal(amount);
    });

    it('should set power amount correctly', async () => {
      await pixGovernance.connect(alice).createProposal(proposal);
      await pixGovernance.connect(alice).voting('0', amount, true);
      expect((await pixGovernance.proposal('0'))[3]).to.be.equal(amount);
    });
  });

  describe('#closeProposal', () => {
    it('revert if msg.sender is not owner', async () => {
      await expect(pixGovernance.connect(alice).closeProposal('0')).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('should close a proposal successfully', async () => {
      await pixGovernance.connect(alice).createProposal(proposal);
      await pixGovernance.connect(owner).closeProposal('0');
      console.log(await pixGovernance.proposal('0'));
      expect((await pixGovernance.proposal('0'))[1]).to.be.equal(3);
    });
  });

  describe('#completeProposal', () => {
    it('revert if msg.sender is not owner', async () => {
      await expect(pixGovernance.connect(alice).completeProposal('0')).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('should close a proposal successfully', async () => {
      await pixGovernance.connect(alice).createProposal(proposal);
      await pixGovernance.connect(owner).completeProposal('0');
      console.log(await pixGovernance.proposal('0'));
      expect((await pixGovernance.proposal('0'))[1]).to.be.equal(2);
    });
  });

  describe('#withdraw', () => {
    it('revert if proposal not completed', async () => {
      await pixGovernance.connect(alice).createProposal(proposal);
      await expect(pixGovernance.connect(bob).withdraw('0')).to.revertedWith(
        'withdraw: proposal still active',
      );
    });

    it('revert if proposal closed', async () => {
      await pixGovernance.connect(alice).createProposal(proposal);
      await expect(pixGovernance.connect(bob).withdraw('0')).to.revertedWith(
        'withdraw: proposal still active',
      );
    });
    it('should withraw successfully', async () => {
      await pixGovernance.connect(alice).createProposal(proposal);
      await pixGovernance.connect(alice).voting('0', utils.parseEther('1'), true);
      expect(await pixToken.balanceOf(await alice.getAddress())).to.be.equal(
        utils.parseEther('99'),
      );
      await pixGovernance.connect(owner).closeProposal('0');
      await pixGovernance.connect(alice).withdraw('0');
      expect(await pixToken.balanceOf(await alice.getAddress())).to.be.equal(
        utils.parseEther('100'),
      );
    });
  });
});
