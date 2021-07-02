// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Presale is Ownable {
    using SafeERC20 for IERC20;

    event Invested(address indexed account, uint256 amount);
    event ScheduleStart(uint64 startTime);
    event AllowClaim();
    event Claimed(address indexed account, uint256 amount);
    event Withdrawn(uint256 amount);

    uint256 constant ONE_PER_GAME = 10; // 10 ONE = 1 GAME
    uint256 constant HARD_CAP = 50000 ether; // Hard cap: 50,000 ONE
    uint256 constant PRESALE_TARGET = 10000000 ether; // Target: 10,000,000 ONE
    IERC20 public immutable gameToken; // Game token address
    address public treasury; // Treasury address
    uint64 public startTime; // Presale start time
    uint64 public period; // Presale period
    bool public canClaimGame; // Can claim GAME
    mapping(address => uint256) public invested; // Invested ONE amount
    uint256 public totalInvested;
    mapping(address => bool) public claimed; // Claimed status

    constructor(
        address _gameToken,
        address _treasury,
        uint64 _period
    ) {
        require(_gameToken != address(0), "PRESALE: game token cannot be zero");
        require(_treasury != address(0), "PRESALE: treasury cannot be zero");
        require(_period > 0, "PRESALE: period cannot be zero");

        gameToken = IERC20(_gameToken);
        treasury = _treasury;
        period = _period;
    }

    receive() external payable {
        require(
            startTime > 0 && startTime <= uint64(block.timestamp),
            "PRESALE: not started"
        );
        require(
            startTime + period >= uint64(block.timestamp),
            "PRESALE: ended"
        );
        require(msg.value > 0, "PRESALE: amount cannot be zero");
        invested[msg.sender] = invested[msg.sender] + msg.value;
        totalInvested = totalInvested + msg.value;
        require(totalInvested <= PRESALE_TARGET, "PRESALE: reached to target");
        require(
            invested[msg.sender] <= HARD_CAP,
            "PRESALE: reached to hard cap"
        );

        emit Invested(msg.sender, msg.value);
    }

    function scheduleStart(uint64 _startTime) external onlyOwner {
        require(startTime == 0, "PRESALE: already scheduled");
        require(
            _startTime >= uint64(block.timestamp),
            "PRESALE: must be greater than block time"
        );
        startTime = _startTime;

        emit ScheduleStart(_startTime);
    }

    function isFinished() public view returns (bool) {
        return
            totalInvested >= PRESALE_TARGET ||
            (startTime > 0 && startTime + period < uint64(block.timestamp));
    }

    function allowClaimGame() external onlyOwner {
        require(isFinished(), "PRESALE: not finished");

        canClaimGame = true;

        emit AllowClaim();
    }

    function claim() external {
        require(canClaimGame, "PRESALE: not allowed");
        require(claimed[msg.sender] == false, "PRESALE: already claimed");
        require(invested[msg.sender] > 0, "PRESALE: not invested");

        claimed[msg.sender] = true;
        uint256 gameAmount = invested[msg.sender] / ONE_PER_GAME;
        gameToken.safeTransfer(msg.sender, gameAmount);

        emit Claimed(msg.sender, gameAmount);
    }

    function withdraw() external onlyOwner {
        require(isFinished(), "PRESALE: not finished");
        require(
            address(this).balance > 0,
            totalInvested > 0
                ? "PRESALE: already withdrawn"
                : "PRESALE: no invests"
        );
        (bool sent, ) = treasury.call{value: address(this).balance}("");

        require(sent, "PRESALE: failed to withdraw");

        emit Withdrawn(totalInvested);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "PRESALE: treasury cannot be zero");

        treasury = _treasury;
    }

    function setPeriod(uint64 _period) external onlyOwner {
        require(_period > 0, "PRESALE: period cannot be zero");

        period = _period;
    }
}
