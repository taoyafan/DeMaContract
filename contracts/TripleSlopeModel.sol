// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interface/IInterestModel.sol";

contract TripleSlopeModel is IInterestModel, Ownable {
    using SafeMath for uint256;

    struct SlopeBias {
        bool set;
        uint256 k_0_50;
        uint256 b_0_50;
        uint256 k_50_90;
        uint256 b_50_90;
        uint256 k_90_100;
        uint256 b_90_100;
    }

    mapping(address => SlopeBias) slopeBias;

    function getInterestRate(uint256 debt, uint256 floating, address token) external view override returns (uint256) {
        uint256 total = debt.add(floating);
        uint256 utilization = total == 0 ? 0 : debt.mul(10000).div(total);

        SlopeBias storage p = slopeBias[token];
        
        if (utilization < 5000) {
            // Less than 50% utilization
            if (p.set) {
                return (p.b_0_50 + utilization.mul(p.k_0_50).div(10000)) / 365 days;
            } else {
                // Default APY: 0% - 10%
                return (utilization.mul(20e16).div(10000)) / 365 days;
            }

        } else if (utilization < 9000) {
            // Between 50% and 90%
            if (p.set) {
                return (p.b_50_90 + utilization.mul(p.k_50_90).div(10000)) / 365 days;
            } else {
                // Default APY: 10% - 50%
                return (10e16 + utilization.sub(5000).mul(100e16).div(10000)) / 365 days;
            }        
        } else {
            // Between 90% and 100%
            if (p.set) {
                return (p.b_90_100 + utilization.mul(p.k_90_100).div(10000)) / 365 days;
            } else {
                // Default APY: 50% - 100%
                return (50e16 + utilization.sub(9000).mul(500e16).div(10000)) / 365 days;
            }        
        }
    }

    function setSlopeBias(
        address token,
        uint256 k_0_50,
        uint256 b_0_50,
        uint256 k_50_90,
        uint256 b_50_90,
        uint256 k_90_100,
        uint256 b_90_100
    ) external onlyOwner {
        slopeBias[token].set = true;
        slopeBias[token].k_0_50 = k_0_50;
        slopeBias[token].b_0_50 = b_0_50;
        slopeBias[token].k_50_90 = k_50_90;
        slopeBias[token].b_50_90 = b_50_90;
        slopeBias[token].k_90_100 = k_90_100;
        slopeBias[token].b_90_100 = b_90_100;
    }
}