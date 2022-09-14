//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import "../interfaces/IPIX.sol";

contract PIXMerkleMinter is OwnableUpgradeable {
    mapping(bytes32 => bool) public merkleRoots;
    mapping(bytes32 => bool) public leafUsed;

    IPIX public pix;

    mapping(address => bool) public delegateMinters;

    function initialize(address _pix) external initializer {
        require(_pix != address(0), "Pix: INVALID_PIX");
        __Ownable_init();

        pix = IPIX(_pix);
    }

    function setMerkleRoot(bytes32 _merkleRoot, bool add) external onlyOwner {
        merkleRoots[_merkleRoot] = add;
    }

    function mintByProof(
        address to,
        IPIX.PIXInfo memory info,
        bytes32 merkleRoot,
        bytes32[] calldata merkleProofs
    ) public {
        require(merkleRoots[merkleRoot], "Pix: invalid root");
        bytes32 leaf = keccak256(abi.encode(to, info.pixId, info.category, info.size));
        require(!leafUsed[leaf], "Pix: already minted");
        leafUsed[leaf] = true;
        require(
            MerkleProofUpgradeable.verify(merkleProofs, merkleRoot, leaf),
            "Pix: invalid proof"
        );
        pix.safeMint(to, info);
    }

    function mintByProofInBatch(
        address to,
        IPIX.PIXInfo[] memory info,
        bytes32[] calldata merkleRoot,
        bytes32[][] calldata merkleProofs
    ) external {
        require(
            info.length == merkleRoot.length && info.length == merkleProofs.length,
            "Pix: invalid length"
        );
        uint256 len = info.length;
        for (uint256 i; i < len; i += 1) {
            mintByProof(to, info[i], merkleRoot[i], merkleProofs[i]);
        }
    }

    function setDelegateMinter(address _minter, bool enabled) external onlyOwner {
        delegateMinters[_minter] = enabled;
    }

    function mintToNewOwner(
        address destination,
        address oldOwner,
        IPIX.PIXInfo memory info,
        bytes32 merkleRoot,
        bytes32[] calldata merkleProofs
    ) public returns (uint256) {
        require(delegateMinters[msg.sender], "Pix: not delegate minter");
        require(merkleRoots[merkleRoot], "Pix: invalid root");
        bytes32 leaf = keccak256(abi.encode(oldOwner, info.pixId, info.category, info.size));
        require(!leafUsed[leaf], "Pix: already minted");
        leafUsed[leaf] = true;
        require(
            MerkleProofUpgradeable.verify(merkleProofs, merkleRoot, leaf),
            "Pix: invalid proof"
        );
        pix.safeMint(destination, info);

        return pix.lastTokenId();
    }

    function mintToNewOwnerInBatch(
        address destination,
        address oldOwner,
        IPIX.PIXInfo[] memory info,
        bytes32[] calldata merkleRoot,
        bytes32[][] calldata merkleProofs
    ) external returns (uint256[] memory) {
        require(
            info.length > 0 &&
                info.length == merkleRoot.length &&
                info.length == merkleProofs.length,
            "Pix: invalid length"
        );
        uint256 len = info.length;
        uint256[] memory newIds = new uint256[](len);
        for (uint256 i; i < len; i += 1) {
            newIds[i] = mintToNewOwner(
                destination,
                oldOwner,
                info[i],
                merkleRoot[i],
                merkleProofs[i]
            );
        }

        return newIds;
    }

    function disableProof(
        address to,
        IPIX.PIXInfo memory info,
        bytes32 merkleRoot,
        bytes32[] calldata merkleProofs
    ) external onlyOwner {
        require(merkleRoots[merkleRoot], "Pix: invalid root");
        bytes32 leaf = keccak256(abi.encode(to, info.pixId, info.category, info.size));
        require(!leafUsed[leaf], "Pix: already minted");
        require(
            MerkleProofUpgradeable.verify(merkleProofs, merkleRoot, leaf),
            "Pix: invalid proof"
        );
        leafUsed[leaf] = true;
    }
}
