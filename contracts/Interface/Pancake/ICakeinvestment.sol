// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

interface ICakeinvestment {

    // Reserved share ratio. Will divide by 10000, 0 means not reserved.
    function reservedRatio() external view returns (uint256);

    // total CAKE rewards of goblin.
    function userAmount(address user) external view returns (uint256);

    function deposit(uint256 amount) external;

    function withdraw(uint256 amount) external;
}