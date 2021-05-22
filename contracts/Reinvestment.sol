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
    }

    struct UserInfo {
        uint256 totalShares;            // Total Lp amount.
        uint256 earnedMdxStored;        // Earned mdx amount stored at the last time user info was updated.
        uint256 accMdxPerShareStored;   // The accMdxPerShare at the last time user info was updated.
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
        reserveRatio = _reserveRatio;

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
    function userEarnedAmount(address account) public view  returns (uint256) {
        UserInfo storage user = userInfo[account];
        return user.totalShares.mul(rewardsPerShare().sub(user.accMdxPerShareStored)).add(user.earnedMdxStored);
    }

    /* ==================================== Write ==================================== */

    // Deposit mdx.
    function deposit(uint256 amount) external override {
        if (amount > 0) {
            _updatePool(msg.sender);
            mdx.safeTransferFrom(msg.sender, address(this), amount);

            // TODO add reserved amount and change these param.

            uint256 shares = _amountToShare(amount);
            user.shares = user.shares.add(shares);
            globalInfo.totalMdx = globalInfo.totalMdx.add(amount);
            globalInfo.totalShares = globalInfo.totalShares.add(shares);
        }
    }

    // Withdraw mdx.
    function withdraw(uint256 amount) external override {
        if (amount > 0) {
            _updatePool(msg.sender);
            require(userInfo[msg.sender].earnedMdxStored >= amount, "User don't have enough amount");

            if (mdx.myBalance() < amount) {
                // If balance is not enough Withdraw from board room first.
                boardRoom.withdraw(boardRoomId, userInfo(boardRoomId, address(this)));
            }
            mdx.safeTransfer(msg.sender, amount);

            // TODO Update reserved amount

            boardRoom.withdraw(boardRoomId, userInfo(boardRoomId, address(this)));
        }
    }

    /* ==================================== Internal ==================================== */

    /// @dev update pool info and user info.
    function _updatePool(address account) internal {
        /// @notice MUST update accMdxPerShare first as it will use the old totalMdx
        globalInfo.accMdxPerShare = rewardsPerShare();
        globalInfo.totalMdx = totalRewards();

        if (account != address(0)) {
            UserInfo storage user = userInfo[account];
            user.earnedMdxStored = userEarnedAmount(account);
            user.accMdxPerShareStored = globalInfo.accMdxPerShare;
        }
    }

    function _amountToShare(uint256 amount) internal {
        return amount.mul(globalInfo.totalShares).div(globalInfo.totalMdx);
    }

    /* ==================================== Only owner ==================================== */

    ///@dev withdraw reserved rewards.
}