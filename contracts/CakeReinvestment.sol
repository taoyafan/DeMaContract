// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;


import "@openzeppelin/contracts/math/SafeMath.sol";
import "./utils/SafeToken.sol";
import "./AReinvestment.sol";
import "./interface/Pancake/IMasterChef.sol";

contract CakeReinvestment is AReinvestment {
    /// @notice Libraries
    using SafeToken for address;
    using SafeMath for uint256;

    IMasterChef public masterChef;

    constructor(
        address _masterchef,
        address _cake,
        uint256 _reserveRatio           // will divide by 10000, 0 means not reserved.
    ) public AReinvestment(_masterchef, _cake, _reserveRatio) {
        masterChef = IMasterChef(_masterchef);
    }

    /* ==================================== Internal ==================================== */

    function _dexDepositAmount() internal view override returns (uint256) {
        (uint256 deposited, /* rewardDebt */) = masterChef.userInfo(0, address(this));
        return deposited;
    }

    function _dexPendingRewards() internal view override returns (uint256) {
        return masterChef.pendingCake(0, address(this));
    }

    function _dexDeposit(uint256 amount) internal override {
        masterChef.enterStaking(amount);
    }

    function _dexWithdraw(uint256 amount) internal override {
        masterChef.leaveStaking(amount);
    }
}
