// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interface/IReinvestment.sol";
import "./interface/MDX/IBoardRoomMDX.sol";
import "./utils/SafeToken.sol";


contract Reinvestment is Ownable, IReinvestment, ReentrancyGuard {
    /// @notice Libraries
    using SafeToken for address;
    using SafeMath for uint256;

    /// @notice Events
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    address mdx;
    IBoardRoomMDX public boardRoom;
    uint256 public boardRoomPid;        // mdx pid in board room, should be 4 in BSC

    /// @notice Mutable state variables

    mapping(address => uint256) public userShares;
    uint256 public totalShares;
    uint256 public override reservedRatio;       // Reserved share ratio. will divide by 10000, 0 means not reserved.

    constructor(
        IBoardRoomMDX _boardRoom,
        uint256 _boardRoomPid,          // Should be 4 in BSC
        address _mdx,
        uint256 _reserveRatio           // will divide by 10000, 0 means not reserved.
    ) public {
        boardRoom = _boardRoom;
        boardRoomPid = _boardRoomPid;
        mdx = _mdx;
        reservedRatio = _reserveRatio;

        mdx.safeApprove(address(boardRoom), uint256(-1));
    }

    /* ==================================== Read ==================================== */

    function totalAmount() public view returns (uint256) {
        (uint256 deposited, /* rewardDebt */) = boardRoom.userInfo(boardRoomPid, address(this));
        return mdx.myBalance().add(deposited).add(boardRoom.pending(boardRoomPid, address(this)));
    }

    /// @notice Goblin is the user.
    function userEarnedAmount(address account) public view override returns (uint256) {
        return shareToAmount(userShares[account]);
    }

    function amountToShare(uint256 _amount, uint256 _totalAmount) public view returns (uint256) {
        return totalShares == 0 ? _amount : _amount.mul(totalShares).div(_totalAmount);
    }

    function shareToAmount(uint256 _shares) public view returns (uint256) {
        return _shares.mul(totalAmount()).div(totalShares);
    }

    /* ==================================== Write ==================================== */

    // Deposit mdx.
    function deposit(uint256 amount) external  override nonReentrant {
        if (amount > 0) {
            mdx.safeTransferFrom(msg.sender, address(this), amount);
            uint256 shares = amountToShare(amount, totalAmount().sub(amount));
            totalShares = totalShares.add(shares);

            // If there are some reserved shares
            if (reservedRatio != 0) {
                // Reserve some shares to owner
                uint256 ownerShares = shares.mul(reservedRatio).div(10000);
                userShares[owner()] = userShares[owner()].add(ownerShares);

                // Calculate the left shares
                shares = shares.sub(ownerShares);
            }

            userShares[msg.sender] = userShares[msg.sender].add(shares);
        }
    }

    // Withdraw mdx to sender.
    function withdraw(uint256 shares) external override nonReentrant {
        if (shares > 0) {
            uint256 amount = shareToAmount(shares);
            bool needRedeposit = false;

            if (mdx.myBalance() < amount) {
                // If balance is not enough Withdraw from board room first.
                (uint256 depositedMdx, /* rewardDebt */) = boardRoom.userInfo(boardRoomPid, address(this));
                boardRoom.withdraw(boardRoomPid, depositedMdx);
                needRedeposit = true;

                // Check again
                if (mdx.myBalance() < amount) {
                    amount = mdx.myBalance();
                    needRedeposit = false;
                }
            }

            mdx.safeTransfer(msg.sender, amount);

            // Update left shares.
            totalShares = totalShares.sub(shares);
            userShares[msg.sender] = userShares[msg.sender].sub(shares);

            // If withdraw mdx from board room, we need to redeposit.
            if (needRedeposit) {
                boardRoom.deposit(boardRoomPid, mdx.myBalance());
            }
        }
    }

    function reinvest() external nonReentrant {
        boardRoom.withdraw(boardRoomPid, 0);
        boardRoom.deposit(boardRoomPid, mdx.myBalance());
    }

    /* ==================================== Only Owner ==================================== */

    // Used when boardroom is closed.
    function stopReinvest() external onlyOwner {
        (uint256 deposited, /* rewardDebt */) = boardRoom.userInfo(boardRoomPid, address(this));
        if (deposited > 0) {
            boardRoom.withdraw(boardRoomPid, deposited);
        }
    }
}