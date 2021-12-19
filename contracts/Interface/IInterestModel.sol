// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.8.0;

interface IInterestModel {
    function getInterestRate(uint256 debt, uint256 floating) external pure returns (uint256);
}