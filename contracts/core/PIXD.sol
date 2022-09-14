//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/presets/ERC721PresetMinterPauserAutoId.sol";

contract PIXD is ERC721PresetMinterPauserAutoId {
    string private constant _name = "PlanetIX Drones";
    string private constant _symbol = "IXD";
    string private constant _baseTokenURI = "https://planetix.com/";

    constructor() ERC721PresetMinterPauserAutoId(_name, _symbol, _baseTokenURI) {}
}
