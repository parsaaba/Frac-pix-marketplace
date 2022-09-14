//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "./InitializedProxy.sol";
import "./FractionalSettings.sol";
import "./ERC721TokenVault.sol";

contract ERC721TokenVaultFactory is Ownable, Pausable {
    /// @notice the number of ERC721 vaults
    uint256 public vaultCount;

    /// @notice the mapping of vault number to vault contract
    mapping(uint256 => address) public vaults;

    /// @notice a settings contract controlled by governance
    address public immutable settings;
    /// @notice the TokenVault logic contract
    address public immutable logic;

    event Mint(address[] tokens, uint256[] ids, uint256 price, address vault, uint256 vaultId);

    constructor(address _settings) {
        settings = _settings;
        logic = address(new ERC721TokenVault());
    }

    /// @notice the function to mint a new vault
    /// @param _name the desired name of the vault
    /// @param _symbol the desired sumbol of the vault
    /// @param _tokens the ERC721 token addresses fo the NFT
    /// @param _ids the uint256 IDs of the token
    /// @param _listPrice the initial price of the NFT
    /// @return the ID of the vault
    function mint(
        string memory _name,
        string memory _symbol,
        address[] memory _tokens,
        uint256[] memory _ids,
        uint256 _supply,
        uint256 _listPrice,
        uint256 _fee
    ) external whenNotPaused returns (uint256) {
        bytes memory _initializationCalldata = abi.encodeWithSignature(
            "initialize(address,address,address[],uint256[],uint256,uint256,uint256,string,string)",
            settings,
            msg.sender,
            _tokens,
            _ids,
            _supply,
            _listPrice,
            _fee,
            _name,
            _symbol
        );

        address vault = address(new InitializedProxy(logic, _initializationCalldata));

        emit Mint(_tokens, _ids, _listPrice, vault, vaultCount);

        uint256 length = _tokens.length;
        for (uint256 i = 0; i < length; i++) {
            IERC721(_tokens[i]).transferFrom(msg.sender, vault, _ids[i]);
        }

        vaults[vaultCount] = vault;
        vaultCount++;

        return vaultCount - 1;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
