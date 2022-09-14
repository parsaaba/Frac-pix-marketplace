const { ethers, upgrades } = require('hardhat');
const { BigNumber } = require('ethers');

async function main() {
  const pixt = '0xae5039fc6D8360008419E169d54F1C81c665c55D';

  const PIXTStakingLottery = await ethers.getContractFactory('PIXTStakingLottery');
  const pIXTStakingLottery = await upgrades.deployProxy(PIXTStakingLottery, [
    pixt,
    BigNumber.from(10),
    3600,
  ]);

  console.log('PIXTStakingLottery deployed at', pIXTStakingLottery.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
