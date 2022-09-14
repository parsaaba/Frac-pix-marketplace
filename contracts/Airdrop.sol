//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Airdrop {
    function airdrop(
        address _token,
        address[] calldata _recipients,
        uint256[] calldata _amounts
    ) external payable {
        require(
            _recipients.length == _amounts.length,
            "Recipients and amounts array are not equal"
        );
        for (uint256 i = 0; i < _recipients.length; i++) {
            if (_token == address(0)) {
                (bool sent, ) = _recipients[i].call{value: _amounts[i]}("");
                require(sent, "Failed to send Ether");
            } else {
                IERC20(_token).transferFrom(msg.sender, _recipients[i], _amounts[i]);
            }
        }
    }
}
