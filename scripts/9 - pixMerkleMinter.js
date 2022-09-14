const { ethers, upgrades } = require('hardhat');

async function main() {
  const pixAddress = '0xB2435253C71FcA27bE41206EB2793E44e1Df6b6D';
  const PIXMerkleMinter = await ethers.getContractFactory('PIXMerkleMinter');
  const contract = await upgrades.deployProxy(PIXMerkleMinter, [pixAddress]);
  await contract.deployed();

  console.log('Deployed at', contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
