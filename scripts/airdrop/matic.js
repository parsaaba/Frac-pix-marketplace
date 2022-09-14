const hre = require('hardhat');
const ethers = require('ethers');

const csv = require('csvtojson');
const { web3 } = require('hardhat');

async function main() {
  const Airdrop = await hre.ethers.getContractFactory('Airdrop');
  const airdrop = await Airdrop.attach('0x2334bC478C60beE7674529580659CD6c115cBCbC');
  const csvFilePath = './scripts/airdrop/matic.csv';

  const data = await csv().fromFile(csvFilePath);

  let index = 0;
  let value = 0;

  while (index < data.length) {
    // reset arrays
    recipients = [];
    amounts = [];
    // fill up array with next 150 items
    value = 0;
    for (let i = 0; i < 100; i++) {
      // break out of here if data is complete, batch is full
      if (index == data.length) {
        break;
      }
      recipients.push(data[index]['wallet_address']);
      const amount = web3.utils.toWei(data[index]['MATIC'], 'ether');
      amounts.push(amount);
      value += parseInt(amount);
      index++;
    }

    value = value.toString();

    const response = await airdrop.airdrop(ethers.constants.AddressZero, recipients, amounts, {
      gasPrice: 80000000000,
      gasLimit: 9000000,
      value,
    });

    const receipt = await response.wait(1);
    console.log(receipt);
    console.log('============================', index);
  }
}

main()
  .then(() => console.log('continue'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
