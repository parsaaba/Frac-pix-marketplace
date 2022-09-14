import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Signer, Contract, BigNumber, constants, utils } from 'ethers';
import { PIXCategory, PIXSize } from './utils';

describe('EscrowPrivateSale', function () {
  let owner: Signer;
  let alice: Signer;
  let bob: Signer;
  let aliceAddress: string;
  let bobAddress: string;

  let pixToken: Contract;
  let usdc: Contract;
  let pixNFT: Contract;

  let escrowPS: Contract;

  const amount = utils.parseEther('10');

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();
    aliceAddress = await alice.getAddress();
    bobAddress = await bob.getAddress();

    const MockTokenFactory = await ethers.getContractFactory('MockToken');
    usdc = await MockTokenFactory.deploy('Mock USDC', 'USDC', 6);

    const PIXTFactory = await ethers.getContractFactory('PIXT');
    pixToken = await PIXTFactory.deploy();

    const PIXFactory = await ethers.getContractFactory('PIX');
    pixNFT = await upgrades.deployProxy(PIXFactory, [pixToken.address, usdc.address]);

    const EscrowPrivateSaleFactory = await ethers.getContractFactory('EscrowPrivateSale');
    escrowPS = await upgrades.deployProxy(EscrowPrivateSaleFactory, [
      pixToken.address,
      pixNFT.address,
    ]);

    await pixToken.transfer(bobAddress, amount);
    await pixToken.connect(alice).approve(escrowPS.address, amount);
    await pixToken.connect(bob).approve(escrowPS.address, amount);
    await pixNFT.setTrader(escrowPS.address, true);
    await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Common, PIXSize.Area]);
    await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Common, PIXSize.Area]);
  });

  describe('#initialize', () => {
    it('revert if pixt is zero address', async function () {
      const EscrowPrivateSaleFactory = await ethers.getContractFactory('EscrowPrivateSale');
      await expect(
        upgrades.deployProxy(EscrowPrivateSaleFactory, [
          constants.AddressZero,
          constants.AddressZero,
        ]),
      ).to.revertedWith('INVALID_PIXT');
    });

    it('revert if pixt is zero address', async function () {
      const EscrowPrivateSaleFactory = await ethers.getContractFactory('EscrowPrivateSale');
      await expect(
        upgrades.deployProxy(EscrowPrivateSaleFactory, [pixToken.address, constants.AddressZero]),
      ).to.revertedWith('INVALID_PIX');
    });
  });

  describe('#escrow', () => {
    it('revert if amount is zero', async () => {
      await pixNFT.connect(alice).approve(escrowPS.address, 1);
      await expect(escrowPS.connect(alice).escrow(0, await bob.getAddress(), 0)).to.revertedWith(
        'escrow: INVALID_TOKEN_ID',
      );
    });
    it('revert if tokenId is zero', async () => {
      await pixNFT.connect(alice).approve(escrowPS.address, 1);
      await expect(escrowPS.connect(alice).escrow(1, await bob.getAddress(), 0)).to.revertedWith(
        'escrow: INVALID_TOKEN_ID',
      );
    });
    it('should escrow successfully', async () => {
      await pixNFT.connect(alice).approve(escrowPS.address, 1);
      await escrowPS.connect(alice).escrow(1, await bob.getAddress(), utils.parseEther('1'));
      expect(await pixNFT.ownerOf(1)).to.equal(escrowPS.address);
    });
  });

  describe('#withdraw', () => {
    it('revert if tokenId is zero', async () => {
      await expect(escrowPS.connect(alice).withdraw(0)).to.revertedWith('INVALID_TOKEN_ID');
    });
    it('revert if seller is not a caller', async () => {
      // Escrow
      await pixNFT.connect(alice).approve(escrowPS.address, 1);
      await escrowPS.connect(alice).escrow(1, await bob.getAddress(), utils.parseEther('1'));
      expect(await pixNFT.ownerOf(1)).to.equal(escrowPS.address);
      await expect(escrowPS.connect(bob).withdraw(1)).to.revertedWith('withdraw: Invalid Seller');
    });
    it('should withdraw properly', async () => {
      // Escrow
      await pixNFT.connect(alice).approve(escrowPS.address, 1);
      await escrowPS.connect(alice).escrow(1, await bob.getAddress(), utils.parseEther('1'));
      expect(await pixNFT.ownerOf(1)).to.equal(escrowPS.address);
      await escrowPS.connect(alice).withdraw(1);
      expect(await pixNFT.ownerOf(1)).to.equal(await alice.getAddress());
    });
  });

  describe('#purchase', () => {
    it('revert if tokenID is 0', async () => {
      await pixNFT.connect(alice).approve(escrowPS.address, 1);
      await escrowPS.connect(alice).escrow(1, await bob.getAddress(), utils.parseEther('1'));

      await expect(escrowPS.connect(bob).purchase(0)).to.revertedWith('INVALID_TOKEN_ID');
    });

    it('revert if buyer is invalid', async () => {
      await pixNFT.connect(alice).approve(escrowPS.address, 1);
      await escrowPS.connect(alice).escrow(1, await bob.getAddress(), utils.parseEther('1'));

      await expect(escrowPS.connect(alice).purchase(1)).to.revertedWith('purchase: Invalid Buyer');
    });

    it('should purchase successfully', async () => {
      await pixNFT.connect(alice).approve(escrowPS.address, 1);
      await escrowPS.connect(alice).escrow(1, await bob.getAddress(), utils.parseEther('1'));

      await escrowPS.connect(bob).purchase(1);

      expect(await pixNFT.ownerOf(1)).to.equal(await bob.getAddress());
      expect(await pixNFT.ownerOf(1)).to.equal(await bob.getAddress());

      expect(await pixToken.balanceOf(await alice.getAddress())).to.equal(utils.parseEther('1'));
      expect(await pixToken.balanceOf(await bob.getAddress())).to.equal(utils.parseEther('9'));
    });
  });
});
