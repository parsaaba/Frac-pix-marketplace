const { ethers, upgrades } = require('hardhat');
const { BigNumber } = require('ethers');

async function main() {
  const pixt = '0xae5039fc6D8360008419E169d54F1C81c665c55D';
  const pix = '0x4BDcFa73220358b2072D58BD30ac565Ed1111B0c';

  const PIXLending = await ethers.getContractFactory('PIXLending');
  const pIXLending = await upgrades.deployProxy(PIXLending, [pixt, pix, BigNumber.from(10)]);

  console.log('PIXLending deployed at', pIXLending.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
