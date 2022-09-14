//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "../core/PIXT.sol";
import "../interfaces/IPIX.sol";
import "../libraries/DecimalMath.sol";

abstract contract PIXBaseSale is OwnableUpgradeable, ERC721HolderUpgradeable {
    using DecimalMath for uint256;

    event Purchased(
        address indexed seller,
        address indexed buyer,
        uint256 indexed saleId,
        uint256 price
    );

    event SaleCancelled(uint256 indexed saleId);

    event TreasuryUpdated(address treasury, uint256 fee, uint256 burnFee, bool mode);

    struct Treasury {
        address treasury;
        uint256 fee;
        uint256 burnFee;
    }

    // treasury information
    Treasury public landTreasury;
    Treasury public pixtTreasury;

    // PIXT token
    address public pixToken;
    address public pixNFT;

    // Whitelisted NFT tokens
    mapping(address => bool) public whitelistedNFTs;

    // Last sale id
    uint256 public lastSaleId;

    modifier onlyWhitelistedNFT(address token) {
        require(whitelistedNFTs[token], "Sale: NOT_WHITELISTED_NFT");
        _;
    }

    function __PIXBaseSale_init(address pixt, address pix) internal initializer {
        require(pixt != address(0), "Sale: INVALID_PIXT");
        require(pix != address(0), "Sale: INVALID_PIX");
        pixToken = pixt;
        pixNFT = pix;
        __Ownable_init();
        __ERC721Holder_init();
    }

    function setTreasury(
        address _treasury,
        uint256 _fee,
        uint256 _burnFee,
        bool _mode
    ) external onlyOwner {
        require(_treasury != address(0), "Sale: INVALID_TREASURY");
        require((_fee + _burnFee).isLessThanAndEqualToDenominator(), "Sale: FEE_OVERFLOWN");
        Treasury memory treasury = Treasury(_treasury, _fee, _burnFee);
        if (_mode) {
            landTreasury = treasury;
        } else {
            pixtTreasury = treasury;
        }

        emit TreasuryUpdated(_treasury, _fee, _burnFee, _mode);
    }

    function setWhitelistedNFTs(address _token, bool _whitelist) external onlyOwner {
        whitelistedNFTs[_token] = _whitelist;
    }
}
