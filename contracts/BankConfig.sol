// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interface/IBankConfig.sol";
import "./interface/IInterestModel.sol";

contract BankConfig is IBankConfig, Ownable {

    uint256 public override getReserveBps;      // Will divide 10000
    uint256 public override getLiquidateBps;

    // Whether auto pay rewards to user when withdraw?
    // 0: Do not auto pay rewards.
    // 1: Only pay related rewards.
    // 2: Pay all rewards. (May cost a lot of gas)
    uint256 public override canPayRewardsLending = 2;
    uint256 public override canPayRewardsProd = 2;  // Production
    
    IInterestModel public defaultModel;

    mapping(address => IInterestModel) modelForToken;

    function setParams(uint256 _getReserveBps, uint256 _getLiquidateBps, IInterestModel _interestModel) external onlyOwner {
        require(_getReserveBps < 10000, "ReserveBps should less than 10000");
        require(_getLiquidateBps < 5000, "_getLiquidateBps should less than 5000");

        getReserveBps = _getReserveBps;
        getLiquidateBps = _getLiquidateBps;
        defaultModel = _interestModel;
    }

    function setCanPayRewards(uint256 _canPayRewardsLending, uint256 _canPayRewardsProd) external onlyOwner {
        require(_canPayRewardsLending < 3, "canPayRewardsLending can only be 0, 1, 2");
        require(_canPayRewardsProd < 3, "canPayRewardsProd can only be 0, 1, 2");
        canPayRewardsLending = _canPayRewardsLending;
        canPayRewardsProd = _canPayRewardsProd;
    }

    function setInterestModelForToken(address token, IInterestModel _interestModel) external onlyOwner {
        modelForToken[token] = _interestModel;
    }

    function getInterestRate(uint256 debt, uint256 floating, address token) external view override returns (uint256) {
        IInterestModel interestModel = address(modelForToken[token]) == address(0) ?
            defaultModel : modelForToken[token];

        return interestModel.getInterestRate(debt, floating);
    }
}