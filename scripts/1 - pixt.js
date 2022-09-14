const { ethers } = require('hardhat');

async function main() {
  const PIXT = await ethers.getContractFactory('PIXT');
  const pixt = await PIXT.deploy();
  await pixt.deployed();

  const Vesting = await ethers.getContractFactory('Vesting');
  const vesting = await Vesting.deploy(pixt.address);
  await vesting.deployed();

  console.log('PIX Token at', pixt.address);
  console.log('Vesting at', vesting.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
