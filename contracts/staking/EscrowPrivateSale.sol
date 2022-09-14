//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../interfaces/IPIX.sol";

contract EscrowPrivateSale is
    OwnableUpgradeable,
    ERC721HolderUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    event Escrowed(uint256 tokenId, address indexed recipient);
    event Purcahsed(uint256 tokenId);
    event Withdrawn(uint256 tokenId);

    struct EscrowInfo {
        bool isEscrowed;
        address seller;
        address buyer;
        uint256 amount;
    }

    mapping(uint256 => EscrowInfo) public escrowInfo;

    IERC20Upgradeable public pixToken;
    address public pixNFT;

    function initialize(address _pixt, address _pixNFT) external initializer {
        require(_pixt != address(0), "INVALID_PIXT");
        require(_pixNFT != address(0), "INVALID_PIX");

        pixNFT = _pixNFT;
        pixToken = IERC20Upgradeable(_pixt);
        __Ownable_init();
        __ReentrancyGuard_init();
        __ERC721Holder_init();
    }

    function escrow(
        uint256 _tokenId,
        address _buyer,
        uint256 _amount
    ) external {
        require(_tokenId > 0, "escrow: INVALID_TOKEN_ID");
        require(_amount > 0, "escrow: INVALID_TOKEN_ID");

        EscrowInfo storage _eInfo = escrowInfo[_tokenId];
        _eInfo.seller = msg.sender;
        _eInfo.buyer = _buyer;
        _eInfo.amount = _amount;
        _eInfo.isEscrowed = true;

        IERC721Upgradeable(pixNFT).safeTransferFrom(msg.sender, address(this), _tokenId);

        emit Escrowed(_tokenId, address(this));
    }

    function purchase(uint256 _tokenId) external {
        require(_tokenId > 0, "INVALID_TOKEN_ID");

        EscrowInfo memory _eInfo = escrowInfo[_tokenId];
        require(_eInfo.buyer == msg.sender, "purchase: Invalid Buyer");

        pixToken.safeTransferFrom(msg.sender, _eInfo.seller, _eInfo.amount);
        IERC721Upgradeable(pixNFT).safeTransferFrom(address(this), msg.sender, _tokenId);

        delete escrowInfo[_tokenId];
        emit Purcahsed(_tokenId);
    }

    function withdraw(uint256 _tokenId) external {
        require(_tokenId > 0, "INVALID_TOKEN_ID");

        EscrowInfo memory _eInfo = escrowInfo[_tokenId];
        require(_eInfo.seller == msg.sender, "withdraw: Invalid Seller");
        require(_eInfo.isEscrowed, "withdraw: not Escrowed yet");

        IERC721Upgradeable(pixNFT).safeTransferFrom(address(this), msg.sender, _tokenId);

        delete escrowInfo[_tokenId];
        emit Withdrawn(_tokenId);
    }
}
