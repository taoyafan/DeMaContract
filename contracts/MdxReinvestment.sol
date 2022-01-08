// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./utils/SafeToken.sol";
import "./abstract/AReinvestment.sol";
import "./interface/MDX/IBoardRoomMDX.sol";

contract MdxReinvestment is AReinvestment {
    /// @notice Libraries
    using SafeToken for address;
    using SafeMath for uint256;

    IBoardRoomMDX public boardRoom;
    uint256 public boardRoomPid;        // dexToken pid in board room, should be 4 in BSC

    constructor(
        address _boardRoom,
        uint256 _boardRoomPid,          // Should be 4 in BSC
        address _mdx,
        uint256 _reserveRatio           // will divide by 10000, 0 means not reserved.
    ) public AReinvestment(_boardRoom, _mdx, _reserveRatio) {
        boardRoom = IBoardRoomMDX(_boardRoom);
        boardRoomPid = _boardRoomPid;
    }

    /* ==================================== Internal ==================================== */

    function _dexDepositAmount() internal view override returns (uint256) {
        (uint256 deposited, /* rewardDebt */) = boardRoom.userInfo(boardRoomPid, address(this));
        return deposited;
    }

    function _dexPendingRewards() internal view override returns (uint256) {
        return boardRoom.pending(boardRoomPid, address(this));
    }

    function _dexDeposit(uint256 amount) internal override {
        boardRoom.deposit(boardRoomPid, amount);
    }

    function _dexWithdraw(uint256 amount) internal override {
        boardRoom.withdraw(boardRoomPid, amount);
    }
}