// SPDX-License-Identifier: AGPLv3
pragma solidity ^0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title LP Token Mocks
/// @author RexForce
/// @dev Why are you looking at this, it's literally just an infinite mint ERC20 
contract ERC20Mock is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    /// @dev Dang look at that a mint function. Such mint. Very DeFi. Wow.
    /// @param amount I wonder what this is for
    function mint(uint256 amount) public {
        _mint(msg.sender, amount);
    }
}
