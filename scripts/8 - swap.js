const { ethers } = require('hardhat');
const { constants } = require('ethers');

async function main() {
  const pixtAddress = '0xE06Bd4F5aAc8D0aA337D13eC88dB6defC6eAEefE';
  const quickSwapRouter = '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff';
  const sushiRouter = '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506';

  const SwapManager = await ethers.getContractFactory('SwapManager');
  const swapManager = SwapManager.attach('0x14804EA255F018542d66cf5311873F4Ed124D620');

  await swapManager.addOtherRouter(constants.AddressZero, pixtAddress, sushiRouter);

  console.log('Swap Manager at', swapManager.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
