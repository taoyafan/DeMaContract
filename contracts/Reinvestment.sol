pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./Interface/IReinvestment.sol";
import "./Interface/IBoardRoomMDX.sol";
import "./utils/SafeToken.sol";


contract Reinvestment is Ownable, IReinvestment {
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

    struct GlobalInfo {
        uint256 totalShares;        // Total staked lp amount.
        uint256 totalMdx;           // Total Mdx amount that already staked to board room.
        uint256 accMdxPerShare;     // Accumulate mdx rewards amount per lp token.
        uint256 lastUpdateTime;
    }

    struct UserInfo {
        uint256 totalShares;            // Total Lp amount.
        uint256 earnedMdxStored;        // Earned mdx amount stored at the last time user info was updated.
        uint256 accMdxPerShareStored;   // The accMdxPerShare at the last time user info was updated.
        uint256 lastUpdateTime;
    }

    mapping(address => UserInfo) public userInfo;
    GlobalInfo public globalInfo;
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

    function totalRewards() public view returns (uint256) {
        (uint256 deposited, /* rewardDebt */) = boardRoom.userInfo(boardRoomPid, address(this));
        return mdx.myBalance().add(deposited).add(boardRoom.pending(boardRoomPid, address(this)));
    }

    function rewardsPerShare() public view  returns (uint256) {
        if (globalInfo.totalShares != 0) {
            // globalInfo.totalMdx is the mdx amount at the last time update.
            return (totalRewards().sub(globalInfo.totalMdx)).div(
                globalInfo.totalShares).add(globalInfo.accMdxPerShare);
        } else {
            return globalInfo.accMdxPerShare;
        }
    }

    /// @notice Goblin is the user.
    function userEarnedAmount(address account) public view override returns (uint256) {
        UserInfo storage user = userInfo[account];
        return user.totalShares.mul(rewardsPerShare().sub(user.accMdxPerShareStored)).add(user.earnedMdxStored);
    }

    /* ==================================== Write ==================================== */

    // Deposit mdx.
    function deposit(uint256 amount) external override {
        if (amount > 0) {
            _updatePool(msg.sender);
            mdx.safeTransferFrom(msg.sender, address(this), amount);

            UserInfo storage user = userInfo[msg.sender];
            uint256 shares = _amountToShare(amount);

            // Update global info first
            globalInfo.totalMdx = globalInfo.totalMdx.add(amount);
            globalInfo.totalShares = globalInfo.totalShares.add(shares);

            // If there are some reserved shares
            if (reservedRatio != 0) {
                UserInfo storage owner = userInfo[owner()];
                uint256 ownerShares = shares.mul(reservedRatio).div(10000);
                uint256 ownerAmount = amount.mul(reservedRatio).div(10000);
                owner.totalShares = owner.totalShares.add(ownerShares);
                owner.earnedMdxStored = owner.earnedMdxStored.add(ownerAmount);

                // Calculate the left shares
                shares = shares.sub(ownerShares);
                amount = amount.sub(ownerAmount);
            }

            user.totalShares = user.totalShares.add(shares);
            user.earnedMdxStored = user.earnedMdxStored.add(amount);
        }
    }

    // Withdraw mdx to sender.
    function withdraw(uint256 amount) external override {
        if (amount > 0) {
            require(userInfo[msg.sender].earnedMdxStored >= amount, "User don't have enough amount");

            _updatePool(msg.sender);
            UserInfo storage user = userInfo[msg.sender];

            bool isWithdraw = false;
            if (mdx.myBalance() < amount) {
                // If balance is not enough Withdraw from board room first.
                (uint256 depositedMdx, /* rewardDebt */) = boardRoom.userInfo(boardRoomPid, address(this));
                boardRoom.withdraw(boardRoomPid, depositedMdx);
                isWithdraw = true;
            }
            mdx.safeTransfer(msg.sender, amount);

            // Update left share and amount.
            uint256 share = _amountToShare(amount);
            globalInfo.totalShares = globalInfo.totalShares.sub(share);
            globalInfo.totalMdx = globalInfo.totalMdx.sub(amount);
            user.totalShares = user.totalShares.sub(share);
            user.earnedMdxStored = user.earnedMdxStored.sub(amount);

            // If withdraw mdx from board room, we need to redeposit.
            if (isWithdraw) {
                boardRoom.deposit(boardRoomPid, mdx.myBalance());
            }
        }
    }

    function reinvest() external {
        boardRoom.withdraw(boardRoomPid, 0);
        boardRoom.deposit(boardRoomPid, mdx.myBalance());
    }

    /* ==================================== Internal ==================================== */

    /// @dev update pool info and user info.
    function _updatePool(address account) internal {
        if (globalInfo.lastUpdateTime != block.timestamp) {
            /// @notice MUST update accMdxPerShare first as it will use the old totalMdx
            globalInfo.accMdxPerShare = rewardsPerShare();
            globalInfo.totalMdx = totalRewards();
            globalInfo.lastUpdateTime = block.timestamp;
        }

        UserInfo storage user = userInfo[account];
        if (account != address(0) && user.lastUpdateTime != block.timestamp) {
            user.earnedMdxStored = userEarnedAmount(account);
            user.accMdxPerShareStored = globalInfo.accMdxPerShare;
            user.lastUpdateTime = block.timestamp;
        }
    }

    function _amountToShare(uint256 amount) internal view returns (uint256) {
        return globalInfo.totalMdx == 0 ?
            amount : amount.mul(globalInfo.totalShares).div(globalInfo.totalMdx);
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