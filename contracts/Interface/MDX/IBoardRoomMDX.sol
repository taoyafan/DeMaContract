// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

interface IBoardRoomMDX {
    // User deposited amount and rewardDebt(don't use it).
    function userInfo(uint _pid, address _user) external view returns (uint256, uint256);

    // Check pending mdx rewards.
    function pending(uint256 _pid, address _user) external view returns (uint256);

    // Deposit mdx. Note MDX's pid in BSC is 4
    function deposit(uint256 _pid, uint256 _amount) external;

    // Withdraw both deposited mdx and reward mdx.
    // if amount is 0 means only withdraw rewards.
    function withdraw(uint256 _pid, uint256 _amount) external;
}