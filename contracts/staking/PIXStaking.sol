//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../interfaces/IPIX.sol";

contract PIXStaking is OwnableUpgradeable, ReentrancyGuardUpgradeable, ERC721HolderUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    event PIXStaked(uint256 tokenId, address indexed account);
    event PIXUnstaked(uint256 tokenId, address indexed account);
    event RewardClaimed(uint256 reward, address indexed account);
    event RewardAdded(uint256 reward);

    mapping(address => uint256) public tiers;
    mapping(uint256 => address) public stakers;

    IERC20Upgradeable public rewardToken;

    address public pixNFT;
    uint256 public totalTiers;

    uint256 public constant DURATION = 10 days;
    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTierStored;
    address public rewardDistributor;
    mapping(address => uint256) public userRewardPerTierPaid;
    mapping(address => uint256) public rewards;

    modifier updateReward(address account) {
        rewardPerTierStored = rewardPerTier();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTierPaid[account] = rewardPerTierStored;
        }
        _;
    }

    modifier onlyRewardDistributor() {
        require(msg.sender == rewardDistributor, "Staking: NON_DISTRIBUTOR");
        _;
    }

    function initialize(address _pixt, address _pixNFT) external initializer {
        require(_pixt != address(0), "Staking: INVALID_PIXT");
        require(_pixNFT != address(0), "Staking: INVALID_PIX");
        __Ownable_init();
        __ReentrancyGuard_init();
        __ERC721Holder_init();

        rewardToken = IERC20Upgradeable(_pixt);
        pixNFT = _pixNFT;
    }

    /// @dev validation reward period
    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    /// @dev reward rate per staked token
    function rewardPerTier() public view returns (uint256) {
        if (totalTiers == 0) {
            return rewardPerTierStored;
        }
        return
            rewardPerTierStored +
            ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) /
            totalTiers;
    }

    /**
     * @dev view total stacked reward for user
     * @param account target user address
     */
    function earned(address account) public view returns (uint256) {
        return
            (tiers[account] * (rewardPerTier() - userRewardPerTierPaid[account])) /
            1e18 +
            rewards[account];
    }

    /**
     * @dev set reward distributor by owner
     * reward distributor is the moderator who calls {notifyRewardAmount} function
     * whenever periodic reward tokens transferred to this contract
     * @param distributor new distributor address
     */
    function setRewardDistributor(address distributor) external onlyOwner {
        require(distributor != address(0), "Staking: INVALID_DISTRIBUTOR");
        rewardDistributor = distributor;
    }

    function stake(uint256 _tokenId) external updateReward(msg.sender) nonReentrant {
        uint256 tier = IPIX(pixNFT).getTier(_tokenId);
        require(_tokenId > 0, "Staking: INVALID_TOKEN_ID");
        require(tier > 0, "Staking: INVALID_TIER");
        require(IPIX(pixNFT).isTerritory(_tokenId), "Staking: TERRITORY_ONLY");

        totalTiers += tier;
        stakers[_tokenId] = msg.sender;
        tiers[msg.sender] += tier;

        IERC721Upgradeable(pixNFT).safeTransferFrom(msg.sender, address(this), _tokenId);
        emit PIXStaked(_tokenId, address(this));
    }

    function unstake(uint256 _tokenId) external updateReward(msg.sender) nonReentrant {
        uint256 tier = IPIX(pixNFT).getTier(_tokenId);
        require(_tokenId > 0, "Staking: INVALID_TOKEN_ID");
        require(stakers[_tokenId] == msg.sender, "Staking: NOT_STAKER");
        require(tiers[msg.sender] > 0, "Staking: NO_WITHDRAWALS");

        totalTiers -= tier;
        tiers[msg.sender] -= tier;
        delete stakers[_tokenId];

        IERC721Upgradeable(pixNFT).safeTransferFrom(address(this), msg.sender, _tokenId);
        emit PIXUnstaked(_tokenId, msg.sender);
    }

    /**
     * @dev claim reward and update reward related arguments
     * @notice emit {RewardClaimed} event
     */
    function claim() public updateReward(msg.sender) {
        uint256 reward = earned(msg.sender);
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardClaimed(reward, msg.sender);
        }
    }

    /**
     * @dev update reward related arguments after reward token arrived
     * @param reward reward token amounts received
     * @notice emit {RewardAdded} event
     */
    function notifyRewardAmount(uint256 reward)
        external
        onlyRewardDistributor
        updateReward(address(0))
    {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward / DURATION;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (reward + leftover) / DURATION;
        }
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + DURATION;
        emit RewardAdded(reward);
    }

    function isStaked(uint256 tokenId) external view returns (bool) {
        return stakers[tokenId] != address(0);
    }
}
