import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Signer, Contract, utils } from 'ethers';

describe('PIXD', function () {
  let owner: Signer;
  let alice: Signer;
  let bob: Signer;
  let ownerAddress: String;
  let aliceAddress: String;
  let bobAddress: String;
  let pixdToken: Contract;

  before(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const PIXDFactory = await ethers.getContractFactory('PIXD');
    pixdToken = await PIXDFactory.deploy();

    ownerAddress = await owner.getAddress();
    aliceAddress = await alice.getAddress();
    bobAddress = await bob.getAddress();
  });

  describe('#initialize', () => {
    it('name', async function () {
      expect(await pixdToken.name()).equal('PlanetIX Drones');
    });
    it('symbol', async function () {
      expect(await pixdToken.symbol()).equal('IXD');
    });
  });
})