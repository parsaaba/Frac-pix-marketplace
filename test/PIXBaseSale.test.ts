import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Signer, Contract, BigNumber, constants } from 'ethers';
import { DENOMINATOR, generateRandomAddress } from './utils';

describe('PIXBaseSale', function () {
  let owner: Signer;
  let alice: Signer;
  let pixtToken: Contract;
  let pixNFT: Contract;
  let fixedSale: Contract;

  beforeEach(async function () {
    [owner, alice] = await ethers.getSigners();

    const PIXTFactory = await ethers.getContractFactory('PIXT');
    pixtToken = await PIXTFactory.deploy();

    const MockTokenFactory = await ethers.getContractFactory('MockToken');
    const usdc = await MockTokenFactory.deploy('Mock USDC', 'USDC', 6);

    const PIXFactory = await ethers.getContractFactory('PIX');
    pixNFT = await upgrades.deployProxy(PIXFactory, [pixtToken.address, usdc.address]);

    const PIXFixedSaleFactory = await ethers.getContractFactory('PIXFixedSale');
    fixedSale = await upgrades.deployProxy(PIXFixedSaleFactory, [
      pixtToken.address,
      pixNFT.address,
    ]);
  });

  describe('#initialize', () => {
    it('revert if pixtToken is zero', async () => {
      const PIXFixedSaleFactory = await ethers.getContractFactory('PIXFixedSale');
      await expect(
        upgrades.deployProxy(PIXFixedSaleFactory, [constants.AddressZero, constants.AddressZero]),
      ).to.revertedWith('Sale: INVALID_PIXT');
    });

    it('revert if pixtToken is zero', async () => {
      const PIXFixedSaleFactory = await ethers.getContractFactory('PIXFixedSale');
      await expect(
        upgrades.deployProxy(PIXFixedSaleFactory, [pixtToken.address, constants.AddressZero]),
      ).to.revertedWith('Sale: INVALID_PIX');
    });

    it('check initial values', async () => {
      expect(await fixedSale.pixToken()).to.be.equal(pixtToken.address);
    });
  });

  describe('#setTreasury function', () => {
    const newTreasury = generateRandomAddress();

    it('revert if msg.sender is not owner', async () => {
      await expect(fixedSale.connect(alice).setTreasury(newTreasury, 0, 0, false)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('revert if new treasury is 0x0', async () => {
      await expect(fixedSale.setTreasury(constants.AddressZero, 0, 0, false)).to.revertedWith(
        'Sale: INVALID_TREASURY',
      );
    });

    it('revert if fee is overflown', async () => {
      await expect(
        fixedSale.setTreasury(newTreasury, DENOMINATOR.add(BigNumber.from(1)), 0, false),
      ).to.revertedWith('Sale: FEE_OVERFLOWN');
    });

    it('should update new treasury and emit TreasuryUpdated event', async () => {
      const tx = await fixedSale.setTreasury(newTreasury, 10, 0, false);
      const treasury = await fixedSale.pixtTreasury();
      expect(treasury[0]).to.be.equal(newTreasury);
      expect(treasury[1]).to.be.equal(10);
      expect(treasury[2]).to.be.equal(0);
      expect(tx).to.emit(fixedSale, 'TreasuryUpdated').withArgs(newTreasury, 10, 0, false);
    });
  });

  describe('#setWhitelistedNFTs function', () => {
    const token = generateRandomAddress();

    it('revert if msg.sender is not owner', async () => {
      await expect(fixedSale.connect(alice).setWhitelistedNFTs(token, true)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('should whitelist nft', async () => {
      await fixedSale.setWhitelistedNFTs(token, true);
      expect(await fixedSale.whitelistedNFTs(token)).to.be.equal(true);
    });
  });
});
