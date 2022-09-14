import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Signer, Contract, utils, BigNumber } from 'ethers';
import { time } from '@openzeppelin/test-helpers';
import { increaseTime } from './utils';

describe('FractionalNFTVault', function () {
  let owner: Signer;
  let alice: Signer;
  let bob: Signer;
  let ownerAddress: String;
  let aliceAddress: String;
  let bobAddress: String;
  let fractionalSettings: Contract;
  let erc721NFTVaultFactory: Contract;
  let erc721NFTVault: Contract;
  let erc721AAA: Contract;
  let erc721BBB: Contract;

  const supply = 40;
  const listPrice = utils.parseEther('10'); // 10 ether
  const fee = 100; // 10%
  const userPrice = utils.parseEther('0.1'); // 0.1 ether
  const alicePrice = utils.parseEther('0.15'); // 0.15 ether
  const bobPrice = utils.parseEther('0.2'); // 0.2 ether

  before(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const FractionalSettings = await ethers.getContractFactory('FractionalSettings');
    fractionalSettings = await FractionalSettings.deploy();
    const ERC721NFTVaultFactory = await ethers.getContractFactory('ERC721NFTVaultFactory');
    erc721NFTVaultFactory = await ERC721NFTVaultFactory.deploy(fractionalSettings.address);
    const ERC721 = await ethers.getContractFactory('ERC721PresetMinterPauserAutoId');
    erc721AAA = await ERC721.deploy('AAA', 'A', '');
    erc721BBB = await ERC721.deploy('BBB', 'B', '');

    await erc721AAA.setApprovalForAll(erc721NFTVaultFactory.address, true);
    await erc721BBB.setApprovalForAll(erc721NFTVaultFactory.address, true);

    ownerAddress = await owner.getAddress();
    aliceAddress = await alice.getAddress();
    bobAddress = await bob.getAddress();
  });

  describe('#mint', () => {
      it('mint ERC721AAA & ERC721BBB', async function () {
        await erc721AAA.mint(ownerAddress);
        await erc721AAA.mint(ownerAddress);
        await erc721BBB.mint(ownerAddress);
        await erc721BBB.mint(ownerAddress);

        expect(await erc721AAA.balanceOf(ownerAddress)).equal('2');
        expect(await erc721BBB.balanceOf(ownerAddress)).equal('2');
      })

      it('mint FractionalERC721', async function () {
          await erc721NFTVaultFactory.mint('F+AAA+BBB', 'A+B', [erc721AAA.address, erc721AAA.address, erc721BBB.address, erc721BBB.address], [0, 1, 0, 1], supply, listPrice, fee);

          expect(await erc721NFTVaultFactory.vaultCount()).equal('1');

          erc721NFTVault = await ethers.getContractAt('ERC721NFTVault', await erc721NFTVaultFactory.vaults(0));
      })

      it('check erc721 supply/balance', async function () {
        expect(await erc721NFTVault.totalSupply()).equal(supply.toString());
        expect(await erc721NFTVault.balanceOf(ownerAddress)).equal(supply.toString());

        expect(await erc721BBB.balanceOf(erc721NFTVault.address)).equal('2');
        expect(await erc721BBB.balanceOf(erc721NFTVault.address)).equal('2');
      })
  })

  describe('#auction', () => {
      it('update user price', async function () {
          await erc721NFTVault.updateUserPrice(userPrice);

          expect(await erc721NFTVault.auctionState()).equal(0);
      })
      it('start', async function () {
          await expect(erc721NFTVault.start({value: utils.parseEther('0.01')})).to.revertedWith('start:too low bid')
          await erc721NFTVault.start({value: userPrice})

          expect(await erc721NFTVault.auctionState()).equal(1);
      })
      it('alice bid', async function () {
          await erc721NFTVault.connect(alice).bid({value: alicePrice});
      })
      it('bob bid', async function () {
          await erc721NFTVault.connect(bob).bid({value: bobPrice});
      })
      it('end', async function () {
          await increaseTime(BigNumber.from(3 * 24 * 3600));
          await erc721NFTVault.connect(bob).end();

          expect(await erc721NFTVault.auctionState()).equal(2);

          expect(await erc721BBB.balanceOf(erc721NFTVault.address)).equal('0');
          expect(await erc721BBB.balanceOf(erc721NFTVault.address)).equal('0');

          expect(await erc721BBB.balanceOf(bobAddress)).equal('2');
          expect(await erc721BBB.balanceOf(bobAddress)).equal('2');
      })
      it('cash', async function () {
          await expect(erc721NFTVault.connect(alice).cash()).to.revertedWith('cash:no tokens to cash out')

          await erc721NFTVault.cash();
          expect(await erc721NFTVault.balanceOf(ownerAddress)).equal('0');
      })
  })
})