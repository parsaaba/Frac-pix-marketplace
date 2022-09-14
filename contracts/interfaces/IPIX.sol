//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPIX {
    event TraderUpdated(address indexed trader, bool approved);

    event ModeratorUpdated(address indexed moderator, bool approved);

    event PackPriceUpdated(uint256 indexed mode, uint256 price);

    event CombinePriceUpdated(uint256 price);

    event PaymentTokenUpdated(address indexed token, bool approved);

    event TreasuryUpdated(address treasury, uint256 fee);

    event PIXMinted(
        address indexed account,
        uint256 indexed tokenId,
        uint256 indexed pixId,
        PIXCategory category,
        PIXSize size
    );

    event Combined(uint256 indexed tokenId, PIXCategory category, PIXSize size);

    event Requested(
        uint256 indexed dropId,
        uint256 indexed playerId,
        uint256 indexed mode,
        uint256 purchasedPacks,
        uint256 count
    );

    enum PIXCategory {
        Legendary,
        Rare,
        Uncommon,
        Common,
        Outliers
    }

    enum PIXSize {
        Pix,
        Area,
        Sector,
        Zone,
        Domain
    }

    struct Treasury {
        address treasury;
        uint256 fee;
    }

    struct PIXInfo {
        uint256 pixId;
        PIXCategory category;
        PIXSize size;
    }

    struct DropInfo {
        uint256 maxCount;
        uint256 requestCount;
        uint256 limitForPlayer;
        uint256 startTime;
        uint256 endTime;
    }

    struct PackRequest {
        uint256 playerId;
        uint256 dropId;
    }

    function isTerritory(uint256 tokenId) external view returns (bool);

    function pixesInLand(uint256[] calldata tokenIds) external view returns (bool);

    function setPIXInLandStatus(uint256[] calldata pixIds) external;

    function safeMint(address to, PIXInfo memory info) external;

    function lastTokenId() external view returns (uint256);

    function getTier(uint256 tokenId) external view returns (uint256);
}
