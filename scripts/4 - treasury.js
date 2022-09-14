const { ethers, upgrades } = require('hardhat');

async function main() {
  const pixtAddress = '0xE06Bd4F5aAc8D0aA337D13eC88dB6defC6eAEefE';

  const PIXTreasury = await ethers.getContractFactory('PIXTreasury');
  const treasury1 = await PIXTreasury.deploy(pixtAddress);
  const treasury2 = await PIXTreasury.deploy(pixtAddress);
  const treasury3 = await PIXTreasury.deploy(pixtAddress);

  await treasury1.deployed();
  await treasury2.deployed();
  await treasury3.deployed();

  console.log('Treasury1 at', treasury1.address);
  console.log('Treasury2 at', treasury2.address);
  console.log('Treasury3 at', treasury3.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
