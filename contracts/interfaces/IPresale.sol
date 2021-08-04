// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

interface IPresale {
    function invested(address user) external view returns (uint256);

    function canClaimGame() external view returns (bool);

    function totalInvested() external view returns (uint256);
}
