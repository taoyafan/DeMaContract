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

    IBoardRoomMDX public boardRoom;
    uint256 public boardRoomPid;        // mdx pid in board room, should be 4 in BSC
    
    /// @notice Mutable state variables

    struct GlobalInfo {
        uint256 totalShares;        // Total staked lp amount.
        uint256 totalMdx;       // Total Mdx amount that already staked to board room.
        uint256 accMdxPerShare;    // Accumulate mdx rewards amount per lp token. 
    }

    struct UserInfo {
        uint256 totalShares;            // Total Lp amount.
        uint256 earnedMdxStored;        // Earned mdx amount stored at the last time user info was updated.
        uint256 accMdxPerShareStored;   // The accMdxPerShare at the last time user info was updated.
    }

    address mdx;
    mapping(address => UserInfo) userInfo;
    GlobalInfo globalInfo;


    constructor(
        IBoardRoomMDX _boardRoom,
        uint256 _boardRoomPid,          // Should be 4 in BSC 
        address _mdx
    ) public {
        boardRoom = _boardRoom;
        boardRoomPid = _boardRoomPid;
        mdx = _mdx;

        mdx.safeApprove(address(boardRoom), uint256(-1));
    }

    /* ==================================== Read ==================================== */

    function userRewards(address user) public view override returns (uint256) {

    }

    function totalRewards() public view returns (uint256) {

    }

    function rewardPerLp() public view  returns (uint256) {
        if (globalInfo.totalShares != 0) {
            // globalInfo.totalMdx is the mdx amount at the last time update.
            return (totalRewards().sub(globalInfo.totalMdx)).div(
                globalInfo.totalShares).add(globalInfo.accMdxPerShare);
        } else {
            return globalInfo.accMdxPerShare;
        }
    }

    function userEarnedAmount(address account) public view  returns (uint256) {
        UserInfo storage user = userInfo[account];
        return user.totalShares.mul(rewardPerLp().sub(user.accMdxPerShareStored)).add(user.earnedMdxStored);
    }

    /* ==================================== Write ==================================== */

    function deposit(uint256 amount) external override {

    }

    function withdraw(uint256 amount) external override {

    }

    /* ==================================== Internal ==================================== */

    /// @dev update pool info and user info.
    function _updatePool(address account) internal {
        /// @notice MUST update accMdxPerShare first as it will use the old totalMdx
        globalInfo.accMdxPerShare = rewardPerLp();
        globalInfo.totalMdx = totalRewards();   

        if (account != address(0)) {
            UserInfo storage user = userInfo[account];
            user.earnedMdxStored = userEarnedAmount(account);
            user.accMdxPerShareStored = globalInfo.accMdxPerShare;
        }
        
    }

    /* ==================================== Only owner ==================================== */

    ///@dev withdraw reserved rewards.
}