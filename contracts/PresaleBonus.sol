// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPresale.sol";

contract PresaleBonus is Ownable {
    using SafeERC20 for IERC20;

    event BonusClaimed(address indexed account, uint256 amount);
    event AllowClaim();

    uint256 constant ONE_PER_GAME = 10; // 10 ONE = 1 GAME
    IERC20 public immutable gameToken; // Game token address
    IPresale public immutable presale; // Presale address
    mapping(address => bool) public claimed; // Claimed status
    bool public canClaimGame;

    constructor(address _gameToken, address _presale) {
        require(_gameToken != address(0), "PRESALE: game token cannot be zero");
        require(_presale != address(0), "PRESALE: presale cannot be zero");

        gameToken = IERC20(_gameToken);
        presale = IPresale(_presale);
    }

    function claim() external {
        require(presale.canClaimGame() && canClaimGame, "PRESALE: not allowed");
        require(claimed[msg.sender] == false, "PRESALE: already claimed");
        require(presale.invested(msg.sender) > 0, "PRESALE: not invested");

        claimed[msg.sender] = true;
        uint256 gameAmount = presale.invested(msg.sender) / ONE_PER_GAME / 2; // 50% of presale funds
        gameToken.safeTransfer(msg.sender, gameAmount);

        emit BonusClaimed(msg.sender, gameAmount);
    }

    function allowClaimGame() external onlyOwner {
        require(canClaimGame == false);
        uint256 requireAmount = presale.totalInvested() / ONE_PER_GAME / 2;
        uint256 balance = gameToken.balanceOf(address(this));
        require(balance >= requireAmount, "PRESALE: No enough GAME");
        if (balance - requireAmount > 0) {
            gameToken.safeTransfer(owner(), balance - requireAmount);
        }
        canClaimGame = true;

        emit AllowClaim();
    }
}
