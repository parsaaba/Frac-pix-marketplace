// solhint-disable not-rely-on-time
//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../libraries/DecimalMath.sol";

contract Vesting {
    using SafeERC20 for IERC20;
    using DecimalMath for uint256;

    event VestInitialized(
        address indexed beneficiary,
        address indexed forward,
        uint64 forwardPct,
        uint64 startTime,
        uint64 period,
        uint256 amount,
        uint256 vestId
    );
    event Claimed(address indexed beneficiary, uint256 amount);

    struct VestInfo {
        address beneficiary;
        uint64 period;
        uint64 startTime;
        address forward;
        uint64 forwardPct;
        uint256 amount;
        uint256 claimed;
    }

    uint256 public constant RELEASE_PERIOD = 1 weeks;
    IERC20 public immutable pixtToken;

    uint256 public vestLength;
    mapping(uint256 => VestInfo) public vestInfos;

    constructor(IERC20 pixtToken_) {
        require(address(pixtToken_) != address(0), "Vesting: PIXT_ZERO_ADDRESS");
        pixtToken = pixtToken_;
    }

    function initVesting(
        uint256 amount,
        uint64 startTime,
        uint64 period,
        address beneficiary,
        address forward,
        uint64 forwardPct
    ) public {
        require(startTime > block.timestamp, "Vesting: INVALID_START_TIME");
        require(period > 0, "Vesting: INVALID_PERIOD");
        require(beneficiary != address(0), "Vesting: INVALID_BENEFICIARY");
        if (forwardPct > 0) {
            require(forward != address(0), "Vesting: INVALID_FORWARD");
        }

        pixtToken.safeTransferFrom(msg.sender, address(this), amount);

        vestInfos[vestLength] = VestInfo({
            beneficiary: beneficiary,
            forward: forward,
            forwardPct: forwardPct,
            period: period,
            startTime: startTime,
            amount: amount,
            claimed: 0
        });

        emit VestInitialized(
            beneficiary,
            forward,
            forwardPct,
            startTime,
            period,
            amount,
            vestLength
        );

        vestLength += 1;
    }

    function initVestings(
        uint256[] calldata amounts,
        uint64[] calldata startTimes,
        uint64[] calldata periods,
        address[] calldata beneficiaries,
        address[] calldata forwards,
        uint64[] calldata forwardPcts
    ) external {
        require(
            amounts.length > 0 &&
                amounts.length == startTimes.length &&
                amounts.length == periods.length &&
                amounts.length == beneficiaries.length &&
                amounts.length == forwards.length &&
                amounts.length == forwardPcts.length,
            "Vesting: INVALID_LENGTH"
        );

        uint256 len = amounts.length;
        for (uint256 i; i < len; i += 1) {
            initVesting(
                amounts[i],
                startTimes[i],
                periods[i],
                beneficiaries[i],
                forwards[i],
                forwardPcts[i]
            );
        }
    }

    function _claim(uint256 id) internal returns (uint256 claimable) {
        VestInfo storage vestInfo = vestInfos[id];
        require(vestInfo.beneficiary == msg.sender, "Vesting: INVALID_BENEFICIARY");
        if (vestInfo.amount <= vestInfo.claimed) {
            return 0;
        }
        if (vestInfo.startTime >= block.timestamp) {
            return 0;
        }

        uint64 timePassed = uint64(block.timestamp) - vestInfo.startTime;
        uint256 releaseAmount;
        if (timePassed >= vestInfo.period) {
            releaseAmount = vestInfo.amount;
        } else {
            releaseAmount =
                (vestInfo.amount * ((timePassed / RELEASE_PERIOD) * RELEASE_PERIOD)) /
                vestInfo.period;
        }

        if (releaseAmount <= vestInfo.claimed) {
            return 0;
        }

        claimable = releaseAmount - vestInfo.claimed;
        if (vestInfo.forwardPct > 0) {
            uint256 forwardAmount = claimable.decimalMul(vestInfo.forwardPct);
            pixtToken.safeTransfer(vestInfo.forward, forwardAmount);
            emit Claimed(vestInfo.forward, forwardAmount);
            claimable -= forwardAmount;
        }

        if (claimable > 0) {
            pixtToken.safeTransfer(vestInfo.beneficiary, claimable);

            emit Claimed(vestInfo.beneficiary, claimable);
        }

        vestInfo.claimed = releaseAmount;
    }

    function claim(uint256 id) public returns (uint256) {
        uint256 claimed = _claim(id);
        require(claimed > 0, "Vesting: EMPTY_BALANCE");

        return claimed;
    }

    function claimInBatch(uint256[] calldata ids) external returns (uint256) {
        uint256 len = ids.length;
        uint256 totalClaimed;
        require(len > 0, "Vesting: INVALID_LENGTH");
        for (uint256 i; i < len; i += 1) {
            totalClaimed += _claim(ids[i]);
        }
        require(totalClaimed > 0, "Vesting: EMPTY_BALANCE");

        return totalClaimed;
    }

    function getPendingAmount(uint256 id) public view returns (uint256) {
        VestInfo memory vestInfo = vestInfos[id];

        if (vestInfo.amount <= vestInfo.claimed || vestInfo.startTime >= block.timestamp) {
            return 0;
        }

        uint64 timePassed = uint64(block.timestamp) - vestInfo.startTime;
        uint256 releaseAmount;
        if (timePassed >= vestInfo.period) {
            releaseAmount = vestInfo.amount;
        } else {
            releaseAmount =
                (vestInfo.amount * ((timePassed / RELEASE_PERIOD) * RELEASE_PERIOD)) /
                vestInfo.period;
        }

        if (releaseAmount > vestInfo.claimed) {
            return releaseAmount - vestInfo.claimed;
        } else {
            return 0;
        }
    }

    function getPendingAmounts(uint256[] calldata ids) external view returns (uint256) {
        uint256 total = 0;
        uint256 len = ids.length;
        for (uint256 i; i < len; i += 1) {
            total += getPendingAmount(ids[i]);
        }

        return total;
    }
}
