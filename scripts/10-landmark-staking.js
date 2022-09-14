const { ethers, upgrades } = require('hardhat');
const { BigNumber } = require('ethers');

async function main() {
  const pixt = '0xE06Bd4F5aAc8D0aA337D13eC88dB6defC6eAEefE';
  const pixLand = '0x9AfB93F1E6D9b13546C4050BA39f0B48a4FB13A7';

  const PIXLandStaking = await ethers.getContractFactory('PIXLandStaking');
  const pixLandStaking = await upgrades.deployProxy(PIXLandStaking, [pixt, pixLand, BigNumber.from(10)]);

  console.log('PIXLand Staking at', pixLandStaking.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
