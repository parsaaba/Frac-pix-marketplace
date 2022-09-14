const { ethers, upgrades } = require('hardhat');

const usdc = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';

async function main() {
  const pixt = '0xE06Bd4F5aAc8D0aA337D13eC88dB6defC6eAEefE';
  const PIX = await ethers.getContractFactory('PIX');
  const pix = await upgrades.deployProxy(PIX, [pixt, usdc]);
  await pix.deployed();

  const PIXLandmark = await ethers.getContractFactory('PIXLandmark');
  const landmark = await upgrades.deployProxy(PIXLandmark, [pix.address]);
  await landmark.deployed();

  console.log('PIX at', pix.address);
  console.log('PIX Landmark at', landmark.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
