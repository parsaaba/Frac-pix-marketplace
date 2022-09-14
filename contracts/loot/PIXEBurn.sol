//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../interfaces/IERC20Burnable.sol";
import "../interfaces/IERC721Mintable.sol";

contract PIXEBurn is OwnableUpgradeable {
    IERC20Burnable public pixeToken;
    IERC721Mintable public pixfNFT;
    uint256 public burnAmount;

    function initialize(
        address _pixeToken,
        address _pixfNFT,
        uint256 _burnAmount
    ) external initializer {
        require(_pixeToken != address(0), "PIXEBurn: INVALID_PIXE");
        require(_pixfNFT != address(0), "PIXEBurn: INVALID_PIXF");
        require(_burnAmount > 0, "PIXEBurn: INVALID_BURN_AMOUNT");

        pixeToken = IERC20Burnable(_pixeToken);
        pixfNFT = IERC721Mintable(_pixfNFT);
        burnAmount = _burnAmount;

        __Ownable_init();
    }

    function setBurnAmount(uint256 _burnAmount) external onlyOwner {
        require(_burnAmount > 0, "PIXEBurn: INVALID_BURN_AMOUNT");

        burnAmount = _burnAmount;
    }

    function burnToMint() external {
        pixeToken.burnFrom(msg.sender, burnAmount);
        pixfNFT.mint(msg.sender);
    }
}
