//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "../core/PIXT.sol";
import "./PIXBaseSale.sol";
import "../interfaces/IPIX.sol";
import "../interfaces/IPIXMerkleMinter.sol";
import "../libraries/DecimalMath.sol";

contract PIXSaleV2 is PIXBaseSale, EIP712Upgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using DecimalMath for uint256;

    event PurchasedV2(
        address indexed seller,
        address indexed buyer,
        address nftToken,
        uint256[] tokenIds,
        bytes32[] hashes,
        uint256 price
    );

    struct SaleInfo {
        address seller;
        bool executeBySeller;
        address nftToken;
        uint256[] tokenIds;
        bytes32[] hashes;
        uint256 minPrice;
        uint64 validUntil;
    }

    struct SaleOfferInfo {
        address buyer;
        bytes32[] saleSignatures;
        uint256 price;
        uint64 validUntil;
    }

    struct OfferInfo {
        address seller;
        address buyer;
        address nftToken;
        uint256[] tokenIds;
        bytes32[] hashes;
        uint256 price;
        uint64 validUntil;
    }

    struct SaleParam {
        bytes32[] saleSignatures;
        uint256 saleIdx;
        SaleInfo saleInfo;
        IPIX.PIXInfo[] merklePixInfos;
        bytes32[] merkleRoot;
        bytes32[][] merkleProofs;
        bytes sig;
    }

    struct SaleOfferParam {
        bytes32[] saleOfferSignatures;
        uint256 saleOfferIdx;
        SaleOfferInfo saleOfferInfo;
        bytes sig;
    }

    struct OfferParam {
        bytes32[] offerSignatures;
        uint256 offerIdx;
        OfferInfo offerInfo;
        IPIX.PIXInfo[] merklePixInfos;
        bytes32[] merkleRoot;
        bytes32[][] merkleProofs;
        bytes sig;
    }

    bytes32 private constant SALE_MSG = keccak256("Sales(bytes32[] signatures)");

    mapping(bytes32 => mapping(uint256 => bool)) public invalidSales;

    address public burnHolder;
    IPIXMerkleMinter public pixMerkleMinter;
    mapping(address => bool) public keepers;

    function initialize(
        address _pixt,
        address _pix,
        address _pixMerkleMinter
    ) external initializer {
        __PIXBaseSale_init(_pixt, _pix);
        __ReentrancyGuard_init();
        __EIP712_init("PlanetIX", "2");

        pixMerkleMinter = IPIXMerkleMinter(_pixMerkleMinter);
    }

    function buy(SaleParam memory saleParam, uint256 price) public nonReentrant {
        SaleParam memory _saleParam = saleParam;
        SaleInfo memory _saleInfo = _saleParam.saleInfo;

        uint256 _price = price;
        address _seller = _saleInfo.seller;
        address _buyer = msg.sender;

        _verifySaleParam(_saleParam, false);

        bool isLandNft = _takeNFTs(_seller, _buyer, _saleInfo.nftToken, _saleInfo.tokenIds);

        isLandNft = _takeNFTsWithMerkleTree(
            _seller,
            _buyer,
            _saleInfo.hashes,
            _saleParam.merklePixInfos,
            _saleParam.merkleRoot,
            _saleParam.merkleProofs,
            isLandNft
        );

        require(_price >= _saleInfo.minPrice, "SaleV2: invalid price");

        _acceptPayment(_seller, _buyer, _price, isLandNft);

        emit PurchasedV2(
            _seller,
            _buyer,
            _saleInfo.nftToken,
            _saleInfo.tokenIds,
            _saleInfo.hashes,
            _price
        );
    }

    function buyInBatch(SaleParam[] memory saleParam, uint256[] memory price)
        external
        nonReentrant
    {
        uint256 len = price.length;
        for (uint256 i = 0; i < len; i += 1) {
            buy(saleParam[i], price[i]);
        }
    }

    function executeSale(SaleParam memory saleParam, SaleOfferParam memory saleOfferParam)
        public
        nonReentrant
    {
        SaleParam memory _saleParam = saleParam;
        SaleOfferParam memory _saleOfferParam = saleOfferParam;
        SaleInfo memory _saleInfo = _saleParam.saleInfo;
        address _seller = _saleParam.saleInfo.seller;
        address _buyer = _saleOfferParam.saleOfferInfo.buyer;

        _verifySaleParam(_saleParam, true);
        _verifySaleOfferParam(_saleOfferParam);
        require(msg.sender == _seller || keepers[msg.sender], "SaleV2: invalid sender");

        bool isLandNft = _takeNFTs(_seller, _buyer, _saleInfo.nftToken, _saleInfo.tokenIds);

        isLandNft = _takeNFTsWithMerkleTree(
            _seller,
            _buyer,
            _saleInfo.hashes,
            _saleParam.merklePixInfos,
            _saleParam.merkleRoot,
            _saleParam.merkleProofs,
            isLandNft
        );

        uint256 _price = _saleOfferParam.saleOfferInfo.price;
        require(_price >= _saleInfo.minPrice, "SaleV2: invalid price");

        _acceptPayment(_seller, _buyer, _price, isLandNft);

        emit PurchasedV2(
            _seller,
            _buyer,
            _saleInfo.nftToken,
            _saleInfo.tokenIds,
            _saleInfo.hashes,
            _price
        );
    }

    function acceptOffer(OfferParam memory offerParam) public nonReentrant {
        OfferParam memory _offerParam = offerParam;
        OfferInfo memory _offerInfo = _offerParam.offerInfo;
        address _seller = _offerInfo.seller;
        address _buyer = _offerInfo.buyer;
        uint256 _price = _offerInfo.price;

        require(msg.sender == _seller, "SaleV2: invalid seller");

        _verifyOfferParam(_offerParam);

        bool isLandNft = _takeNFTs(_seller, _buyer, _offerInfo.nftToken, _offerInfo.tokenIds);

        isLandNft = _takeNFTsWithMerkleTree(
            _seller,
            _buyer,
            _offerInfo.hashes,
            _offerParam.merklePixInfos,
            _offerParam.merkleRoot,
            _offerParam.merkleProofs,
            isLandNft
        );

        _acceptPayment(_seller, _buyer, _price, isLandNft);

        emit PurchasedV2(
            _seller,
            _buyer,
            _offerInfo.nftToken,
            _offerInfo.tokenIds,
            _offerInfo.hashes,
            _price
        );
    }

    function acceptOfferInBatch(OfferParam[] memory offerParam) external nonReentrant {
        uint256 len = offerParam.length;
        for (uint256 i = 0; i < len; i += 1) {
            acceptOffer(offerParam[i]);
        }
    }

    function cancel(
        bytes32[] memory signatures,
        uint256 idx,
        bytes memory sig
    ) public {
        bytes32 signature = _verifySignature(msg.sender, signatures, sig);

        require(invalidSales[signature][idx] == false, "SaleV2: cancelled or executed");

        invalidSales[signature][idx] == true;
    }

    function cancelInBatch(
        bytes32[][] memory signatures,
        uint256[] memory idx,
        bytes[] memory sig
    ) external {
        uint256 len = idx.length;
        for (uint256 i = 0; i < len; i += 1) {
            cancel(signatures[i], idx[i], sig[i]);
        }
    }

    function executeSaleInBatch(
        SaleParam[] memory saleParam,
        SaleOfferParam[] memory saleOfferParam
    ) external nonReentrant {
        uint256 len = saleParam.length;
        for (uint256 i = 0; i < len; i += 1) {
            executeSale(saleParam[i], saleOfferParam[i]);
        }
    }

    function _verifySignature(
        address user,
        bytes32[] memory signatures,
        bytes memory sig
    ) private view returns (bytes32 signature) {
        (uint8 v, bytes32 r, bytes32 s) = abi.decode(sig, (uint8, bytes32, bytes32));
        bytes32 structHash = keccak256(
            abi.encode(SALE_MSG, keccak256(abi.encodePacked(signatures)))
        );
        signature = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(signature, v, r, s);
        require(signer == user, "SaleV2: invalid signature");
    }

    function _takeNFTs(
        address seller,
        address buyer,
        address nftToken,
        uint256[] memory tokenIds
    ) private returns (bool isLandNft) {
        uint256 tokenLength = tokenIds.length;

        for (uint256 j = 0; j < tokenLength; j += 1) {
            IERC721Upgradeable(nftToken).safeTransferFrom(seller, buyer, tokenIds[j]);
        }

        if (nftToken == pixNFT && IPIX(pixNFT).pixesInLand(tokenIds)) {
            isLandNft = true;
        }
    }

    function _takeNFTsWithMerkleTree(
        address seller,
        address buyer,
        bytes32[] memory merkleHashes,
        IPIX.PIXInfo[] memory merklePixInfos,
        bytes32[] memory merkleRoot,
        bytes32[][] memory merkleProofs,
        bool _isLandNft
    ) private returns (bool isLandNft) {
        uint256 len = merkleHashes.length;
        address _seller = seller;
        address _buyer = buyer;

        uint256[] memory tokenIds = new uint256[](len);

        for (uint256 i = 0; i < len; i += 1) {
            IPIX.PIXInfo memory info = merklePixInfos[i];
            require(
                merkleHashes[i] ==
                    keccak256(abi.encode(_seller, info.pixId, info.category, info.size)),
                "SaleV2: invalid pix info"
            );

            tokenIds[i] = pixMerkleMinter.mintToNewOwner(
                _buyer,
                _seller,
                info,
                merkleRoot[i],
                merkleProofs[i]
            );
        }

        if (!_isLandNft && IPIX(pixNFT).pixesInLand(tokenIds)) {
            isLandNft = true;
        }
    }

    function _acceptPayment(
        address seller,
        address buyer,
        uint256 price,
        bool isLandNft
    ) private {
        Treasury memory treasury;
        if (isLandNft) {
            treasury = landTreasury;
        } else {
            treasury = pixtTreasury;
        }

        uint256 fee = price.decimalMul(treasury.fee);
        uint256 burnFee = price.decimalMul(treasury.burnFee);
        uint256 tradeAmount = price - fee - burnFee;
        IERC20Upgradeable(pixToken).safeTransferFrom(buyer, seller, tradeAmount);
        if (fee > 0) {
            IERC20Upgradeable(pixToken).safeTransferFrom(buyer, treasury.treasury, fee);
        }
        if (burnFee > 0) {
            if (burnHolder == address(0)) ERC20Burnable(pixToken).burnFrom(buyer, burnFee);
            else IERC20Upgradeable(pixToken).safeTransferFrom(buyer, burnHolder, burnFee);
        }
    }

    function _verifySaleParam(SaleParam memory saleParam, bool executeBySeller)
        private
        returns (bytes32 signature)
    {
        SaleParam memory _saleParam = saleParam;
        uint256 _idx = _saleParam.saleIdx;
        SaleInfo memory info = _saleParam.saleInfo;

        signature = _verifySignature(info.seller, _saleParam.saleSignatures, _saleParam.sig);

        require(
            _saleParam.saleSignatures[_idx] ==
                keccak256(
                    abi.encodePacked(
                        info.seller,
                        info.executeBySeller,
                        info.nftToken,
                        info.tokenIds,
                        info.hashes,
                        info.minPrice,
                        info.validUntil
                    )
                ),
            "SaleV2: invalid sale info"
        );

        require(invalidSales[signature][_idx] == false, "SaleV2: cancelled or executed");
        require(whitelistedNFTs[info.nftToken], "SaleV2: NOT_WHITELISTED_NFT");
        require(info.validUntil >= block.timestamp, "SaleV2: expired");
        require(info.executeBySeller == executeBySeller, "SaleV2: invalid executor");

        invalidSales[signature][_idx] = true;
    }

    function _verifySaleOfferParam(SaleOfferParam memory saleOfferParam)
        private
        returns (bytes32 signature)
    {
        SaleOfferParam memory _saleOfferParam = saleOfferParam;
        uint256 _idx = _saleOfferParam.saleOfferIdx;
        SaleOfferInfo memory info = _saleOfferParam.saleOfferInfo;

        signature = _verifySignature(
            info.buyer,
            _saleOfferParam.saleOfferSignatures,
            _saleOfferParam.sig
        );

        require(
            _saleOfferParam.saleOfferSignatures[_saleOfferParam.saleOfferIdx] ==
                keccak256(
                    abi.encodePacked(info.buyer, info.saleSignatures, info.price, info.validUntil)
                ),
            "SaleV2: invalid sale offer info"
        );

        require(invalidSales[signature][_idx] == false, "SaleV2: cancelled or executed");
        require(info.validUntil >= block.timestamp, "SaleV2: expired");

        invalidSales[signature][_idx] = true;
    }

    function _verifyOfferParam(OfferParam memory offerParam) private returns (bytes32 signature) {
        OfferParam memory _offerParam = offerParam;
        uint256 _idx = _offerParam.offerIdx;
        OfferInfo memory info = _offerParam.offerInfo;

        signature = _verifySignature(info.buyer, _offerParam.offerSignatures, _offerParam.sig);

        require(
            _offerParam.offerSignatures[_offerParam.offerIdx] ==
                keccak256(
                    abi.encodePacked(
                        info.seller,
                        info.buyer,
                        info.nftToken,
                        info.tokenIds,
                        info.hashes,
                        info.price,
                        info.validUntil
                    )
                ),
            "SaleV2: invalid sale offer info"
        );

        require(invalidSales[signature][_idx] == false, "SaleV2: cancelled or executed");
        require(info.validUntil >= block.timestamp, "SaleV2: expired");

        invalidSales[signature][_idx] = true;
    }

    function setKeeper(address keeper, bool add) external onlyOwner {
        keepers[keeper] = add;
    }
}
