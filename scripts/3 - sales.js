const { ethers, upgrades } = require('hardhat');

async function main() {
  const pixtAddress = '0xE06Bd4F5aAc8D0aA337D13eC88dB6defC6eAEefE';
  const pixAddress = '0xB2435253C71FcA27bE41206EB2793E44e1Df6b6D';

  const PIXFixedSale = await ethers.getContractFactory('PIXFixedSale');
  const fixedSale = await upgrades.deployProxy(PIXFixedSale, [pixtAddress, pixAddress]);
  const PIXAuctionSale = await ethers.getContractFactory('PIXAuctionSale');
  const auctionSale = await upgrades.deployProxy(PIXAuctionSale, [pixtAddress, pixAddress]);

  await fixedSale.deployed();
  await auctionSale.deployed();

  console.log('Fixed sale at', fixedSale.address);
  console.log('Auction sale at', auctionSale.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
