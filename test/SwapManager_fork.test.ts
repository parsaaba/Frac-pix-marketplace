import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { Contract, utils, constants, Signer } from 'ethers';
import 'dotenv/config';

describe('SwapManager', function () {
  const router = '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff';
  const sushiRouter = '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506';
  const pixt = '0xE06Bd4F5aAc8D0aA337D13eC88dB6defC6eAEefE';
  const usdt = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
  const weth = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
  let swapManager: Contract;
  let owner: Signer;
  let alice: Signer;
  let bob: Signer;

  before(async function () {
    await hre.network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
            blockNumber: 22627000,
          },
        },
      ],
    });

    [alice, bob] = await ethers.getSigners();

    const SwapManagerFactory = await ethers.getContractFactory('SwapManager');
    swapManager = await SwapManagerFactory.deploy(router);
  });

  describe('constructor', () => {
    it('check initial values', async () => {
      expect(await swapManager.router()).to.be.equal(router);
      expect(await swapManager.weth()).to.be.equal(weth);
    });
  });

  describe('#swap', () => {
    it('revert if amount is zero', async () => {
      await expect(
        swapManager.swap(constants.AddressZero, usdt, '0', await alice.getAddress()),
      ).to.revertedWith('swap zero');
    });

    it('revert if amount and msg.amount are different for MATIC swap', async () => {
      await expect(
        swapManager.swap(constants.AddressZero, usdt, '100', await alice.getAddress()),
      ).to.revertedWith('invalid eth amount');
    });

    it('swap MATIC to IXT', async () => {
      await swapManager.addOtherRouter(constants.AddressZero, pixt, sushiRouter);

      const amount = utils.parseEther('100');
      await swapManager.swap(constants.AddressZero, pixt, amount, await bob.getAddress(), {
        value: amount,
      });

      const MockTokenFactory = await ethers.getContractFactory('MockToken');
      const pixtToken = MockTokenFactory.attach(pixt);
      expect(await pixtToken.balanceOf(await bob.getAddress())).to.equal('123216430971773616963');
    });

    it('swap USDT to IXT', async () => {
      const amount = utils.parseEther('100');
      const MockTokenFactory = await ethers.getContractFactory('MockToken');
      const usdtToken = MockTokenFactory.attach(usdt);

      await swapManager
        .connect(alice)
        .swap(constants.AddressZero, usdt, amount, await bob.getAddress(), {
          value: amount,
        });

      await usdtToken.connect(bob).approve(swapManager.address, '150000000');
      await swapManager.connect(bob).swap(usdt, pixt, '150000000', await alice.getAddress());

      const pixtToken = MockTokenFactory.attach(pixt);
      expect(await pixtToken.balanceOf(await alice.getAddress())).to.equal('90453964776372524375');
    });
  });
});
