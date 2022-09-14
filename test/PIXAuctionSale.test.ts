import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Contract, Wallet, BigNumber, utils, constants } from 'ethers';
import { ecsign } from 'ethereumjs-util';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  DENOMINATOR,
  generateRandomAddress,
  getCurrentTime,
  increaseTime,
  PIXCategory,
  PIXSize,
  getMerkleTree,
} from './utils';
const { keccak256, defaultAbiCoder, toUtf8Bytes, solidityPack } = utils;

describe('PIXAuctionSale', function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let treasury: string = generateRandomAddress();
  let pixtToken: Contract;
  let pixNFT: Contract;
  let auctionSale: Contract;
  let merkleMinter: Contract;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const PIXTFactory = await ethers.getContractFactory('PIXT');
    pixtToken = await PIXTFactory.connect(bob).deploy();

    const MockTokenFactory = await ethers.getContractFactory('MockToken');
    const usdc = await MockTokenFactory.deploy('Mock USDC', 'USDC', 6);

    const PIXFactory = await ethers.getContractFactory('PIX');
    pixNFT = await upgrades.deployProxy(PIXFactory, [pixtToken.address, usdc.address]);

    const PIXAuctionSaleFactory = await ethers.getContractFactory('PIXAuctionSale');
    auctionSale = await upgrades.deployProxy(PIXAuctionSaleFactory, [
      pixtToken.address,
      pixNFT.address,
    ]);

    await pixNFT.setTrader(auctionSale.address, true);
    await auctionSale.setWhitelistedNFTs(pixNFT.address, true);
    await pixtToken.connect(bob).approve(auctionSale.address, utils.parseEther('153258228'));
  });

  describe('#requestSale function', () => {
    const tokenId = 1;
    const minPrice = utils.parseEther('1');
    const auctionPeriod = BigNumber.from('3600');
    let endTime: BigNumber;

    beforeEach(async () => {
      await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Rare, PIXSize.Sector]);
      endTime = (await getCurrentTime()).add(auctionPeriod);
    });

    it('revert if nft token is not whitelisted', async () => {
      await expect(
        auctionSale.connect(alice).requestSale(generateRandomAddress(), [tokenId], endTime, 0),
      ).to.revertedWith('Sale: NOT_WHITELISTED_NFT');
    });

    it('revert if minPrice is 0', async () => {
      await expect(
        auctionSale.connect(alice).requestSale(pixNFT.address, [tokenId], endTime, 0),
      ).to.revertedWith('Sale: PRICE_ZERO');
    });

    it('revert if no tokens', async () => {
      await expect(
        auctionSale.connect(alice).requestSale(pixNFT.address, [], endTime, 1),
      ).to.revertedWith('Sale: NO_TOKENS');
    });

    it('revert if endTime is less than block timestamp', async () => {
      const oldEndTime = (await getCurrentTime()).sub(BigNumber.from('10'));
      await expect(
        auctionSale.connect(alice).requestSale(pixNFT.address, [tokenId], oldEndTime, minPrice),
      ).to.revertedWith('Sale: INVALID_TIME');
    });

    it('revert if PIX not approved', async () => {
      await expect(
        auctionSale.connect(alice).requestSale(pixNFT.address, [tokenId], endTime, minPrice),
      ).to.revertedWith('ERC721: transfer caller is not owner nor approved');
    });

    it('should request sale and emit SaleRequested event', async () => {
      await pixNFT.connect(alice).approve(auctionSale.address, tokenId);

      const tx = await auctionSale
        .connect(alice)
        .requestSale(pixNFT.address, [tokenId], endTime, minPrice);

      const lastSaleId = 1;
      const saleInfo = await auctionSale.saleInfo(lastSaleId);
      expect(saleInfo.seller).to.be.equal(await alice.getAddress());
      expect(saleInfo.nftToken).to.be.equal(pixNFT.address);
      expect(saleInfo.endTime).to.be.equal(endTime);
      expect(saleInfo.minPrice).to.be.equal(minPrice);

      expect(await pixNFT.ownerOf(tokenId)).to.be.equal(auctionSale.address);

      await expect(tx)
        .emit(auctionSale, 'SaleRequested')
        .withArgs(
          await alice.getAddress(),
          lastSaleId,
          pixNFT.address,
          endTime,
          [tokenId],
          minPrice,
        );
    });
  });

  describe('#updateSale function', () => {
    const tokenId = 1;
    const minPrice = utils.parseEther('1');
    const auctionPeriod = BigNumber.from('3600');
    let endTime: BigNumber;

    beforeEach(async () => {
      await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Rare, PIXSize.Sector]);
      await pixNFT.connect(alice).approve(auctionSale.address, tokenId);
      endTime = (await getCurrentTime()).add(auctionPeriod);

      await auctionSale.connect(alice).requestSale(pixNFT.address, [tokenId], endTime, minPrice);
    });

    it('revert if msg.sender is not seller', async () => {
      await expect(auctionSale.connect(bob).updateSale(tokenId, endTime)).to.revertedWith(
        'Sale: NOT_SELLER',
      );
    });

    it('revert if endTime is less than block timestamp', async () => {
      const oldEndTime = (await getCurrentTime()).sub(BigNumber.from('10'));
      await expect(auctionSale.connect(alice).updateSale(tokenId, oldEndTime)).to.revertedWith(
        'Sale: INVALID_TIME',
      );
    });

    it('should update sale and emit SaleUpdated event', async () => {
      const newEndTime = endTime.add(auctionPeriod);
      const tx = await auctionSale.connect(alice).updateSale(tokenId, newEndTime);

      const lastSaleId = 1;
      const saleInfo = await auctionSale.saleInfo(lastSaleId);
      expect(saleInfo.seller).to.be.equal(await alice.getAddress());
      expect(saleInfo.nftToken).to.be.equal(pixNFT.address);
      expect(saleInfo.endTime).to.be.equal(newEndTime);

      await expect(tx).emit(auctionSale, 'SaleUpdated').withArgs(tokenId, newEndTime);
    });
  });

  describe('#cancelSale function', () => {
    const tokenId = 1;
    const minPrice = utils.parseEther('1');
    const auctionPeriod = BigNumber.from('3600');
    let endTime: BigNumber;

    beforeEach(async () => {
      await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Rare, PIXSize.Sector]);
      await pixNFT.connect(alice).approve(auctionSale.address, tokenId);
      endTime = (await getCurrentTime()).add(auctionPeriod);

      await auctionSale.connect(alice).requestSale(pixNFT.address, [tokenId], endTime, minPrice);
    });

    it('revert if msg.sender is not seller', async () => {
      await expect(auctionSale.connect(bob).cancelSale(tokenId)).to.revertedWith(
        'Sale: NOT_SELLER',
      );
    });

    it('should cancel sale and emit SaleCancelled event', async () => {
      const tx = await auctionSale.connect(alice).cancelSale(tokenId);

      const lastSaleId = 1;
      const saleInfo = await auctionSale.saleInfo(lastSaleId);
      expect(saleInfo.seller).to.be.equal(constants.AddressZero);
      expect(saleInfo.nftToken).to.be.equal(constants.AddressZero);
      expect(saleInfo.endTime).to.be.equal(0);
      expect(saleInfo.minPrice).to.be.equal(0);

      expect(await pixNFT.ownerOf(tokenId)).to.be.equal(await alice.getAddress());

      await expect(tx).emit(auctionSale, 'SaleCancelled').withArgs(lastSaleId);
    });
  });

  describe('#endAuction function', () => {
    const tokenId = 1;
    const minPrice = utils.parseEther('1');
    const auctionPeriod = BigNumber.from('3600');
    let endTime: BigNumber;

    beforeEach(async () => {
      await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Rare, PIXSize.Sector]);
      await pixNFT.connect(alice).approve(auctionSale.address, tokenId);
      endTime = (await getCurrentTime()).add(auctionPeriod);
    });

    it('revert if invalid signature', async () => {
      const data = await getDigest(auctionSale, alice, minPrice, BigNumber.from(tokenId));
      await auctionSale.connect(alice).requestSale(pixNFT.address, [tokenId], endTime, minPrice);
      await increaseTime(auctionPeriod.add(auctionPeriod));
      await expect(
        auctionSale.endAuction(await bob.getAddress(), minPrice, tokenId, data.v, data.r, data.s),
      ).to.revertedWith('Sale: INVALID_SIGNATURE');
    });

    it('should end auction and send PIX to top bidder and send PIXT to seller and treasury', async () => {
      await auctionSale.setTreasury(treasury, 50, 50, false);
      const bidAmount = minPrice.add(utils.parseEther('0.5'));

      const data = await getDigest(auctionSale, bob, bidAmount, BigNumber.from(tokenId));

      await auctionSale.connect(alice).requestSale(pixNFT.address, [tokenId], endTime, minPrice);
      await increaseTime(auctionPeriod.add(auctionPeriod));

      const aliceBalanceBefore = await pixtToken.balanceOf(await alice.getAddress());
      const treasuryBalanceBefore = await pixtToken.balanceOf(treasury);
      const tx = await auctionSale.endAuction(
        await bob.getAddress(),
        bidAmount,
        tokenId,
        data.v,
        data.r,
        data.s,
      );
      expect(await pixNFT.ownerOf(tokenId)).to.be.equal(await bob.getAddress());
      const fee = bidAmount.mul(BigNumber.from('100')).div(DENOMINATOR);
      expect(await pixtToken.balanceOf(await alice.getAddress())).to.be.equal(
        aliceBalanceBefore.add(bidAmount).sub(fee),
      );
      expect(await pixtToken.balanceOf(treasury)).to.be.equal(
        treasuryBalanceBefore.add(fee.div(2)),
      );
      expect(tx)
        .to.emit(auctionSale, 'Purchased')
        .withArgs(await alice.getAddress(), await bob.getAddress(), tokenId, bidAmount);

      const lastSaleId = 1;
      const saleInfo = await auctionSale.saleInfo(lastSaleId);
      expect(saleInfo.seller).to.be.equal(constants.AddressZero);
      expect(saleInfo.endTime).to.be.equal(0);
      expect(saleInfo.minPrice).to.be.equal(0);
    });

    it('should not send fee if zero', async () => {
      const bidAmount = minPrice.add(utils.parseEther('0.5'));

      const data = await getDigest(auctionSale, bob, bidAmount, BigNumber.from(tokenId));

      await auctionSale.connect(alice).requestSale(pixNFT.address, [tokenId], endTime, minPrice);
      await increaseTime(auctionPeriod.add(auctionPeriod));

      const aliceBalanceBefore = await pixtToken.balanceOf(await alice.getAddress());
      const treasuryBalanceBefore = await pixtToken.balanceOf(treasury);
      const tx = await auctionSale.endAuction(
        await bob.getAddress(),
        bidAmount,
        tokenId,
        data.v,
        data.r,
        data.s,
      );
      expect(await pixNFT.ownerOf(tokenId)).to.be.equal(await bob.getAddress());
      expect(await pixtToken.balanceOf(await alice.getAddress())).to.be.equal(
        aliceBalanceBefore.add(bidAmount),
      );
      expect(await pixtToken.balanceOf(treasury)).to.be.equal(treasuryBalanceBefore);
      expect(tx)
        .to.emit(auctionSale, 'Purchased')
        .withArgs(await alice.getAddress(), await bob.getAddress(), tokenId, bidAmount);

      const lastSaleId = 1;
      const saleInfo = await auctionSale.saleInfo(lastSaleId);
      expect(saleInfo.seller).to.be.equal(constants.AddressZero);
      expect(saleInfo.endTime).to.be.equal(0);
      expect(saleInfo.minPrice).to.be.equal(0);
    });
  });

  describe('#requestSaleWithHash function', () => {
    const tokenId = 1;
    let merkleTreeInfo;
    let alicePixes = [];
    let hexProofs = [];
    let merkleRoots = [];
    const aliceIndices = [1, 2];
    const minPrice = utils.parseEther('1');
    const auctionPeriod = BigNumber.from('3600');
    let endTime: BigNumber;

    beforeEach(async () => {
      const PIXMerkleMinterFactory = await ethers.getContractFactory('PIXMerkleMinter');
      merkleMinter = await upgrades.deployProxy(PIXMerkleMinterFactory, [pixNFT.address]);

      await pixNFT.setModerator(merkleMinter.address, true);

      await auctionSale.setPixMerkleMinter(merkleMinter.address);

      await merkleMinter.setDelegateMinter(auctionSale.address, true);

      merkleTreeInfo = getMerkleTree([bob, alice, alice, bob, owner]);

      await merkleMinter.setMerkleRoot(merkleTreeInfo.merkleTree.getRoot(), true);

      hexProofs = aliceIndices.map((idx) =>
        merkleTreeInfo.merkleTree.getHexProof(merkleTreeInfo.leafNodes[idx]),
      );

      merkleRoots = aliceIndices.map(() => merkleTreeInfo.merkleTree.getRoot());

      alicePixes = aliceIndices.map((idx) => [
        merkleTreeInfo.pixes[idx].pixId,
        merkleTreeInfo.pixes[idx].category,
        merkleTreeInfo.pixes[idx].size,
      ]);

      await pixNFT.safeMint(alice.address, [0, PIXCategory.Rare, PIXSize.Sector]);
      await pixNFT.safeMint(alice.address, [0, PIXCategory.Rare, PIXSize.Sector]);

      await pixNFT.connect(alice).approve(auctionSale.address, tokenId);

      endTime = (await getCurrentTime()).add(auctionPeriod);
    });

    it('revert if price is 0', async () => {
      await expect(
        auctionSale
          .connect(alice)
          .requestSaleWithHash([], endTime, 0, alicePixes, merkleRoots, hexProofs),
      ).to.revertedWith('Sale: PRICE_ZERO');
    });

    it('should request sale and emit SaleRequested event', async () => {
      const tx = await auctionSale
        .connect(alice)
        .requestSaleWithHash([tokenId], endTime, minPrice, alicePixes, merkleRoots, hexProofs);

      const lastSaleId = 1;
      expect(await auctionSale.lastSaleId()).to.be.equal(lastSaleId);

      const saleInfo = await auctionSale.saleInfo(lastSaleId);
      expect(saleInfo.seller).to.be.equal(alice.address);
      expect(saleInfo.nftToken).to.be.equal(pixNFT.address);
      expect(saleInfo.minPrice).to.be.equal(minPrice);
      expect(saleInfo.endTime).to.be.equal(endTime);

      expect(await pixNFT.ownerOf(tokenId)).to.be.equal(auctionSale.address);
      expect(await pixNFT.ownerOf(3)).to.be.equal(auctionSale.address);
      expect(await pixNFT.ownerOf(4)).to.be.equal(auctionSale.address);

      await expect(tx)
        .emit(auctionSale, 'SaleRequested')
        .withArgs(alice.address, lastSaleId, pixNFT.address, endTime, [tokenId, 3, 4], minPrice);
    });
  });
});

const getDigest = async (
  sale: Contract,
  buyer: SignerWithAddress,
  price: BigNumber,
  saleId: BigNumber,
) => {
  const domain = {
    name: 'PlanetIX',
    version: '1',
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: sale.address,
  };

  const types = {
    BidMessage: [
      { name: 'bidder', type: 'address' },
      { name: 'price', type: 'uint256' },
      { name: 'saleId', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
    ],
  };

  const value = {
    bidder: buyer.address,
    price,
    saleId,
    nonce: await sale.nonces(await buyer.getAddress(), saleId),
  };

  const signature = await buyer._signTypedData(domain, types, value);
  return utils.splitSignature(signature);
};
