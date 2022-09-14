//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "../interfaces/IPIX.sol";

contract PIXLandmark is ERC721EnumerableUpgradeable, OwnableUpgradeable {
    using StringsUpgradeable for uint256;

    event LandmarkMinted(
        address indexed account,
        uint256 indexed tokenId,
        PIXCategory category,
        uint256 indexed landmarkType
    );

    enum PIXCategory {
        Legendary,
        Rare,
        Uncommon,
        Common,
        Outliers
    }

    struct LandmarkInfo {
        PIXCategory category;
        uint256 landmarkType;
    }

    string private _baseURIExtended;
    IPIX public pixNFT;

    mapping(address => bool) public moderators;
    mapping(uint256 => LandmarkInfo) public landInfos;
    mapping(uint256 => bool) public pixesInLandStatus;
    mapping(uint256 => uint256[]) public pixesInLandType;
    uint256 public lastTokenId;

    modifier onlyMod() {
        require(moderators[msg.sender], "Landmark: NON_MODERATOR");
        _;
    }

    function initialize(address pix) external initializer {
        require(pix != address(0), "Landmark: INVALID_PIX");
        __ERC721Enumerable_init();
        __ERC721_init("PIX Landmark", "PIXLand");
        __Ownable_init();
        pixNFT = IPIX(pix);
        moderators[msg.sender] = true;
    }

    function setModerator(address moderator, bool approved) external onlyOwner {
        require(moderator != address(0), "Landmark: INVALID_MODERATOR");
        moderators[moderator] = approved;
    }

    function addLandmarkType(uint256 landmarkType, uint256[] calldata pixIds) external onlyMod {
        require(landmarkType > 0, "Landmark: INVALID_TYPE");

        for (uint256 i; i < pixIds.length; i += 1) {
            pixesInLandStatus[pixIds[i]] = true;
            pixesInLandType[landmarkType].push(pixIds[i]);
            pixNFT.setPIXInLandStatus(pixIds);
        }
    }

    function safeMint(address to, LandmarkInfo memory info) external onlyMod {
        require(info.landmarkType > 0, "Landmark: INVALID_TYPE");

        lastTokenId += 1;
        _safeMint(to, lastTokenId);
        landInfos[lastTokenId] = info;
        emit LandmarkMinted(to, lastTokenId, info.category, info.landmarkType);
    }

    function batchMint(PIXCategory[] calldata categories, uint256[] calldata landTypes) external {
        require(categories.length == landTypes.length, "Landmark: INVALID_ARGUMENTS");
        for (uint256 i; i < categories.length; i += 1)
            this.safeMint(msg.sender, LandmarkInfo(categories[i], landTypes[i]));
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        uint256 landType = landInfos[tokenId].landmarkType;
        require(landType > 0, "Landmark: NOT_EXISTING");
        return string(abi.encodePacked(_baseURIExtended, landType.toString()));
    }

    function setBaseURI(string memory baseURI_) external onlyOwner {
        _baseURIExtended = baseURI_;
    }
}
