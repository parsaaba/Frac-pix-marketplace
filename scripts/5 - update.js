const { ethers } = require('hardhat');

async function main() {
  const ContractFactory = await ethers.getContractFactory('PIX');
  const contract = await ContractFactory.deploy();
  await contract.deployed();

  console.log('Deployed at', contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
