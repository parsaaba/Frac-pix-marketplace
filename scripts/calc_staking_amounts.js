const stakingABI = require('./staking');
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider('https://rpc-mainnet.maticvigil.com'));
const contractInstance = new web3.eth.Contract(
  stakingABI,
  '0xB2435253C71FcA27bE41206EB2793E44e1Df6b6D',
);

let stakings = fs.readFileSync(path.resolve(__dirname, '../staking.csv'), 'utf-8').split('\n');

let tokenIds = [];
let amounts = [];
let count = 1;
let finalInfo = {};
let tempInfo = {};

(async () => {
  for (let i = 1; i < stakings.length; i++) {
    let stakeInfo = stakings[i].trim().split(',');
    let tokenId = stakeInfo[6];

    if (!tokenIds.includes(tokenId)) {
      let isStaked = false;
      for (let j = 1; j < stakings.length; j++) {
        let stakeData = stakings[j].trim().split(',');
        let nftId = stakeData[6];
        if (tokenId == nftId) {
          isStaked = !isStaked;
          if (isStaked) {
            const tier = await contractInstance.methods.getTier(stakeInfo[6]).call();
            tempInfo[count] = {
              date: stakeInfo[2],
              address: stakeInfo[3],
              tokenId: stakeInfo[6],
              tier: tier,
            };
          }
        }
      }
      if (isStaked) {
        finalInfo[count] = tempInfo[count];
        tokenIds.push(tokenId);
        count++;
      }
    }
  }
  fs.writeFileSync('./claiming.json', JSON.stringify(finalInfo, null, '\t'), 'utf-8');
})();
