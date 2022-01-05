// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.8.0;

interface IBankConfig {

    function getInterestRate(uint256 debt, uint256 floating, address token) external view returns (uint256);

    function getReserveBps() external view returns (uint256);

    function getLiquidateBps() external view returns (uint256);

    function canPayRewardsLending() external view returns (uint256);
    function canPayRewardsProd() external view returns (uint256);
}