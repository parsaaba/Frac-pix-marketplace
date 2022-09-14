// solhint-disable not-rely-on-time
//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract PIXTStaking is OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint256 public constant DURATION = 10 days;
    IERC20Upgradeable public pixToken;

    uint256 public totalStaked;
    mapping(address => uint256) public stakedAmounts;

    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    address public rewardDistributor;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    modifier onlyRewardDistributor() {
        require(msg.sender == rewardDistributor, "Staking: NON_DISTRIBUTOR");
        _;
    }

    function initialize(address token) external initializer {
        require(token != address(0), "Staking: INVALID_PIXT");
        pixToken = IERC20Upgradeable(token);
        __Ownable_init();
    }

    /// @dev validation reward period
    function lastTimeRewardApplicable() public view returns (uint256) {
        return MathUpgradeable.min(block.timestamp, periodFinish);
    }

    /// @dev reward rate per staked token
    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored +
            ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) /
            totalStaked;
    }

    /**
     * @dev view total stacked reward for user
     * @param account target user address
     */
    function earned(address account) public view returns (uint256) {
        return
            (stakedAmounts[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) /
            1e18 +
            rewards[account];
    }

    /**
     * @dev stake some amount of staking token
     * @param amount staking token amount(>0) to stakes
     * @notice emit {Staked} event
     */
    function stake(uint256 amount) public updateReward(msg.sender) {
        require(amount > 0, "Staking: STAKE_ZERO");
        totalStaked += amount;
        stakedAmounts[msg.sender] += amount;
        pixToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    /**
     * @dev unstake partial staked amount
     * @param amount staking token amount(>0) to unstake
     * @notice emit {Unstaked} event
     */
    function unstake(uint256 amount) public updateReward(msg.sender) {
        require(amount > 0, "Staking: UNSTAKE_ZERO");
        require(stakedAmounts[msg.sender] >= 0, "Staking: No Tokens to Withdraw");
        totalStaked -= amount;
        stakedAmounts[msg.sender] -= amount;
        pixToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    /// @dev exit from staking contract - unstake all staked amounts and claim reward
    function exit() external {
        unstake(stakedAmounts[msg.sender]);
        claim();
    }

    /**
     * @dev claim reward and update reward related arguments
     * @notice emit {RewardPaid} event
     */
    function claim() public updateReward(msg.sender) {
        uint256 reward = earned(msg.sender);
        if (reward > 0) {
            rewards[msg.sender] = 0;
            pixToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
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
}
