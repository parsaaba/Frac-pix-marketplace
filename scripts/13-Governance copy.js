const { ethers, upgrades } = require('hardhat');
const { BigNumber } = require('ethers');

async function main() {
  const pixt = '0xae5039fc6D8360008419E169d54F1C81c665c55D';
  const pix = '0x4BDcFa73220358b2072D58BD30ac565Ed1111B0c';
  const period = 3600 * 24;

  const Governance = await ethers.getContractFactory('Governance');
  const governance = await upgrades.deployProxy(Governance, [pixt, period]);

  console.log('Governance deployed at', governance.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
