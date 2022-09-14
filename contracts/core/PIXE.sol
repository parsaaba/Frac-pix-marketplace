//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract PIXE is ERC20PresetMinterPauser {
    string private constant _name = "PlanetIX Elements";
    string private constant _symbol = "IXE";

    constructor() ERC20PresetMinterPauser(_name, _symbol) {}
}
