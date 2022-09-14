import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Signer, Contract, BigNumber, constants, utils } from 'ethers';

describe('PIXE', function () {
  let owner: Signer;
  let alice: Signer;
  let bob: Signer;
  let ownerAddress: String;
  let aliceAddress: String;
  let bobAddress: String;
  let pixeToken: Contract;

  before(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const PIXEFactory = await ethers.getContractFactory('PIXE');
    pixeToken = await PIXEFactory.deploy();

    ownerAddress = await owner.getAddress();
    aliceAddress = await alice.getAddress();
    bobAddress = await bob.getAddress();
  });

  describe('#initialize', () => {
    it('name', async function () {
      expect(await pixeToken.name()).equal('PlanetIX Elements');
    });
    it('symbol', async function () {
      expect(await pixeToken.symbol()).equal('IXE');
    });
    it('decimals', async function () {
      expect(await pixeToken.decimals()).equal(18);
    });
    it('totalSupply', async function () {
      expect(await pixeToken.totalSupply()).equal(0);
    });
  });

  describe('#mintalbe', () => {
    it('mint by owner', async function () {
      const amount = utils.parseUnits('5', 18);

      await pixeToken.mint(aliceAddress, amount);

      expect(await pixeToken.balanceOf(aliceAddress)).equal(amount);
      expect(await pixeToken.totalSupply()).equal(amount);
    });

    it('mint by owner', async function () {
      const amount = utils.parseUnits('7', 18);
      const totalAmount = utils.parseUnits('12', 18);

      await pixeToken.mint(ownerAddress, amount);

      expect(await pixeToken.balanceOf(ownerAddress)).equal(amount);
      expect(await pixeToken.totalSupply()).equal(totalAmount);
    });

    it('mint by alice', async function () {
      const amount = utils.parseUnits('5', 18);

      await expect(pixeToken.connect(alice).mint(aliceAddress, amount)).to.revertedWith('ERC20PresetMinterPauser: must have minter role to mint');
    })
  });

  describe('#burnable', () => {
    it('burn by owner', async function () {
      const amount = utils.parseUnits('2', 18);
      const remainingAmount = utils.parseUnits('5', 18);
      const totalAmount = utils.parseUnits('10', 18);

      await pixeToken.burn(amount);
      
      expect(await pixeToken.balanceOf(ownerAddress)).equal(remainingAmount);
      expect(await pixeToken.totalSupply()).equal(totalAmount);
    });

    it('burn by alice', async function () {
      const amount = utils.parseUnits('2', 18);
      const remainingAmount = utils.parseUnits('3', 18);
      const totalAmount = utils.parseUnits('8', 18);

      await pixeToken.approve(aliceAddress, amount);
      await pixeToken.connect(alice).burnFrom(ownerAddress, amount);

      expect(await pixeToken.balanceOf(ownerAddress)).equal(remainingAmount);
      expect(await pixeToken.totalSupply()).equal(totalAmount);
    });
  });

  describe('#transferrable', () => {
    it('transfer by owner', async function () {
      const amount = utils.parseUnits('1', 18);
      const remainingAmount = utils.parseUnits('2', 18);
      const totalAmount = utils.parseUnits('8', 18);

      await pixeToken.transfer(bobAddress, amount);

      expect(await pixeToken.balanceOf(bobAddress)).equal(amount);
      expect(await pixeToken.balanceOf(ownerAddress)).equal(remainingAmount);
      expect(await pixeToken.totalSupply()).equal(totalAmount);
    });

    it('transfer by alice', async function () {
      const amount = utils.parseUnits('1', 18);
      const remainingAmount = utils.parseUnits('1', 18);
      const totalAmount = utils.parseUnits('8', 18);

      await pixeToken.approve(aliceAddress, amount);
      await pixeToken.connect(alice).transferFrom(ownerAddress, bobAddress, amount);

      expect(await pixeToken.balanceOf(bobAddress)).equal(amount.add(amount));
      expect(await pixeToken.balanceOf(ownerAddress)).equal(remainingAmount);
      expect(await pixeToken.totalSupply()).equal(totalAmount);
    });
  })
});
