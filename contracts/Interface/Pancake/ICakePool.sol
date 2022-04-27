// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface ICakePool {

    struct UserInfo {
        uint256 shares; // number of shares for a user.
        uint256 lastDepositedTime; // keep track of deposited time for potential penalty.
        uint256 cakeAtLastUserAction; // keep track of cake deposited at the last user action.
        uint256 lastUserActionTime; // keep track of the last user action time.
        uint256 lockStartTime; // lock start time.
        uint256 lockEndTime; // lock end time.
        uint256 userBoostedShare; // boost share, in order to give the user higher reward. The user only enjoys the reward, so the principal needs to be recorded as a debt.
        bool locked; //lock status.
        uint256 lockedAmount; // amount deposited during lock period.
    }
    
    /* ==================================== Read ==================================== */
    // currentAmount = (balanceOf() * userShare) / totalShares;
    // Ignore pending cake because it is updated almost every block

    // Total amount
    function balanceOf() external view returns (uint256);

    // Used to read shares
    function userInfo(address) external view returns (UserInfo memory);

    function totalShares() external view returns (uint256);

    /* ==================================== Write ==================================== */

    function deposit(uint256 _amount, uint256 _lockDuration) external;

    function withdrawByAmount(uint256 _amount) external;

    function withdraw(uint256 _shares) external;
}