import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Signer, Contract, utils } from 'ethers';

describe('PIXF', function () {
  let owner: Signer;
  let alice: Signer;
  let bob: Signer;
  let ownerAddress: String;
  let aliceAddress: String;
  let bobAddress: String;
  let pixfToken: Contract;

  before(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const PIXFFactory = await ethers.getContractFactory('PIXF');
    pixfToken = await PIXFFactory.deploy();

    ownerAddress = await owner.getAddress();
    aliceAddress = await alice.getAddress();
    bobAddress = await bob.getAddress();
  });

  describe('#initialize', () => {
    it('name', async function () {
      expect(await pixfToken.name()).equal('PlanetIX Facilities');
    });
    it('symbol', async function () {
      expect(await pixfToken.symbol()).equal('IXF');
    });
  });
})