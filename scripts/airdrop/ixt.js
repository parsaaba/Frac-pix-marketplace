const hre = require('hardhat');

const csv = require('csvtojson');
const { web3 } = require('hardhat');

async function main() {
  const Airdrop = await hre.ethers.getContractFactory('Airdrop');
  const airdrop = await Airdrop.attach('0x2334bC478C60beE7674529580659CD6c115cBCbC');
  const IXT = await hre.ethers.getContractFactory('PIXT');
  const ixt = await IXT.attach('0xE06Bd4F5aAc8D0aA337D13eC88dB6defC6eAEefE');
  const csvFilePath = './scripts/airdrop/ixt.csv';

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
      amounts.push(web3.utils.toWei(data[index]['IXT'], 'ether'));
      value += parseInt(data[index]['IXT']);
      index++;
    }

    await ixt.increaseAllowance(
      '0x2334bC478C60beE7674529580659CD6c115cBCbC',
      web3.utils.toWei(value.toString(), 'ether'),
    );

    const response = await airdrop.airdrop(
      '0xE06Bd4F5aAc8D0aA337D13eC88dB6defC6eAEefE',
      recipients,
      amounts,
      { gasPrice: 80000000000, gasLimit: 9000000 },
    );

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
