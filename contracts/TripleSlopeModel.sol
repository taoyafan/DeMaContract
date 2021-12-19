// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interface/IInterestModel.sol";

contract TripleSlopeModel is IInterestModel {
    using SafeMath for uint256;

    function getInterestRate(uint256 debt, uint256 floating) external pure override returns (uint256) {
        uint256 total = debt.add(floating);
        uint256 utilization = total == 0 ? 0 : debt.mul(10000).div(total);
        if (utilization < 900) {
            // Less than 9% utilization 2% APY
            return uint256(2e16) / 365 days;
        } else if (utilization < 4500) {
            // Between 9% and 45% utilization 0% - 10% APY
            return utilization.mul(10e16).div(4500) / 365 days;
        } else if (utilization < 9000) {
            // Between 45% and 90% - 10%-100% APY
            return (10e16 + utilization.sub(4500).mul(200e16).div(10000)) / 365 days;
        } else if (utilization < 10000) {
            // Between 90% and 100% - 100%-300% APY
            return (100e16 + utilization.sub(9000).mul(2000e16).div(10000)) / 365 days;
        } else {
            // 300% APY
            return uint256(300e16) / 365 days;
        }
    }
}