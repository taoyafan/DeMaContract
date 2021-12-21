// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interface/IReinvestment.sol";
import "./interface/MDX/IBoardRoomMDX.sol";
import "./utils/SafeToken.sol";


contract MdxReinvestment is Ownable, IReinvestment, ReentrancyGuard {
    /// @notice Libraries
    using SafeToken for address;
    using SafeMath for uint256;

    /// @notice Events
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Reinvest();
    event StopReinvest();
    event RecoverReinvest();

    address mdx;
    IBoardRoomMDX public boardRoom;
    uint256 public boardRoomPid;        // mdx pid in board room, should be 4 in BSC

    /// @notice Mutable state variables

    mapping(address => uint256) public userShares;
    uint256 public totalShares;
    uint256 public override reservedRatio;       // Reserved share ratio. will divide by 10000, 0 means not reserved.
    bool public canReinvested = true;

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
    function deposit(uint256 amount) external override nonReentrant {
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

            emit Deposit(msg.sender, amount);
        }
    }

    // Withdraw mdx to sender.
    /// @notice Input param is amount rather than shares. Amount can be get from userEarnedAmount()
    function withdraw(uint256 amount) external override nonReentrant {
        if (amount > 0) {
            uint256 shares = amountToShare(amount, totalAmount());
            
            // Check the max shares and amount can be withdraw
            if (shares > userShares[msg.sender]) {
                shares = userShares[msg.sender];
                amount = shareToAmount(shares);
            }

            bool needRedeposit = false;

            if (mdx.myBalance() < amount) {
                // If balance is not enough, withdraw from board room first.
                if (_tryToWithdraw(type(uint256).max)) {
                    needRedeposit = true;
                }

                // Check again, If there don't has enough, withdraw all left.
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
            if (needRedeposit && canReinvested) {
                boardRoom.deposit(boardRoomPid, mdx.myBalance());
            }

            emit Withdraw(msg.sender, amount);
        }
    }

    function reinvest() external nonReentrant {
        require(canReinvested, "Stop reinvested");
        _tryToWithdraw(0);
        boardRoom.deposit(boardRoomPid, mdx.myBalance());

        emit Reinvest();
    }

    /* ==================================== Internal ==================================== */

    /// @dev try to withdraw mdx with amount from board room.
    /// @notice if withdraw all, amount can be type(uint256).max
    /// @return Whether withdrawn
    function _tryToWithdraw(uint256 amount) internal returns (bool) {
        (uint256 deposited, /* rewardDebt */) = boardRoom.userInfo(boardRoomPid, address(this));
        if (deposited > 0) {
            // Can withdraw
            if (amount > deposited) {
                amount = deposited;
            }
            boardRoom.withdraw(boardRoomPid, amount);
            return true;
        } else {
            return false;
        }
    }

    /* ==================================== Only Owner ==================================== */
    
    // Recover ERC20 tokens (Rather than MDX) that were accidentally sent to this smart contract.
    function recover(address token, address to, uint256 value) external onlyOwner nonReentrant {
        require(token != mdx, "Recover token cannot be mdx");
        token.safeTransfer(to, value);
    }

    // Used when boardroom is closed.
    function stopReinvest() external onlyOwner nonReentrant {
        _tryToWithdraw(type(uint256).max);
        canReinvested = false;
        emit StopReinvest();
    }

    function recoverReinvest() external onlyOwner nonReentrant {
        boardRoom.deposit(boardRoomPid, mdx.myBalance());
        canReinvested = true;
        emit RecoverReinvest();
    }

    function setReservedRatio(uint256 ratio) external onlyOwner {
        require(ratio <= 10000, "Reserved ratio cannot lager than 10000");
        reservedRatio = ratio;
    }
}