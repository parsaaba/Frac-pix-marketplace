//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract PIXLandStaking is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    event PIXLandStaked(uint256 tokenId, address indexed account);
    event PIXLandUnstaked(uint256 tokenId, address indexed account);
    event RewardClaimed(uint256 reward, address indexed account);

    address public pixLandmark;
    address public moderator;

    IERC20Upgradeable public rewardToken;
    mapping(uint256 => address) public stakers;
    mapping(address => uint256) public rewards;

    function initialize(address _pixt, address _pixLandmark) external initializer {
        require(_pixt != address(0), "LandStaking: INVALID_PIXT");
        require(_pixLandmark != address(0), "LandStaking: INVALID_PIX_LAND");

        __Ownable_init();
        __ReentrancyGuard_init();

        rewardToken = IERC20Upgradeable(_pixt);
        pixLandmark = _pixLandmark;
    }

    function setModerator(address moderator_) external onlyOwner {
        moderator = moderator_;
    }

    function stake(uint256 _tokenId) external nonReentrant {
        require(_tokenId > 0, "LandStaking: INVALID_TOKEN_ID");

        stakers[_tokenId] = msg.sender;
        IERC721Upgradeable(pixLandmark).safeTransferFrom(msg.sender, address(this), _tokenId);

        emit PIXLandStaked(_tokenId, address(this));
    }

    function unstake(uint256 _tokenId) external nonReentrant {
        require(_tokenId > 0, "LandStaking: INVALID_TOKEN_ID");
        require(stakers[_tokenId] == msg.sender, "LandStaking: NOT_STAKER");

        delete stakers[_tokenId];
        IERC721Upgradeable(pixLandmark).safeTransferFrom(address(this), msg.sender, _tokenId);

        emit PIXLandUnstaked(_tokenId, msg.sender);
    }

    /**
     * @dev claim reward and update reward related arguments
     * @notice emit {RewardClaimed} event
     */
    function claim() public {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardClaimed(reward, msg.sender);
        }
    }

    function addReward(address account, uint256 reward) external {
        require(msg.sender == moderator, "LandStaking: NOT_MODERATOR");
        rewards[account] += reward;
    }

    function isStaked(uint256 tokenId) external view returns (bool) {
        return stakers[tokenId] != address(0);
    }
}
