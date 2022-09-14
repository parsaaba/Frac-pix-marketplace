import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract, utils, constants, BigNumber } from 'ethers';

describe('ChainlinkOracle', function () {
  const token0 = {
    address: constants.AddressZero,
  };
  let token1: Contract;
  const priceFeedDecimals = 8;
  let priceFeed: Contract;
  let chainlinkOracle: Contract;

  beforeEach(async function () {
    const MockTokenFactory = await ethers.getContractFactory('MockToken');
    token1 = await MockTokenFactory.deploy('MockToken', 'MockToken', 6);

    const MockChainlinkAggregatorFactory = await ethers.getContractFactory(
      'MockChainlinkAggregator',
    );
    priceFeed = await MockChainlinkAggregatorFactory.deploy(priceFeedDecimals);

    const ChainlinkOracleFactory = await ethers.getContractFactory('ChainlinkOracle');
    chainlinkOracle = await ChainlinkOracleFactory.deploy(
      token0.address,
      token1.address,
      priceFeed.address,
    );
  });

  describe('constructor', () => {
    let ChainlinkOracleFactory: any;

    before(async () => {
      ChainlinkOracleFactory = await ethers.getContractFactory('ChainlinkOracle');
    });

    it('check tokens', async () => {
      const MockTokenFactory = await ethers.getContractFactory('MockToken');

      const tokenA = await MockTokenFactory.deploy('MockToken', 'MockToken', 18);
      const tokenB = await MockTokenFactory.deploy('MockToken', 'MockToken', 18);
      chainlinkOracle = await ChainlinkOracleFactory.deploy(
        tokenA.address,
        tokenB.address,
        priceFeed.address,
      );

      const tokens = await chainlinkOracle.tokens();
      await expect(tokens[0]).to.be.equal(tokenA.address);
      await expect(tokens[1]).to.be.equal(tokenB.address);
    });

    it('check decimals', async () => {
      await expect(await chainlinkOracle.decimals()).to.be.equal(
        BigNumber.from('10').pow(BigNumber.from(priceFeedDecimals.toString())),
      );

      await expect(await chainlinkOracle.token0Decimals()).to.be.equal(
        BigNumber.from('10').pow(BigNumber.from('18')),
      );
      await expect(await chainlinkOracle.token1Decimals()).to.be.equal(
        BigNumber.from('10').pow(BigNumber.from('6')),
      );

      const MockTokenFactory = await ethers.getContractFactory('MockToken');

      const tokenA = await MockTokenFactory.deploy('MockToken', 'MockToken', 5);
      const tokenB = await MockTokenFactory.deploy('MockToken', 'MockToken', 7);
      chainlinkOracle = await ChainlinkOracleFactory.deploy(
        tokenA.address,
        tokenB.address,
        priceFeed.address,
      );

      await expect(await chainlinkOracle.token0Decimals()).to.be.equal(
        BigNumber.from('10').pow(BigNumber.from('5')),
      );
      await expect(await chainlinkOracle.token1Decimals()).to.be.equal(
        BigNumber.from('10').pow(BigNumber.from('7')),
      );
    });

    it('revert token0 and token1 are same', async () => {
      await expect(
        ChainlinkOracleFactory.deploy(token1.address, token1.address, priceFeed.address),
      ).to.revertedWith('invalid tokens');
    });
  });

  describe('#getAmountOut', () => {
    it('revert if roundId and answeredInRound are not same', async () => {
      await priceFeed.setLatestRoundData(100, 1000, 1000, 1000, 90);
      await expect(
        chainlinkOracle.getAmountOut(token0.address, utils.parseEther('100')),
      ).to.revertedWith('old price');
    });

    it('revert if price is not above than 0', async () => {
      await priceFeed.setLatestRoundData(100, 0, 1000, 1000, 100);
      await expect(
        chainlinkOracle.getAmountOut(token0.address, utils.parseEther('100')),
      ).to.revertedWith('invalid price');
    });

    it('get token1 price in token0', async () => {
      await priceFeed.setLatestRoundData(100, 209269774, 1000, 1000, 100);

      expect(
        await chainlinkOracle.callStatic.getAmountOut(token1.address, utils.parseUnits('100', 6)),
      ).to.be.equal('47785209535324485035');
    });

    it('get token0 price in token1', async () => {
      await priceFeed.setLatestRoundData(100, 209269774, 1000, 1000, 100);

      expect(
        await chainlinkOracle.callStatic.getAmountOut(token0.address, utils.parseUnits('10', 18)),
      ).to.be.equal('20926977');
    });
  });
});
