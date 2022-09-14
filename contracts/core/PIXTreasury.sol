//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PIXTreasury is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable pixToken;

    constructor(address pixt) {
        require(pixt != address(0), "Treasury: INVALID_PIXT");
        pixToken = IERC20(pixt);
    }

    function transfer(address to) external onlyOwner {
        pixToken.safeTransfer(to, pixToken.balanceOf(address(this)));
    }
}
