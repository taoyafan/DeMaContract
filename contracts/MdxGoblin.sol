// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "./abstract/AGoblin.sol";
import "./interface/MDX/IMdexRouter.sol";
import "./interface/MDX/IBSCPool.sol";
import "./utils/SafeToken.sol";


contract MdxGoblin is AGoblin {
    /// @notice Libraries
    using SafeToken for address;
    using SafeMath for uint256;

    constructor(
        address _operator,              // Bank
        address _farm,                  // Farm
        uint256 _poolId,                // Farm pool id
        address _reinvestment,          // Mdx reinvestment
        address _bscPool,
        uint256 _bscPoolId,
        address _router,
        address _mdx,
        address _token0,
        address _token1,
        address _liqStrategy
    )
        public
        AGoblin(_operator, _farm, _poolId, _reinvestment, _bscPool,
            _bscPoolId, _router, _mdx, _token0, _token1, _liqStrategy)
    {
        wBNB = IMdexRouter(_router).WBNB();
    }

    /* ==================================== Internal ==================================== */

    function _dexPoolPendingRewards() internal view override returns (uint256) {
        (uint256 poolPendingMdx, /* poolPendingLp */) = IBSCPool(dexPool).pending(dexPoolId, address(this));
        return poolPendingMdx;
    }

    function _dexPoolDeposit(uint256 amount) internal override {
        IBSCPool(dexPool).deposit(dexPoolId, amount);
    }

    function _dexPoolWithdraw(uint256 amount) internal override {
        IBSCPool(dexPool).withdraw(dexPoolId, amount);
    }

    /**
     * @dev Return maximum output given the input amount and the status of Uniswap reserves.
     * @param aIn The amount of asset to market sell.
     * @param rIn the amount of asset in reserve for input.
     * @param rOut The amount of asset in reserve for output.
     */
    function _getMktSellAmount(uint256 aIn, uint256 rIn, uint256 rOut) internal pure override returns (uint256) {
        if (aIn == 0) return 0;
        require(rIn > 0 && rOut > 0, "bad reserve values");
        uint256 aInWithFee = aIn.mul(9970);
        uint256 numerator = aInWithFee.mul(rOut);
        uint256 denominator = rIn.mul(10000).add(aInWithFee);
        return numerator.div(denominator);
    }

    /**
     * @dev Return minmum input given the output amount and the status of Uniswap reserves.
     * @param aOut The output amount of asset after market sell.
     * @param rIn the amount of asset in reserve for input.
     * @param rOut The amount of asset in reserve for output.
     */
    function _getMktSellInAmount(uint256 aOut, uint256 rIn, uint256 rOut) internal pure override returns (uint256) {
        if (aOut == 0) return 0;
        require(rIn > 0, "Get sell in amount, rIn must > 0");
        require(rOut > aOut, "Get sell in amount, rOut must > aOut");
        uint256 numerator = rIn.mul(aOut).mul(10000);
        uint256 denominator = rOut.sub(aOut).mul(9970);
        return numerator.div(denominator);
    }

    /**
     * @dev Swap A to B with the input debts ratio
     * @notice na/da should lager than nb/db
     *
     * @param ra Reserved token A in LP pair.
     * @param rb Reserved token B in LP pair.
     * @param da Debts of token A.
     * @param db Debts of token B.
     * @param na Current available balance of token A.
     * @param nb Current available balance of token B.
     *
     * @return uint256 How many A should be swaped to B.
     */
    function _swapAToBWithDebtsRatio(
        uint256 ra,
        uint256 rb,
        uint256 da,
        uint256 db,
        uint256 na,
        uint256 nb
    ) internal pure override returns (uint256) {
        // This can also help to make sure db != 0
        require(na.mul(db) > nb.mul(da), "na/da should lager than nb/db");

        if (da == 0) {
            return na;
        }

        uint256 part1 = na.sub(nb.mul(da).div(db));
        uint256 part2 = ra.mul(10000).div(9970);
        uint256 part3 = da.mul(rb).div(db);

        uint256 b = part2.add(part3).sub(part1);
        uint256 nc = part1.mul(part2);

        // (-b + math.sqrt(b * b + 4 * nc)) / 2
        // Note that nc = - c
        return Math.sqrt(b.mul(b).add(nc.mul(4))).sub(b).div(2);
    }
}
