// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

interface IBSCPool {
    // Pending mdx rewards and Lp token rewards.
    function pending(uint256 _pid, address _user) external view returns (uint256, uint256);

    function deposit(uint256 pid, uint256 amount) external;

    function withdraw(uint256 pid, uint256 amount) external;
}