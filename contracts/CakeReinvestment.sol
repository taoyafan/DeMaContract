// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./utils/SafeToken.sol";
import "./abstract/AReinvestment.sol";
import "./interface/Pancake/ICakePool.sol";

contract CakeReinvestment is AReinvestment {
    /// @notice Libraries
    using SafeToken for address;
    using SafeMath for uint256;

    uint256 constant MIN_WITHDRAW_AMOUNT = 0.00001 ether;

    ICakePool public cakePool;

    constructor(
        address _cakePool,
        uint256 /* BoardRoomPoolId */,
        address _cake,
        uint256 _reserveRatio           // will divide by 10000, 0 means not reserved.
    ) public AReinvestment(_cakePool, _cake, _reserveRatio) {
        cakePool = ICakePool(_cakePool);
    }

    // Used to check this value
    function dexDepositAmount() external view returns (uint256) {
        return _dexDepositAmount();
    }

    /* ==================================== Internal ==================================== */

    function _dexDepositAmount() internal view override returns (uint256) {
        uint256 shares = cakePool.userInfo(address(this)).shares;
        uint256 totalAmount = cakePool.balanceOf();
        uint256 totalShares = cakePool.totalShares();

        // Assume total share is not zero
        uint256 amount = shares.mul(totalAmount).div(totalShares);
        return amount;
    }

    function _dexPendingRewards() internal view override returns (uint256) {
        return 0;
    }

    function _dexDeposit(uint256 amount) internal override {
        cakePool.deposit(amount, 0);
    }

    function _dexWithdraw(uint256 amount) internal override {
        if (amount > MIN_WITHDRAW_AMOUNT) {
            cakePool.withdrawByAmount(amount);
        }
    }

    function _recoverCheck(address token) internal override {
        require(token != dexToken, "Recover token cannot be Cake");
    }
}
