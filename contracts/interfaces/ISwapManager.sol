//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISwapManager {
    function swap(
        address srcToken,
        address dstToken,
        uint256 amount,
        address destination
    ) external payable;
}
