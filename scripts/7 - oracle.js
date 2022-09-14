const { ethers } = require('hardhat');
const { constants } = require('ethers');

async function main() {
  const usdt = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
  const priceFeed = '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0';
  const pixtAddress = '0xE06Bd4F5aAc8D0aA337D13eC88dB6defC6eAEefE';
  const quickSwapFactory = '0x5757371414417b8c6caad45baef941abc7d3ab32';
  const weth = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';

  // const ChainlinkOracle = await ethers.getContractFactory('ChainlinkOracle');
  // const chainLinkOracle = await ChainlinkOracle.deploy(constants.AddressZero, usdt, priceFeed);

  const OracleManager = await ethers.getContractFactory('OracleManager');
  const oracleManager = OracleManager.attach('0x6aB819382A03D0DF86A2b95E2CD550Cd4148d34d');

  const UniV2Oracle = await ethers.getContractFactory('UniV2Oracle');
  const uniV2Oracle = UniV2Oracle.attach('0x328fFc1b3aaF7292FaD1b1A7b6E0A65669D54E5C');

  await uniV2Oracle.update();
  // await oracleManager.registerOracle(
  //   pixtAddress,
  //   usdt,
  //   '0x6Caeb550e7f55BcC2Cb7A9314db5AC93Fb060574',
  // );

  // console.log('ChainLinkOracle at', chainLinkOracle.address);
  // console.log('Oracle Manager at', oracleManager.address);
  console.log('UniV2Oracle at', uniV2Oracle.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
