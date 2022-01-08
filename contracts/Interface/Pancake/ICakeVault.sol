/**
 *Submitted for verification at BscScan.com on 2021-04-29
*/

// File: @openzeppelin/contracts/utils/Context.sol

// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

interface ICakeVault {
    function userInfo(address account) external view returns(uint256 shares, uint256 lastDepositedTime, uint256 cakeAtLastUserAction, uint256 lastUserActionTime);
    function totalShares() external view returns(uint256);
    function balanceOf() external view returns (uint256);
    function deposit(uint256 _amount) external;
    function withdrawAll() external;
    function withdraw(uint256 _shares) external;
    function harvest() external;
}