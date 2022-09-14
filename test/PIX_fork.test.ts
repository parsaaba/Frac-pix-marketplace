import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { Contract, constants, Signer } from 'ethers';
import 'dotenv/config';

describe('PIX (mainnet)', function () {
  let pixNFT: Contract;
  let oracle: Contract;
  let alice: Signer;
  let bob: Signer;
  const usdt = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';

  before(async function () {
    await hre.network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
            // blockNumber: 22627000,
          },
        },
      ],
    });

    [alice, bob] = await ethers.getSigners();

    const PIX = await ethers.getContractFactory('PIX');
    pixNFT = PIX.attach('0xB2435253C71FcA27bE41206EB2793E44e1Df6b6D');

    const OracleManager = await ethers.getContractFactory('OracleManager');
    oracle = OracleManager.attach('0x6ab819382a03d0df86a2b95e2cd550cd4148d34d');
  });

  describe('requestBatchMint', () => {
    it('request batch mint with matic when count is over 1', async () => {
      const price = await oracle.callStatic.getAmountOut(usdt, constants.AddressZero, '5500000');
      await pixNFT
        .connect(alice)
        .requestBatchMint(constants.AddressZero, 104, 16, 1, 2, { value: price.mul(2) });
      expect(await pixNFT.packRequestCounts(await alice.getAddress())).to.equal(2);
    });
  });
});
