//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "../interfaces/IPIX.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract PIXStakingLottery is
    OwnableUpgradeable,
    ERC721HolderUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    event PIXStaked(uint256 tokenId, address indexed account);
    event PIXUnstaked(uint256 tokenId, address indexed account);
    event RewardClaimed(uint256 amount, address indexed account);
    event SetWinner(uint256 time, uint256 amount, address indexed account);

    struct UserInfo {
        mapping(uint256 => bool) isStaked;
        uint256 tiers;
    }

    mapping(address => UserInfo) public userInfo;
    mapping(address => uint256) public earned;

    IERC20Upgradeable public rewardToken;

    address public pixNFT;
    uint256 public lastLotteryTime;
    uint256 public rewardPerBlock;
    uint256 public totalTiers;
    uint256 public period;
    bool public isLotteryStarted;

    function initialize(
        address _pixt,
        address _pixNFT,
        uint256 _rewardPerBlock,
        uint256 _period
    ) external initializer {
        require(_pixt != address(0), "Staking: INVALID_PIXT");
        require(_pixNFT != address(0), "Staking: INVALID_PIX");

        rewardToken = IERC20Upgradeable(_pixt);
        pixNFT = _pixNFT;
        rewardPerBlock = _rewardPerBlock;
        period = _period;
        __Ownable_init();
        __ReentrancyGuard_init();
        __ERC721Holder_init();
    }

    function stake(uint256 _tokenId) external {
        require(_tokenId > 0, "Staking: INVALID_TOKEN_ID");
        require(IPIX(pixNFT).getTier(_tokenId) > 0, "Staking: INVALID_TIER");
        require(IPIX(pixNFT).isTerritory(_tokenId), "Staking: TERRITORY_ONLY");

        UserInfo storage user = userInfo[msg.sender];

        IERC721Upgradeable(pixNFT).safeTransferFrom(msg.sender, address(this), _tokenId);
        totalTiers = totalTiers.add(IPIX(pixNFT).getTier(_tokenId));

        // Update User Info
        user.tiers = user.tiers.add(IPIX(pixNFT).getTier(_tokenId));
        user.isStaked[_tokenId] = true;

        emit PIXStaked(_tokenId, address(this));
    }

    function unstake(uint256 _tokenId) external nonReentrant {
        require(_tokenId > 0, "Staking: INVALID_TOKEN_ID");
        UserInfo storage user = userInfo[msg.sender];
        require(user.tiers > 0, "Staking: NO_WITHDRAWALS");
        require(user.isStaked[_tokenId], "Staking: NO_STAKES");

        IERC721Upgradeable(pixNFT).safeTransferFrom(address(this), msg.sender, _tokenId);
        totalTiers = totalTiers.sub(IPIX(pixNFT).getTier(_tokenId));
        // Update UserInfo
        user.tiers = user.tiers.sub(IPIX(pixNFT).getTier(_tokenId));
        user.isStaked[_tokenId] = false;

        emit PIXUnstaked(_tokenId, msg.sender);
    }

    function claim() external {
        require(earned[msg.sender] > 0, "Claiming: NO_Tokens to withdraw");

        rewardToken.safeTransfer(msg.sender, earned[msg.sender]);
        earned[msg.sender] = 0;
        emit RewardClaimed(earned[msg.sender], msg.sender);
    }

    function startLottery() external onlyOwner {
        lastLotteryTime = block.timestamp;
        isLotteryStarted = true;
    }

    function setReward(address _winner) external onlyOwner {
        require(block.timestamp - lastLotteryTime >= period, "SetWinner: Already set winner");
        require(isLotteryStarted, "SetWinner: lottery not started yet");

        UserInfo storage user = userInfo[_winner];
        require(user.tiers > 0, "SetReward: INV_WINNER");

        uint256 pending = _calculateReward();
        require(pending > 0, "setReward: no tokens to set");
        earned[_winner] += pending;
        lastLotteryTime = block.timestamp;

        emit SetWinner(block.timestamp, pending, msg.sender);
    }

    function setRewardPerBlock(uint256 _amount) external onlyOwner {
        rewardPerBlock = _amount;
    }

    function _calculateReward() internal view returns (uint256) {
        uint256 timesPassed = block.timestamp.sub(lastLotteryTime);
        return rewardPerBlock.mul(timesPassed);
    }
}
