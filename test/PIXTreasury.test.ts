import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Signer, Contract, constants } from 'ethers';
import { generateRandomAddress } from './utils';

describe('PIXTreasury', function () {
  let pixToken: Contract;
  let pixTreasury: Contract;
  let owner: Signer;
  let alice: Signer;

  let auction: string = generateRandomAddress();

  beforeEach(async function () {
    [owner, alice] = await ethers.getSigners();

    const PIXTFactory = await ethers.getContractFactory('PIXT');
    pixToken = await PIXTFactory.deploy();
    const PIXTreasuryFactory = await ethers.getContractFactory('PIXTreasury');
    pixTreasury = await PIXTreasuryFactory.deploy(pixToken.address);
    await pixToken.transfer(pixTreasury.address, 100);
  });

  describe('constructor', () => {
    it('revert if zero address', async function () {
      const PIXTreasury = await ethers.getContractFactory('PIXTreasury');
      await expect(PIXTreasury.deploy(constants.AddressZero)).to.revertedWith(
        'Treasury: INVALID_PIXT',
      );
    });

    it('check initial values', async function () {
      expect(await pixTreasury.pixToken()).equal(pixToken.address);
    });
  });

  describe('#transfer', () => {
    it('revert if msg.sender is not owner', async () => {
      await expect(pixTreasury.connect(alice).transfer(await alice.getAddress())).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('should transfer pixt to', async () => {
      await pixTreasury.transfer(await alice.getAddress());
      expect(await pixToken.balanceOf(pixTreasury.address)).to.equal(0);
      expect(await pixToken.balanceOf(await alice.getAddress())).to.equal(100);
    });
  });
});
