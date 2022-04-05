// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;


import "@openzeppelin/contracts/math/SafeMath.sol";
import "./utils/SafeToken.sol";
import "./abstract/AReinvestment.sol";
import "./interface/Pancake/IMasterChef.sol";

contract CakeReinvestment is AReinvestment {
    /// @notice Libraries
    using SafeToken for address;
    using SafeMath for uint256;

    IMasterChef public masterChef;
    address public syrup;

    constructor(
        address _masterchef,
        uint256 /* Don't need */,
        address _cake,
        uint256 _reserveRatio           // will divide by 10000, 0 means not reserved.
    ) public AReinvestment(_masterchef, _cake, _reserveRatio) {
        masterChef = IMasterChef(_masterchef);
        syrup = masterChef.syrup();
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

    function _recoverCheck(address token) internal override {
        require(token != dexToken, "Recover token cannot be Cake");
        require(token != syrup, "Recover token cannot be syrup");
    }
}
