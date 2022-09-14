//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    uint8 private _decimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals__
    ) ERC20(name_, symbol_) {
        _mint(msg.sender, 1e24);
        _decimals = decimals__;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
