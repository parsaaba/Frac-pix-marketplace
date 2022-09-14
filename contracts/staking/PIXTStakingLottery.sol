// solhint-disable not-rely-on-time
//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

contract PIXTStakingLottery is OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeMathUpgradeable for uint256;

    IERC20Upgradeable public pixToken;

    uint256 public totalStaked;
    mapping(address => uint256) public stakedAmounts;
    mapping(address => uint256) public earned;

    uint256 public lastLotteryTime;
    uint256 public rewardPerBlock;
    uint256 public period;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event SetReward(address indexed user, uint256 reward);

    function initialize(
        address token,
        uint256 _rewardPerBlock,
        uint256 _period
    ) external initializer {
        require(token != address(0), "Staking: INVALID_PIXT");
        pixToken = IERC20Upgradeable(token);
        rewardPerBlock = _rewardPerBlock;
        period = _period;
        __Ownable_init();
    }

    /**
     * @dev stake some amount of staking token
     * @param amount staking token amount(>0) to stakes
     * @notice emit {Staked} event
     */
    function stake(uint256 amount) external {
        require(amount > 0, "Staking: STAKE_ZERO");
        totalStaked += amount;
        stakedAmounts[msg.sender] += amount;
        pixToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount);
    }

    function startLottery() external onlyOwner {
        lastLotteryTime = block.timestamp;
    }

    function setRewardPerBlock(uint256 _amount) external onlyOwner {
        rewardPerBlock = _amount;
    }

    /**
     * @dev unstake partial staked amount
     * @param amount staking token amount(>0) to unstake
     * @notice emit {Unstaked} event
     */
    function unstake(uint256 amount) external {
        require(amount > 0, "Staking: UNSTAKE_ZERO");
        require(stakedAmounts[msg.sender] >= amount, "Staking: No Tokens to Withdraw");
        totalStaked -= amount;
        stakedAmounts[msg.sender] -= amount;
        pixToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    /**
     * @dev claim reward and update reward related arguments
     * @notice emit {RewardPaid} event
     */
    function claim() external {
        require(earned[msg.sender] > 0, "Claiming: NO_Tokens to withdraw");

        pixToken.safeTransfer(msg.sender, earned[msg.sender]);
        earned[msg.sender] = 0;
        emit RewardPaid(msg.sender, earned[msg.sender]);
    }

    function setPeriod(uint256 _period) external onlyOwner {
        period = _period;
    }

    function setReward(address _winner) external onlyOwner {
        require(block.timestamp - lastLotteryTime >= period, "SetWinner: Already set winner");

        require(stakedAmounts[_winner] > 0, "SetReward: INV_WINNER");
        uint256 pending = _calculateReward();
        require(pending > 0, "setReward: no tokens to set");
        earned[_winner] += pending;
        lastLotteryTime = block.timestamp;

        emit SetReward(_winner, pending);
    }

    function _calculateReward() internal view returns (uint256) {
        uint256 blocksPassed = block.timestamp.sub(lastLotteryTime);
        return rewardPerBlock.mul(blocksPassed);
    }
}
