// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC20 is ERC20 {
    constructor(uint256 totalSupply) ERC20("MockToken", "MOCK") {
        _mint(msg.sender, totalSupply);
    }
}
