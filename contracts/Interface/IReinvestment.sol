pragma solidity ^0.6.0;

interface IReinvestment {

    // Reserved amount ratio. Will divide by 10000, 0 means not reserved.
    function reservedAmountRatio() external view returns (uint256);

    // Reserved share ratio. Will divide by 10000, 0 means not reserved.
    function reservedShareRatio() external view returns (uint256);

    // total mdx rewards of goblin.
    function userEarnedAmount(address user) external view returns (uint256);

    function deposit(uint256 amount) external;

    function withdraw(uint256 amount) external;
}