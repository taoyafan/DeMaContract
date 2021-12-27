// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "./abstract/AStrategyWithdrawMinimizeTrading.sol";
import "./interface/Pancake/IPancakeRouter02.sol";
import "./utils/SafeToken.sol";
import "./utils/Math.sol";


contract CakeStrategyWithdrawMinimizeTrading is AStrategyWithdrawMinimizeTrading {
    using SafeToken for address;
    using SafeMath for uint256;

    /// @dev Create a new withdraw minimize trading strategy instance for cake.
    /// @param _router The cake router smart contract.
    constructor(address _router) public AStrategyWithdrawMinimizeTrading(_router) {
        wBNB = IPancakeRouter02(_router).WETH();
    }

    function _getMktSellAmount(uint256 aIn, uint256 rIn, uint256 rOut) 
        internal pure override returns (uint256) 
    {
        if (aIn == 0) return 0;
        require(rIn > 0 && rOut > 0, "bad reserve values");
        uint256 aInWithFee = aIn.mul(9975);
        uint256 numerator = aInWithFee.mul(rOut);
        uint256 denominator = rIn.mul(10000).add(aInWithFee);
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
