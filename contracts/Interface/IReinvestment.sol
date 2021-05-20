pragma solidity ^0.6.0;

interface IReinvestment {
    // total mdx rewards of goblin.
    function userRewards(address user) external view returns (uint256);

    function deposit(uint256 amount) external;

    function withdraw(uint256 amount) external;
}