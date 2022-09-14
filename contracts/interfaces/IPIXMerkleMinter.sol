//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IPIX.sol";

interface IPIXMerkleMinter {
    function mintToNewOwner(
        address destination,
        address oldOwner,
        IPIX.PIXInfo memory info,
        bytes32 merkleRoot,
        bytes32[] calldata merkleProofs
    ) external returns (uint256);

    function mintToNewOwnerInBatch(
        address destination,
        address oldOwner,
        IPIX.PIXInfo[] memory info,
        bytes32[] calldata merkleRoot,
        bytes32[][] calldata merkleProofs
    ) external returns (uint256[] memory);
}
