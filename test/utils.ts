import { Wallet, BigNumber, utils } from 'ethers';
import { time } from '@openzeppelin/test-helpers';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
const { web3 } = require('@openzeppelin/test-helpers/src/setup');

export const DENOMINATOR = BigNumber.from('10000');

export const generateRandomAddress = () => Wallet.createRandom().address;

export const getCurrentTime = async (): Promise<BigNumber> =>
  BigNumber.from((await time.latest()).toString());

export const increaseTime = async (period: BigNumber) => {
  await time.increase(period.toString());
};

export enum PIXCategory {
  Legendary = 0,
  Rare = 1,
  Uncommon = 2,
  Common = 3,
  Outliers = 4,
}

export enum PIXSize {
  Pix = 0,
  Area = 1,
  Sector = 2,
  Zone = 3,
  Domain = 4,
}

const generateRandomPixes = (accounts: (SignerWithAddress | Wallet)[] | undefined) => {
  let randomPixes = [];

  if (accounts) {
    for (let i = 0; i < accounts.length; i += 1) {
      randomPixes.push({
        to: accounts[i].address,
        pixId: i + 1,
        category: PIXCategory.Common,
        size: PIXSize.Pix,
      });
    }
  } else {
    let count = 1000;
    for (let i = 0; i < count; i += 1) {
      randomPixes.push({
        to: generateRandomAddress(),
        pixId: i + 1,
        category: PIXCategory.Common,
        size: PIXSize.Pix,
      });
    }
  }

  return randomPixes;
};

export const getMerkleTree = (accounts: (SignerWithAddress | Wallet)[] | undefined) => {
  const pixes = generateRandomPixes(accounts);
  const leafNodes = pixes.map((pix) =>
    keccak256(
      utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint8', 'uint8'],
        [pix.to, pix.pixId, pix.category, pix.size],
      ),
    ),
  );
  const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
  return {
    merkleTree,
    leafNodes,
    pixes,
  };
};

export const advanceTime = (time) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: '2.0',
        method: 'evm_increaseTime',
        params: [time],
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      },
    );
  });
};
