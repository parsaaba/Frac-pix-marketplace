//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/presets/ERC721PresetMinterPauserAutoId.sol";

contract PIXF is ERC721PresetMinterPauserAutoId {
    string private constant _name = "PlanetIX Facilities";
    string private constant _symbol = "IXF";
    string private constant _baseTokenURI = "https://planetix.com/";

    constructor() ERC721PresetMinterPauserAutoId(_name, _symbol, _baseTokenURI) {}
}
