// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "./abstract/AGoblinWithoutDexPool.sol";
import "./interface/Pancake/IPancakeRouter02.sol";
import "./interface/Pancake/IMasterChef.sol";
import "./utils/SafeToken.sol";
import "./utils/Math.sol";


contract CakeGoblinWithoutDexPool is AGoblinWithoutDexPool {
    /// @notice Libraries
    using SafeToken for address;
    using SafeMath for uint256;

    constructor(
        address _operator,              // Bank
        address _farm,                  // Farm
        uint256 _poolId,                // Farm pool id
        address _router,
        address _cake,
        address _token0,
        address _token1,
        address _liqStrategy
    ) public AGoblinWithoutDexPool(_operator, _farm, _poolId, 
                _router, _cake, _token0, _token1, _liqStrategy) {}

    /* ==================================== Internal ==================================== */

    function _WBNB(address _router) internal view override returns (address) {
        return IPancakeRouter02(_router).WETH();
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
        uint256 aInWithFee = aIn.mul(9975);
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
        uint256 denominator = rOut.sub(aOut).mul(9975);
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
        uint256 part2 = ra.mul(10000).div(9975);
        uint256 part3 = da.mul(rb).div(db);

        uint256 b = part2.add(part3).sub(part1);
        uint256 nc = part1.mul(part2);

        // (-b + math.sqrt(b * b + 4 * nc)) / 2
        // Note that nc = - c
        return Math.sqrt(b.mul(b).add(nc.mul(4))).sub(b).div(2);
    }

}
