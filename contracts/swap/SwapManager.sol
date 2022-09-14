//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../interfaces/ISwapManager.sol";

contract SwapManager is ISwapManager, Ownable {
    using SafeERC20 for IERC20;

    event OtherRouterAdded(address indexed token0, address indexed token1, address indexed router);
    event OtherRouterRemoved(address indexed token0, address indexed token1);

    address public immutable router;
    address public immutable weth;

    mapping(address => mapping(address => address)) otherRouters;

    constructor(address _router) {
        require(_router != address(0), "router is zero!");
        router = _router;
        weth = IUniswapV2Router02(_router).WETH();
    }

    function addOtherRouter(
        address token0,
        address token1,
        address otherRouter
    ) external onlyOwner {
        require(token0 != token1, "invalid tokens");
        require(otherRouter != address(0) && otherRouter != router, "invalid router");

        otherRouters[token0][token1] = otherRouter;
        otherRouters[token1][token0] = otherRouter;

        emit OtherRouterAdded(token0, token1, otherRouter);
    }

    function removeOtherRouter(address token0, address token1) external onlyOwner {
        require(otherRouters[token0][token1] != address(0), "no other router");

        delete otherRouters[token0][token1];
        delete otherRouters[token1][token0];

        emit OtherRouterRemoved(token0, token1);
    }

    function swap(
        address srcToken,
        address dstToken,
        uint256 amount,
        address destination
    ) external payable override {
        require(amount > 0, "swap zero");
        address swapRouter = otherRouters[srcToken][dstToken] != address(0)
            ? otherRouters[srcToken][dstToken]
            : router;
        if (srcToken == address(0)) {
            // ETH
            require(msg.value == amount, "invalid eth amount");
            address[] memory path = new address[](2);
            path[0] = weth;
            path[1] = dstToken;
            IUniswapV2Router02(swapRouter).swapExactETHForTokens{value: amount}(
                0,
                path,
                destination,
                block.timestamp
            );
        } else {
            require(msg.value == 0, "invalid eth amount");
            IERC20(srcToken).safeTransferFrom(msg.sender, address(this), amount);
            IERC20(srcToken).approve(swapRouter, amount);
            address[] memory path = new address[](2);
            path[0] = srcToken;
            path[1] = dstToken;
            IUniswapV2Router02(swapRouter).swapExactTokensForTokens(
                amount,
                0,
                path,
                destination,
                block.timestamp
            );
        }
    }
}
