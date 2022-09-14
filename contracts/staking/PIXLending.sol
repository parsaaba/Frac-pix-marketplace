//SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "../interfaces/IPIX.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract PIXLending is OwnableUpgradeable, ERC721HolderUpgradeable, ReentrancyGuardUpgradeable {
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    address public pixNFT;
    IERC20Upgradeable public pixt;
    uint256 public feePerSecond;
    enum Status {
        None,
        Listed,
        Borrowed
    }

    struct Info {
        Status status;
        uint256 amount;
        address lender;
        uint256 duration;
        uint256 lendTime;
        address borrower;
        uint256 tokenId;
    }
    mapping(uint256 => Info) public pixInfo;
    mapping(uint256 => Info) public ixtInfo;
    mapping(address => uint256) public index;

    function initialize(
        address _pixt,
        address _pixNFT,
        uint256 _feePerSecond
    ) external initializer {
        require(_pixt != address(0), "Staking: INVALID_PIXT");
        require(_pixNFT != address(0), "Staking: INVALID_PIX");
        pixt = IERC20Upgradeable(_pixt);
        pixNFT = _pixNFT;
        feePerSecond = _feePerSecond;
        __Ownable_init();
    }

    function setFeePerSecond(uint256 _amount) external onlyOwner {
        feePerSecond = _amount;
    }

    function createRequest(
        uint256 _tokenId,
        uint256 _amount,
        uint256 _duration
    ) external {
        require(pixInfo[_tokenId].status == Status.None, "Listing: INVALID_PIX");

        pixInfo[_tokenId].status = Status.Listed;
        pixInfo[_tokenId].amount = _amount;
        pixInfo[_tokenId].borrower = msg.sender;
        pixInfo[_tokenId].duration = _duration;

        IERC721Upgradeable(pixNFT).safeTransferFrom(msg.sender, address(this), _tokenId);
    }

    function createRequest1(
        uint256 _amount,
        uint256 _tokenId,
        uint256 _duration
    ) external {
        require(_amount > 0, "INVALID AMOUNT");
        require(pixt.balanceOf(msg.sender) >= _amount, "insufficiency balance");

        ixtInfo[index[msg.sender]].amount = _amount;
        ixtInfo[index[msg.sender]].borrower = msg.sender;
        ixtInfo[index[msg.sender]].duration = _duration;
        ixtInfo[index[msg.sender]].tokenId = _tokenId;
        ixtInfo[index[msg.sender]].status = Status.Listed;

        pixt.safeTransfer(address(this), _amount);
        index[msg.sender] += 1;
    }

    function cancelRequest(uint256 _tokenId) external {
        require(pixInfo[_tokenId].status == Status.Listed, "cancelRequest: INVALID_PIX");
        require(pixInfo[_tokenId].borrower == msg.sender, "cancelRequest: INVALID lister");

        delete pixInfo[_tokenId];

        IERC721Upgradeable(pixNFT).safeTransferFrom(address(this), msg.sender, _tokenId);
    }

    function cancelRequest1(uint256 _index) external {
        require(_index < index[msg.sender], "INVALID INDEX");

        require(
            ixtInfo[index[msg.sender]].status == Status.Listed,
            "cancelRequest: INVALID_REQUEST"
        );
        require(ixtInfo[index[msg.sender]].borrower == msg.sender, "cancelRequest: INVALID lister");

        delete ixtInfo[_index];

        pixt.safeTransfer(ixtInfo[index[msg.sender]].borrower, ixtInfo[index[msg.sender]].amount);
    }

    function acceptRequest(uint256 _tokenId) external {
        require(pixInfo[_tokenId].status == Status.Listed, "acceptRequest: INVALID_PIX");
        pixInfo[_tokenId].status = Status.Borrowed;

        pixInfo[_tokenId].lendTime = block.timestamp;
        pixInfo[_tokenId].lender = msg.sender;
        pixt.safeTransferFrom(msg.sender, pixInfo[_tokenId].borrower, pixInfo[_tokenId].amount);
    }

    function acceptRequest1(uint256 _index) external {
        require(ixtInfo[_index].status == Status.Listed, "acceptRequest: INVALID_PIX");
        ixtInfo[_index].status = Status.Borrowed;

        ixtInfo[_index].lendTime = block.timestamp;
        ixtInfo[_index].lender = msg.sender;
        IERC721Upgradeable(pixNFT).safeTransferFrom(
            msg.sender,
            ixtInfo[_index].borrower,
            ixtInfo[_index].tokenId
        );
    }

    function payDebt(uint256 _tokenId) external {
        require(pixInfo[_tokenId].status == Status.Borrowed, "Paying: INVALID_PIX");

        if (block.timestamp - pixInfo[_tokenId].lendTime > pixInfo[_tokenId].duration) {
            delete pixInfo[_tokenId];
            IERC721Upgradeable(pixNFT).safeTransferFrom(
                address(this),
                pixInfo[_tokenId].lender,
                _tokenId
            );
            return;
        }

        require(pixInfo[_tokenId].borrower == msg.sender, "Paying: INVALID Borrower");

        uint256 amount = pixInfo[_tokenId].amount.add(calculateFee(pixInfo[_tokenId].lendTime));

        IERC721Upgradeable(pixNFT).safeTransferFrom(
            address(this),
            pixInfo[_tokenId].borrower,
            _tokenId
        );
        pixt.safeTransferFrom(msg.sender, pixInfo[_tokenId].lender, amount);
    }

    function payDebt1(uint256 _index) external {
        require(ixtInfo[_index].status == Status.Borrowed, "Paying: INVALID_REQUEST");

        if (block.timestamp - ixtInfo[_index].lendTime > ixtInfo[_index].duration) {
            delete ixtInfo[_index];
            pixt.safeTransfer(ixtInfo[_index].lender, ixtInfo[_index].amount);
            return;
        }

        require(ixtInfo[_index].borrower == msg.sender, "Paying: INVALID Borrower");

        pixt.safeTransfer(ixtInfo[_index].lender, ixtInfo[_index].amount);

        pixt.safeTransferFrom(
            msg.sender,
            ixtInfo[_index].lender,
            calculateFee(ixtInfo[_index].lendTime)
        );
    }

    function calculateFee(uint256 _lendTime) public view returns (uint256) {
        return block.timestamp.sub(_lendTime).mul(feePerSecond);
    }
}
