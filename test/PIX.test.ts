import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { Signer, Contract, BigNumber, constants, utils } from 'ethers';
import { PIXCategory, PIXSize, DENOMINATOR, getCurrentTime } from './utils';

describe('PIX', function () {
  let owner: Signer;
  let alice: Signer;
  let pixToken: Contract;
  let pixNFT: Contract;
  let oracleManager: Contract;
  let usdc: Contract;
  const price = utils.parseUnits('5', 6);
  const ZeroAddress = ethers.constants.AddressZero;

  beforeEach(async function () {
    [owner, alice] = await ethers.getSigners();

    const PIXTFactory = await ethers.getContractFactory('PIXT');
    pixToken = await PIXTFactory.deploy();

    const MockTokenFactory = await ethers.getContractFactory('MockToken');
    usdc = await MockTokenFactory.deploy('Mock USDC', 'USDC', 6);

    const OracleManagerFactory = await ethers.getContractFactory('OracleManager');
    oracleManager = await OracleManagerFactory.deploy();

    const PIXFactory = await ethers.getContractFactory('PIX');
    pixNFT = await upgrades.deployProxy(PIXFactory, [pixToken.address, usdc.address]);
    await pixToken.transfer(await alice.getAddress(), utils.parseEther('20000'));
    await pixToken.connect(alice).approve(pixNFT.address, constants.MaxUint256);
    await usdc.transfer(await alice.getAddress(), utils.parseUnits('20000', 6));
    await usdc.connect(alice).approve(pixNFT.address, constants.MaxUint256);

    await pixNFT.setDropInfo(1, [
      100,
      0,
      10,
      (await getCurrentTime()).sub(100),
      (await getCurrentTime()).add(1000000000),
    ]);
  });

  describe('#initialize', () => {
    it('revert if token is zero address', async function () {
      const PIX = await ethers.getContractFactory('PIX');
      await expect(upgrades.deployProxy(PIX, [ZeroAddress, usdc.address])).to.revertedWith(
        'Pix: INVALID_PIXT',
      );
    });

    it('check initial values', async function () {
      expect(await pixNFT.combineCounts(PIXSize.Area)).equal(5);
      expect(await pixNFT.packPrices(0)).equal(utils.parseUnits('5', 6));
      expect(await pixNFT.packPrices(1)).equal(utils.parseUnits('50', 6));
      expect(await pixNFT.packPrices(2)).equal(utils.parseUnits('100', 6));
      expect(await pixNFT.packPrices(3)).equal(utils.parseUnits('250', 6));
      expect(await pixNFT.packPrices(4)).equal(utils.parseUnits('500', 6));
      expect(await pixNFT.packPrices(5)).equal(utils.parseUnits('1000', 6));
      expect(await pixNFT.moderators(await owner.getAddress())).equal(true);
      expect(await pixNFT.pixToken()).equal(pixToken.address);
      expect(await pixNFT.tokenForPrice()).equal(usdc.address);
      expect(await pixNFT.paymentTokens(usdc.address)).equal(true);
      expect(await pixNFT.paymentTokens(pixToken.address)).equal(true);
    });
  });

  describe('#withdraw', () => {
    it('revert if msg.sender is not owner', async () => {
      await expect(pixNFT.connect(alice).withdraw([])).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('should withdraw erc20 tokens to owner address', async () => {
      await pixNFT.connect(alice).requestBatchMint(usdc.address, 1, 1, 1, 1);
      expect(await usdc.balanceOf(pixNFT.address)).to.equal(utils.parseUnits('5', 6));
      await pixNFT.withdraw([usdc.address]);
      expect(await usdc.balanceOf(pixNFT.address)).to.equal(0);
    });
  });

  describe('#setModerator', () => {
    it('revert if msg.sender is not owner', async () => {
      await expect(
        pixNFT.connect(alice).setModerator(await alice.getAddress(), true),
      ).to.revertedWith('Ownable: caller is not the owner');
    });

    it('revert if moderator is zero address', async () => {
      await expect(pixNFT.setModerator(ZeroAddress, true)).to.revertedWith(
        'Pix: INVALID_MODERATOR',
      );
    });

    it('should set moderator by owner', async () => {
      await pixNFT.setModerator(await alice.getAddress(), true);
      expect(await pixNFT.moderators(await alice.getAddress())).to.equal(true);

      await pixNFT.setModerator(await alice.getAddress(), false);
      expect(await pixNFT.moderators(await alice.getAddress())).to.equal(false);
    });
  });

  describe('#setCombinePrice', () => {
    it('revert if msg.sender is not owner', async () => {
      await expect(pixNFT.connect(alice).setCombinePrice(price)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('should set price by owner', async () => {
      await pixNFT.setCombinePrice(price);
      expect(await pixNFT.combinePrice()).to.equal(price);
    });
  });

  describe('#setPaymentToken', () => {
    it('revert if msg.sender is not owner', async () => {
      await expect(pixNFT.connect(alice).setPaymentToken(pixToken.address, false)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('should set payment token by owner', async () => {
      await pixNFT.setPaymentToken(ZeroAddress, true);
      expect(await pixNFT.paymentTokens(ZeroAddress)).to.equal(true);
    });
  });

  describe('#setTreasury', () => {
    it('revert if msg.sender is not owner', async () => {
      await expect(pixNFT.connect(alice).setTreasury(await owner.getAddress(), 25)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('revert if treasury is zero address', async () => {
      await expect(pixNFT.setTreasury(ZeroAddress, 25)).to.revertedWith('Pix: INVALID_TREASURY');
    });

    it('revert if fee is over 10000', async () => {
      await expect(
        pixNFT.setTreasury(await alice.getAddress(), DENOMINATOR.add(BigNumber.from(1))),
      ).to.revertedWith('Pix: FEE_OVERFLOW');
    });

    it('should set treasury by owner', async () => {
      await pixNFT.setTreasury(await owner.getAddress(), 25);
      const treasury = await pixNFT.treasury();
      expect(treasury[0]).to.equal(await owner.getAddress());
      expect(treasury[1]).to.equal(25);
    });
  });

  describe('#setOracleManager', () => {
    it('revert if msg.sender is not owner', async () => {
      await expect(pixNFT.connect(alice).setOracleManager(oracleManager.address)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('revert if oracle manager is zero address', async () => {
      await expect(pixNFT.setOracleManager(ZeroAddress)).to.revertedWith(
        'Pix: INVALID_ORACLE_MANAGER',
      );
    });

    it('should set oracle manager by owner', async () => {
      await pixNFT.setOracleManager(oracleManager.address);
      expect(await pixNFT.oracleManager()).to.equal(oracleManager.address);
    });
  });

  describe('#setSwapManager', () => {
    it('revert if msg.sender is not owner', async () => {
      await expect(pixNFT.connect(alice).setSwapManager(await alice.getAddress())).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('revert if swap manager is zero address', async () => {
      await expect(pixNFT.setSwapManager(ZeroAddress)).to.revertedWith('Pix: INVALID_SWAP_MANAGER');
    });

    it('should set swap manager by owner', async () => {
      await pixNFT.setSwapManager(await alice.getAddress());
      expect(await pixNFT.swapManager()).to.equal(await alice.getAddress());
    });
  });

  describe('#requestBatchMint', function () {
    it('revert if payment token is not approved', async function () {
      await expect(pixNFT.connect(alice).requestBatchMint(ZeroAddress, 1, 1, 1, 1)).to.revertedWith(
        'Pix: TOKEN_NOT_APPROVED',
      );
    });

    it('revert if count overflow', async function () {
      await expect(
        pixNFT.connect(alice).requestBatchMint(pixToken.address, 1, 1, 0, 101),
      ).to.revertedWith('Pix: PACKS_ALL_SOLD_OUT');
    });

    it('revert if count per user overflow', async function () {
      await expect(
        pixNFT.connect(alice).requestBatchMint(pixToken.address, 1, 1, 0, 11),
      ).to.revertedWith('Pix: OVERFLOW_LIMIT');
    });

    it('revert if token not approved', async function () {
      await expect(
        pixNFT.connect(alice).requestBatchMint(constants.AddressZero, 1, 1, 0, 1),
      ).to.revertedWith('Pix: TOKEN_NOT_APPROVED');
    });

    it('should request mint', async function () {
      const tx = await pixNFT.connect(alice).requestBatchMint(usdc.address, 1, 1, 1, 1);
      expect(tx).to.emit(pixNFT, 'Requested').withArgs(1, 1, 1, 1, 1);
      expect((await pixNFT.packRequests(await alice.getAddress()))[1]).to.equal(1);
      expect(await usdc.balanceOf(pixNFT.address)).equal(price);
    });
  });

  describe('#mintTo', () => {
    it('revert if msg.sender is not moderator', async function () {
      await expect(pixNFT.connect(alice).mintTo(await alice.getAddress(), [], [])).to.revertedWith(
        'Pix: NON_MODERATOR',
      );
    });

    it('revert if invalid parameters', async function () {
      await pixNFT.connect(alice).requestBatchMint(usdc.address, 1, 1, 1, 1);
      await expect(pixNFT.mintTo(await alice.getAddress(), [1], [])).to.revertedWith(
        'Pix: INVALID_LENGTH',
      );
    });

    it('should mint new pixes by moderator', async () => {
      await pixNFT.connect(alice).requestBatchMint(usdc.address, 1, 1, 1, 1);

      const pixIds = [];
      const categories = [];
      for (let i = 0; i < 50; i++) {
        pixIds.push(i + 1);
        categories.push(PIXCategory.Legendary);
      }
      await pixNFT.mintTo(await alice.getAddress(), pixIds, categories);
      expect(await pixNFT.balanceOf(await alice.getAddress())).to.equal(50);
    });
  });

  describe('#completeRequest', () => {
    it('revert if caller is not moderator', async () => {
      await expect(pixNFT.connect(alice).completeRequest(await alice.getAddress())).to.revertedWith(
        'Pix: NON_MODERATOR',
      );
    });

    it('should complete request', async () => {
      await pixNFT.connect(alice).requestBatchMint(usdc.address, 1, 1, 1, 1);
      await pixNFT.completeRequest(await alice.getAddress());
      expect(await pixNFT.pendingPackType(await alice.getAddress())).to.equal(0);
    });
  });

  describe('#safeMint', () => {
    it('revert if pix info is invalid', async () => {
      await expect(
        pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Common, PIXSize.Pix]),
      ).to.revertedWith('Pix: INVALID_ARGUMENTS');
      await expect(
        pixNFT.safeMint(await alice.getAddress(), [1, PIXCategory.Common, PIXSize.Zone]),
      ).to.revertedWith('Pix: INVALID_ARGUMENTS');
    });

    it('should safe mint', async () => {
      await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Common, PIXSize.Zone]);
      const tx = await pixNFT.safeMint(await alice.getAddress(), [
        1,
        PIXCategory.Common,
        PIXSize.Pix,
      ]);
      expect(tx)
        .to.emit(pixNFT, 'PIXMinted')
        .withArgs(await alice.getAddress(), 2, 1, PIXCategory.Common, PIXSize.Pix);
      expect(await pixNFT.totalSupply()).to.equal(2);
    });
  });

  describe('#batchMint', () => {
    it('should batch mint', async () => {
      const infos = [];
      for (let i = 0; i < 10; i++) {
        infos.push([0, PIXCategory.Common, PIXSize.Zone]);
      }
      await pixNFT.batchMint(await alice.getAddress(), infos);
      expect(await pixNFT.totalSupply()).to.equal(10);
    });
  });

  describe('#updateTerritoryInfo', () => {
    beforeEach(async () => {
      await pixNFT.safeMint(await alice.getAddress(), [1, PIXCategory.Common, PIXSize.Pix]);
      await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Common, PIXSize.Area]);
    });

    it('revert if update non-territory info', async () => {
      await expect(pixNFT.updateTerritoryInfo(1, 1)).to.revertedWith('Pix: TERRITORIES_ONLY');
    });

    it('should update territory info', async () => {
      await pixNFT.updateTerritoryInfo(2, 1);
      expect((await pixNFT.pixInfos(2))[0]).to.equal(1);
      await expect(pixNFT.updateTerritoryInfo(2, 1)).to.revertedWith('Pix: TERRITORY_ALREADY_SET');
    });
  });

  describe('#combine', () => {
    it('revert if no tokens', async () => {
      await expect(pixNFT.combine([])).to.revertedWith('Pix: NO_TOKENS');
    });

    it('revert if size is domain', async () => {
      await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Rare, PIXSize.Domain]);
      await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Rare, PIXSize.Domain]);
      await expect(pixNFT.combine([1, 2])).to.revertedWith('Pix: MAX_NOT_ALLOWED');
    });

    it('revert if combine length is invalid', async () => {
      await pixNFT.safeMint(await alice.getAddress(), [1, PIXCategory.Rare, PIXSize.Pix]);
      await pixNFT.safeMint(await alice.getAddress(), [1, PIXCategory.Rare, PIXSize.Pix]);
      await expect(pixNFT.combine([1, 2])).to.revertedWith('Pix: INVALID_ARGUMENTS');
    });

    it('revert if to combine different size', async () => {
      await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Rare, PIXSize.Zone]);
      await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Rare, PIXSize.Sector]);
      await expect(pixNFT.combine([1, 2])).to.revertedWith('Pix: SAME_SIZE_ONLY');
    });

    it('revert if to combine different categories', async () => {
      await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Rare, PIXSize.Sector]);
      await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Common, PIXSize.Sector]);
      await expect(pixNFT.combine([1, 2])).to.revertedWith('Pix: SAME_CATEGORY_ONLY');
    });

    it('revert if not owner', async () => {
      const tokenIds = [];
      await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Rare, PIXSize.Zone]);
      tokenIds.push(1);
      await pixNFT.safeMint(await owner.getAddress(), [0, PIXCategory.Rare, PIXSize.Zone]);
      tokenIds.push(2);
      await expect(pixNFT.combine(tokenIds)).to.revertedWith('Pix: NON_APPROVED');
    });

    it('should combine pixes to mint area', async () => {
      const tokenIds = [];
      for (let i = 0; i < 50; i++) {
        await pixNFT.safeMint(await alice.getAddress(), [
          i + 1,
          PIXCategory.Legendary,
          PIXSize.Pix,
        ]);
        tokenIds.push(i + 1);
      }
      const tx = await pixNFT.combine(tokenIds);
      expect(await pixNFT.ownerOf(51)).to.equal(await alice.getAddress());
      expect(tx).to.emit(pixNFT, 'Combined').withArgs(51, PIXCategory.Legendary, PIXSize.Area);
      expect(await pixNFT.totalSupply()).to.equal(1);
    });

    it('should combine areas to mint sector', async () => {
      const tokenIds = [];
      for (let i = 0; i < 5; i++) {
        await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Common, PIXSize.Area]);
        tokenIds.push(i + 1);
      }
      const tx = await pixNFT.combine(tokenIds);
      expect(await pixNFT.ownerOf(6)).to.equal(await alice.getAddress());
      expect(tx).to.emit(pixNFT, 'Combined').withArgs(6, PIXCategory.Common, PIXSize.Sector);
      expect(await pixNFT.totalSupply()).to.equal(1);
    });

    it('should combine sectors to mint zone', async () => {
      const tokenIds = [];
      for (let i = 0; i < 2; i++) {
        await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Common, PIXSize.Sector]);
        tokenIds.push(i + 1);
      }
      const tx = await pixNFT.combine(tokenIds);
      expect(await pixNFT.ownerOf(3)).to.equal(await alice.getAddress());
      expect(tx).to.emit(pixNFT, 'Combined').withArgs(3, PIXCategory.Common, PIXSize.Zone);
      expect(await pixNFT.totalSupply()).to.equal(1);
    });

    it('should combine zone to mint domain', async () => {
      const tokenIds = [];
      for (let i = 0; i < 2; i++) {
        await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Common, PIXSize.Zone]);
        tokenIds.push(i + 1);
      }
      const tx = await pixNFT.combine(tokenIds);
      expect(await pixNFT.ownerOf(3)).to.equal(await alice.getAddress());
      expect(tx).to.emit(pixNFT, 'Combined').withArgs(3, PIXCategory.Common, PIXSize.Domain);
      expect(await pixNFT.totalSupply()).to.equal(1);
    });
  });

  describe('#setBaseURI', () => {
    const uri = 'https://planetix.com/nfts/';

    it('revert if msg.sender is not owner', async () => {
      await expect(pixNFT.connect(alice).setBaseURI(uri)).to.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('should set base uri by owner', async () => {
      await pixNFT.setBaseURI(uri);
      await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Rare, PIXSize.Sector]);
      expect(await pixNFT.tokenURI(1)).to.equal(uri + '1');
    });
  });

  describe('#approve', () => {
    beforeEach(async () => {
      await pixNFT.safeMint(await alice.getAddress(), [0, PIXCategory.Rare, PIXSize.Sector]);
    });

    it('revert if current owner', async () => {
      await expect(pixNFT.approve(await alice.getAddress(), 1)).to.revertedWith(
        'ERC721: approval to current owner',
      );
    });

    it('revert if non owner calls', async () => {
      await expect(pixNFT.approve(await owner.getAddress(), 1)).to.revertedWith(
        'ERC721: approve caller is not the owner nor approved for all',
      );
    });

    it('revert if caller is not trader', async () => {
      await expect(pixNFT.connect(alice).approve(pixToken.address, 1)).to.revertedWith(
        'Pix: NON_WHITELISTED_TRADER',
      );
    });

    it('should approve new trader', async () => {
      await pixNFT.setTrader(pixToken.address, true);
      await pixNFT.connect(alice).approve(pixToken.address, 1);
      expect(await pixNFT.getApproved(1)).to.equal(pixToken.address);
    });
  });

  describe('#setApprovalForAll', () => {
    it('revert if owner = operator', async () => {
      await expect(pixNFT.setApprovalForAll(await owner.getAddress(), false)).to.revertedWith(
        'ERC721: approve to caller',
      );
    });

    it('revert if caller is not trader', async () => {
      await expect(pixNFT.setApprovalForAll(pixToken.address, true)).to.revertedWith(
        'Pix: NON_WHITELISTED_TRADER',
      );
    });

    it('should approve new trader', async () => {
      await pixNFT.setTrader(pixToken.address, true);
      await pixNFT.connect(alice).setApprovalForAll(pixToken.address, true);
      expect(await pixNFT.isApprovedForAll(await alice.getAddress(), pixToken.address)).to.equal(
        true,
      );
    });
  });
});
