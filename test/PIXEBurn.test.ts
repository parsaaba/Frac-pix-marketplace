import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Signer, Contract, utils } from 'ethers';

describe('PIXEBurn', function () {
  let owner: Signer;
  let alice: Signer;
  let bob: Signer;
  let ownerAddress: String;
  let aliceAddress: String;
  let bobAddress: String;
  let pixeToken: Contract;
  let pixfNFT: Contract;
  let pixeBurn: Contract;
  const burnAmount = utils.parseUnits('5', 18);

  before(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const PIXEFactory = await ethers.getContractFactory('PIXE');
    pixeToken = await PIXEFactory.deploy();
    const PIXFFactory = await ethers.getContractFactory('PIXF');
    pixfNFT = await PIXFFactory.deploy();
    const PIXEBurnFactory = await ethers.getContractFactory('PIXEBurn');
    pixeBurn = await upgrades.deployProxy(PIXEBurnFactory, [
      pixeToken.address,
      pixfNFT.address,
      burnAmount,
    ]);

    ownerAddress = await owner.getAddress();
    aliceAddress = await alice.getAddress();
    bobAddress = await bob.getAddress();

    await pixfNFT.grantRole(await pixfNFT.MINTER_ROLE(), pixeBurn.address);
    await pixeToken.mint(aliceAddress, utils.parseUnits('100', 18));
    await pixeToken.mint(bobAddress, utils.parseUnits('100', 18));
  });

  describe('#burn to mint', () => {
    it('burn by alice', async function () {
      await pixeToken.connect(alice).approve(pixeBurn.address, burnAmount);
      await pixeBurn.connect(alice).burnToMint();

      expect(await pixeToken.balanceOf(aliceAddress)).equal(utils.parseUnits('95', 18));
      expect(await pixfNFT.balanceOf(aliceAddress)).equal('1');
      expect(await pixfNFT.ownerOf(0)).equal(aliceAddress);
    });

    it('burn by bob', async function () {
      await pixeToken.connect(bob).approve(pixeBurn.address, burnAmount);
      await pixeBurn.connect(bob).burnToMint();

      expect(await pixeToken.balanceOf(bobAddress)).equal(utils.parseUnits('95', 18));
      expect(await pixfNFT.balanceOf(bobAddress)).equal('1');
      expect(await pixfNFT.ownerOf(1)).equal(bobAddress);
    });

    it('PIXE total supply', async function () {
      expect(await pixeToken.totalSupply()).equal(utils.parseUnits('190', 18));
    });
  });
});
