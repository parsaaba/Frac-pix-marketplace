const { ethers, upgrades } = require('hardhat');

async function main() {
  const pixt = '0xE06Bd4F5aAc8D0aA337D13eC88dB6defC6eAEefE';
  const pix = '0xB2435253C71FcA27bE41206EB2793E44e1Df6b6D';
  const pixLandmark = '0x9AfB93F1E6D9b13546C4050BA39f0B48a4FB13A7';

  const PIXStaking = await ethers.getContractFactory('PIXStaking');
  const pixStaking = await upgrades.deployProxy(PIXStaking, [pixt, pix]);

  const PIXLandStaking = await ethers.getContractFactory('PIXLandStaking');
  const pixLandStaking = await upgrades.deployProxy(PIXLandStaking, [pixt, pixLandmark]);

  console.log('PIX Staking at', pixStaking.address);
  console.log('PIX Land Staking at', pixLandStaking.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
