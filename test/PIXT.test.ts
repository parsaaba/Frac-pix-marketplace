import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Signer, Contract, utils } from 'ethers';

describe('PIXT', function () {
  let pixtToken: Contract;
  let owner: Signer;
  const NAME = 'PlanetIX';
  const SYMBOL = 'IXT';

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    const PIXTFactory = await ethers.getContractFactory('PIXT');
    pixtToken = await PIXTFactory.deploy();
  });

  describe('check tokenomics', () => {
    it('check name', async () => {
      expect(await pixtToken.name()).to.equal(NAME);
    });

    it('check symbol', async () => {
      expect(await pixtToken.symbol()).to.equal(SYMBOL);
    });

    it('check totalSupply', async () => {
      const balance = utils.parseEther('153258228');
      expect(await pixtToken.balanceOf(await owner.getAddress())).to.equal(balance);
      expect(await pixtToken.totalSupply()).to.equal(balance);
    });
  });
});
