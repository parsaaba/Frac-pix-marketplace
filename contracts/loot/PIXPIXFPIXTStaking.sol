// solhint-disable not-rely-on-time
//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721EnumerableUpgradeable.sol";
import "../interfaces/IPIX.sol";

contract PIXPIXFPIXTStaking is OwnableUpgradeable {
    using SafeERC20 for IERC20;

    uint256 public constant DURATION = 10 days;
    IERC20 public pixToken; // PIXT
    address public pixNFT; // PIX Territory
    IERC721Enumerable public pixfNFT; // PIX Facility

    uint256 public totalStaked;
    mapping(address => uint256) public stakedAmounts;

    uint256 public totalStakedPixNFTs;
    mapping(address => uint256) public stakedPixNFTAmounts;
    mapping(address => mapping(uint256 => bool)) public stakedPixNFTs;

    uint256 public totalStakedPixfNFTs;
    mapping(address => uint256) public stakedPixfNFTAmounts;
    mapping(address => mapping(uint256 => bool)) public stakedPixfNFTs;

    uint256 public periodFinish;
    uint256 public tokensPerNFT;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    address public rewardDistributor;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event RewardAdded(uint256 reward);
    event Staked(
        address indexed user,
        uint256 amount,
        uint256[] pixTokenIds,
        uint256[] pixfTokenIds
    );
    event Unstaked(
        address indexed user,
        uint256 amount,
        uint256[] pixTokenIds,
        uint256[] pixfTokenIds
    );
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

    function initialize(
        address _pixToken,
        address _pixNFT,
        address _pixfNFT,
        uint256 _tokensPerNFT
    ) external initializer {
        require(_pixToken != address(0), "Staking: INVALID_PIXT");
        require(_pixNFT != address(0), "Staking: INVALID_PIX");
        require(_pixfNFT != address(0), "Staking: INVALID_PIXF");
        require(_tokensPerNFT > 0, "Staking: INVALID_TOKENS_PER_NFT");

        pixToken = IERC20(_pixToken);
        pixNFT = _pixNFT;
        pixfNFT = IERC721Enumerable(_pixfNFT);
        tokensPerNFT = _tokensPerNFT;

        __Ownable_init();
    }

    /// @dev validation reward period
    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
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
     * @dev view staked nfts for user (PixTerritory, PixFacility)
     * @param account target user address
     */
    function stakedNFTsOfOwner(address account)
        public
        view
        returns (uint256[] memory, uint256[] memory)
    {
        uint256 pixAmount = stakedPixNFTAmounts[account];
        uint256[] memory pixTokenIds = new uint256[](pixAmount);

        uint256 pixfAmount = stakedPixfNFTAmounts[account];
        uint256[] memory pixfTokenIds = new uint256[](pixfAmount);

        if (pixAmount > 0) {
            uint256 balance = IERC721EnumerableUpgradeable(pixNFT).balanceOf(address(this));
            uint256 j = 0;

            for (uint256 i = 0; i < balance; i++) {
                uint256 tokenId = IERC721EnumerableUpgradeable(pixNFT).tokenOfOwnerByIndex(
                    address(this),
                    i
                );

                if (stakedPixNFTs[account][tokenId]) {
                    pixTokenIds[j++] = tokenId;
                }
            }
        }

        if (pixfAmount > 0) {
            uint256 balance = pixfNFT.balanceOf(address(this));
            uint256 j = 0;

            for (uint256 i = 0; i < balance; i++) {
                uint256 tokenId = pixfNFT.tokenOfOwnerByIndex(address(this), i);

                if (stakedPixfNFTs[account][tokenId]) {
                    pixfTokenIds[j++] = tokenId;
                }
            }
        }

        return (pixTokenIds, pixfTokenIds);
    }

    /**
     * @dev stake some amount of staking token and nfts with fixed ratio
     * @param amount staking token amount(>0) to stake
     * @param pixTokenIds staking pix territory Ids to stake
     * @param pixfTokenIds staking pix facility Ids to stake
     * @notice emit {Staked} event
     */
    function stake(
        uint256 amount,
        uint256[] memory pixTokenIds,
        uint256[] memory pixfTokenIds
    ) public updateReward(msg.sender) {
        uint256 pixLength = pixTokenIds.length;
        uint256 pixfLength = pixfTokenIds.length;

        require(amount > 0 && pixLength > 0 && pixfLength > 0, "Staking: STAKE_ZERO");
        require(amount == (pixLength + pixfLength) * tokensPerNFT, "Staking: TOKENS_UNMATCH_NFTS");

        // PIXT
        pixToken.safeTransferFrom(msg.sender, address(this), amount);
        // PIX Territory
        for (uint256 i = 0; i < pixLength; i++) {
            uint256 tokenId = pixTokenIds[i];

            require(IPIX(pixNFT).isTerritory(tokenId), "Staking: TERRITORY_ONLY");

            IERC721EnumerableUpgradeable(pixNFT).safeTransferFrom(
                msg.sender,
                address(this),
                tokenId
            );
            stakedPixNFTs[msg.sender][tokenId] = true;
        }
        // PIX Facility
        for (uint256 i = 0; i < pixfLength; i++) {
            uint256 tokenId = pixfTokenIds[i];

            pixfNFT.safeTransferFrom(msg.sender, address(this), tokenId);
            stakedPixfNFTs[msg.sender][tokenId] = true;
        }

        totalStaked += amount;
        stakedAmounts[msg.sender] += amount;
        totalStakedPixNFTs += pixLength;
        stakedPixNFTAmounts[msg.sender] += pixLength;
        totalStakedPixfNFTs += pixfLength;
        stakedPixfNFTAmounts[msg.sender] += pixfLength;

        emit Staked(msg.sender, amount, pixTokenIds, pixfTokenIds);
    }

    /**
     * @dev unstake partial staked amount and nfts with fixed ratio
     * @param amount staking token amount(>0) to unstake
     * @param pixTokenIds staking pix territory Ids to unstake
     * @param pixfTokenIds staking pix facility Ids to unstake
     * @notice emit {Unstaked} event
     */
    function unstake(
        uint256 amount,
        uint256[] memory pixTokenIds,
        uint256[] memory pixfTokenIds
    ) public updateReward(msg.sender) {
        uint256 pixLength = pixTokenIds.length;
        uint256 pixfLength = pixfTokenIds.length;

        require(amount > 0 && pixLength > 0 && pixfLength > 0, "Staking: UNSTAKE_ZERO");
        require(amount == (pixLength + pixfLength) * tokensPerNFT, "Staking: TOKENS_UNMATCH_NFTS");

        totalStaked -= amount;
        stakedAmounts[msg.sender] -= amount;
        totalStakedPixNFTs -= pixLength;
        stakedPixNFTAmounts[msg.sender] -= pixLength;
        totalStakedPixfNFTs -= pixfLength;
        stakedPixfNFTAmounts[msg.sender] -= pixfLength;

        // PIXT
        pixToken.safeTransfer(msg.sender, amount);
        // PIX Territory
        for (uint256 i = 0; i < pixLength; i++) {
            uint256 tokenId = pixTokenIds[i];

            require(stakedPixNFTs[msg.sender][tokenId], "Staking: NOT_STAKED_NFT");

            IERC721EnumerableUpgradeable(pixNFT).safeTransferFrom(
                address(this),
                msg.sender,
                tokenId
            );
            stakedPixNFTs[msg.sender][tokenId] = false;
        }
        // PIX Facility
        for (uint256 i = 0; i < pixfLength; i++) {
            uint256 tokenId = pixfTokenIds[i];

            require(stakedPixfNFTs[msg.sender][tokenId], "Staking: NOT_STAKED_NFT");

            pixfNFT.safeTransferFrom(address(this), msg.sender, tokenId);
            stakedPixfNFTs[msg.sender][tokenId] = false;
        }

        emit Unstaked(msg.sender, amount, pixTokenIds, pixfTokenIds);
    }

    /// @dev exit from staking contract - unstake all staked amounts and nfts and claim reward
    function exit() external {
        uint256 amount = stakedAmounts[msg.sender];
        (uint256[] memory pixTokenIds, uint256[] memory pixfTokenIds) = stakedNFTsOfOwner(
            msg.sender
        );
        uint256 pixLength = pixTokenIds.length;
        uint256 pixfLength = pixfTokenIds.length;

        totalStaked -= amount;
        stakedAmounts[msg.sender] -= amount;
        totalStakedPixNFTs -= pixLength;
        stakedPixNFTAmounts[msg.sender] -= pixLength;
        totalStakedPixfNFTs -= pixfLength;
        stakedPixfNFTAmounts[msg.sender] -= pixfLength;

        pixToken.safeTransfer(msg.sender, amount);
        for (uint256 i = 0; i < pixLength; i++) {
            uint256 tokenId = pixTokenIds[i];

            require(stakedPixNFTs[msg.sender][tokenId], "Staking: NOT_STAKED_NFT");

            IERC721EnumerableUpgradeable(pixNFT).safeTransferFrom(
                address(this),
                msg.sender,
                tokenId
            );
            stakedPixNFTs[msg.sender][tokenId] = false;
        }
        for (uint256 i = 0; i < pixfLength; i++) {
            uint256 tokenId = pixfTokenIds[i];

            require(stakedPixfNFTs[msg.sender][tokenId], "Staking: NOT_STAKED_NFT");

            pixfNFT.safeTransferFrom(address(this), msg.sender, tokenId);
            stakedPixfNFTs[msg.sender][tokenId] = false;
        }

        emit Unstaked(msg.sender, amount, pixTokenIds, pixfTokenIds);

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

    /**
     */
    function setTokensPerNFT(uint256 _tokensPerNFT) external onlyOwner {
        require(_tokensPerNFT > 0, "Staking: INVALID_TOKENS_PER_NFT");

        tokensPerNFT = _tokensPerNFT;
    }
}
