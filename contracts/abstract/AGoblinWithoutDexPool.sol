// SPDX-License-Identifier: MIT
// Goblin without dex farm pool
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./../interface/IRouter.sol";
import "./../interface/IFactory.sol";
import "./../interface/IPair.sol";

import "./../interface/IFarm.sol";
import "./../interface/IGoblin.sol";
import "./../interface/IStrategy.sol";

import "./../utils/SafeToken.sol";
import "./../utils/Math.sol";

abstract contract AGoblinWithoutDexPool is Ownable, ReentrancyGuard, IGoblin {
    /// @notice Libraries
    using SafeToken for address;
    using SafeMath for uint256;

    /// @notice Events
    event AddPosition(uint256 indexed id, uint256 lpAmount);
    event RemovePosition(uint256 indexed id, uint256 lpAmount);
    event Liquidate(uint256 indexed id, address lpTokenAddress, uint256 lpAmount,
        address[2] debtToken, uint256[2] liqAmount);

    /// @notice Immutable variables
    IFarm public farm;
    uint256 public poolId;

    address dexPool;
    uint256 dexPoolId;

    IPair public lpToken;
    address public dexToken;
    address public wBNB;
    address public token0;      // lpToken.token0(), Won't be 0
    address public token1;      // lpToken.token1(), Won't be 0
    address public operator;    // Bank

    /// @notice Mutable state variables
    uint256 private globalLp;
    mapping(address => uint256) private userLp;
    mapping(uint256 => uint256) public override posLPAmount;

    // Principal of each tokens in each pos. Same order with borrow tokens
    mapping(uint256 => uint256[2]) public principal;
    mapping(address => bool) public strategiesOk;
    IStrategy public liqStrategy;

    /// @notice temp params
    struct TempParams {
        uint256 beforeLPAmount;
        uint256 afterLPAmount;
        uint256 deltaAmount;
    }

    constructor(
        address _operator,              // Bank
        address _farm,                  // Farm
        uint256 _poolId,                // Farm pool id
        address _router,
        address _dexToken,
        address _token0,
        address _token1,
        address _liqStrategy
    ) public {
        operator = _operator;
        farm = IFarm(_farm);
        poolId  = _poolId;

        // DexToken related params.
        dexToken = _dexToken;
        IFactory factory = IFactory(IRouter(_router).factory());

        wBNB = _WBNB(_router);
        _token0 = _token0 == address(0) ? wBNB : _token0;
        _token1 = _token1 == address(0) ? wBNB : _token1;

        lpToken = IPair(factory.getPair(_token0, _token1));
        require(address(lpToken) != address(0), 'Pair not exit');
        // May switch the order of tokens
        token0 = lpToken.token0();
        token1 = lpToken.token1();

        liqStrategy = IStrategy(_liqStrategy);
        strategiesOk[_liqStrategy] = true;

    }

    /// @dev Require that the caller must be the operator (the bank).
    modifier onlyOperator() {
        require(msg.sender == operator, "not operator");
        _;
    }

    /* ==================================== Read ==================================== */

    /// @dev Keep interface same with AGoblin
    function globalInfo() external view returns (        
        uint256 totalLp,
        uint256 totalDexToken,      // Don't need
        uint256 accDexTokenPerLp,   // Don't need
        uint256 lastUpdateTime      // Don't need
    ) {
        totalLp = globalLp;
        totalDexToken = 0;
        accDexTokenPerLp = 0;
        lastUpdateTime = 0;
    }

    /// @dev Keep interface same with AGoblin
    function userInfo(address user) external view returns (
        uint256 totalLp,
        uint256 earnedDexTokenStored,   // Don't need
        uint256 accDexTokenPerLpStored, // Don't need
        uint256 lastUpdateTime          // Don't need
    ) {
        totalLp = userLp[user];
        earnedDexTokenStored = 0;
        accDexTokenPerLpStored = 0;
        lastUpdateTime = 0;
    }
    /**
     * @dev Return the amount of each borrow token can be withdrawn with the given borrow amount rate.
     * @param id The position ID to perform health check.
     * @param borrowTokens Address of two tokens this position had debts.
     * @param debts Debts of two tokens.
     */
    function health(
        uint256 id,
        address[2] calldata borrowTokens,
        uint256[2] calldata debts
    ) external view override returns (uint256[2] memory) {

        require(borrowTokens[0] == token0 ||
                borrowTokens[0] == token1 ||
                borrowTokens[0] == address(0), "borrowTokens[0] not token0 and token1");

        require(borrowTokens[1] == token0 ||
                borrowTokens[1] == token1 ||
                borrowTokens[1] == address(0), "borrowTokens[1] not token0 and token1");

        // 1. Get the position's LP balance and LP total supply.
        uint256 lpBalance = posLPAmount[id];
        uint256 lpSupply = lpToken.totalSupply();
        // Ignore pending mintFee as it is insignificant

        // 2. Get the pool's total supply of token0 and token1.
        (uint256 ra, uint256 rb,) = lpToken.getReserves();

        if (borrowTokens[0] == token1 ||
            (borrowTokens[0] == address(0) && token1 == wBNB))
        {
            // If reverse
            (ra, rb) = (rb, ra);
        }
        // 3. Convert the position's LP tokens to the underlying assets.
        uint256 na = lpBalance.mul(ra).div(lpSupply);
        uint256 nb = lpBalance.mul(rb).div(lpSupply);
        ra = ra.sub(na);
        rb = rb.sub(nb);

        // 4. Get the amount after swaped
        uint256 da = debts[0];
        uint256 db = debts[1];

        // na/da > nb/db, swap A to B
        if (na.mul(db) > nb.mul(da).add(1e25)) {
            uint256 amount = _swapAToBWithDebtsRatio(ra, rb, da, db, na, nb);
            amount = amount > na ? na : amount;
            na = na.sub(amount);
            nb = nb.add(_getMktSellAmount(amount, ra, rb));
        }

        // na/da < nb/db, swap B to A
        else if (na.mul(db).add(1e25) < nb.mul(da)) {
            uint256 amount = _swapAToBWithDebtsRatio(rb, ra, db, da, nb, na);
            amount = amount > nb ? nb : amount;
            na = na.add(_getMktSellAmount(amount, rb, ra));
            nb = nb.sub(amount);
        }

        // 5. Return the amount after swaping according to the debts ratio
        return [na, nb];
    }

    /**
     * @dev Return the left rate of the principal. need to divide to 10000, 100 means 1%
     * @param id The position ID to perform loss rate check.
     * @param borrowTokens Address of two tokens this position had debt.
     * @param debts Debts of two tokens.
     */
    function newHealth(
        uint256 id,
        address[2] calldata borrowTokens,
        uint256[2] calldata debts
    ) external view override returns (uint256) {

        require(borrowTokens[0] == token0 ||
                borrowTokens[0] == token1 ||
                borrowTokens[0] == address(0), "borrowTokens[0] not token0 and token1");

        require(borrowTokens[1] == token0 ||
                borrowTokens[1] == token1 ||
                borrowTokens[1] == address(0), "borrowTokens[1] not token0 and token1");

        uint256[2] storage N = principal[id];

        if (N[0] > 0 || N[1] > 0) {
            // Get the position's LP balance and LP total supply.
            uint256 lpBalance = posLPAmount[id];
            uint256 lpSupply = lpToken.totalSupply();
            // Ignore pending mintFee as it is insignificant

            // 2. Get the pool's total supply of token0 and token1.
            (uint256 ra, uint256 rb,) = lpToken.getReserves();

            if (borrowTokens[0] == token1 ||
                (borrowTokens[0] == address(0) && token1 == wBNB))
            {
                // If reverse
                (ra, rb) = (rb, ra);
            }
            // 3. Convert the position's LP tokens to the underlying assets.
            uint256 na = lpBalance.mul(ra).div(lpSupply);
            uint256 nb = lpBalance.mul(rb).div(lpSupply);
            ra = ra.sub(na);
            rb = rb.sub(nb);

            // 4. Get the health
            if (N[0] > 0) {
                // token 0 is the standard coin.
                uint256 leftA = _repayDeptsAndSwapLeftToA(ra, rb, debts[0], debts[1], na, nb);
                return leftA.mul(10000).div(N[0]);
            } else {
                // token 1 is the standard coin.
                uint256 leftB = _repayDeptsAndSwapLeftToA(rb, ra, debts[1], debts[0], nb, na);
                return leftB.mul(10000).div(N[1]);
            }
        } else {
            // No principal, treat it as no loss.
            return uint256(10000);
        }
    }

    /// @return Earned DEMA amount.
    function userAmount(address account) public view override returns (uint256, uint256) {

        return (0, // Dex token earned amount
                farm.stakeEarnedPerPool(poolId, account));
    }

    /* ==================================== Write ==================================== */

    /// @dev Send DEMA rewards to user.
    function getAllRewards(address account) external override nonReentrant {
        farm.getStakeRewardsPerPool(poolId, account);
    }


    /**
     * @dev Work on the given position. Must be called by the operator.
     * @param id The position ID to work on.
     * @param account The original user that is interacting with the operator.
     * @param borrowTokens Address of two tokens user borrow from bank.
     * @param borrowAmount The amount of two borrow tokens.
     * @param debts The user's debts amount of two tokens.
     * @param data The encoded data, consisting of strategy address and bytes to strategy.
     */
    function work(
        uint256 id,
        address account,
        address[2] calldata borrowTokens,
        uint256[2] calldata borrowAmount,
        uint256[2] calldata debts,
        bytes calldata data
    )
        external
        payable
        override
        onlyOperator
        nonReentrant
    {
        require(borrowTokens[0] != borrowTokens[1]);
        require(borrowTokens[0] == token0 || borrowTokens[0] == token1 || borrowTokens[0] == address(0), "borrowTokens not token0 and token1");
        require(borrowTokens[1] == token0 || borrowTokens[1] == token1 || borrowTokens[1] == address(0), "borrowTokens not token0 and token1");

        TempParams memory temp;     // Just in case stack too deep.
        // 1. Convert this position back to LP tokens.
        temp.beforeLPAmount = posLPAmount[id];
        _removePosition(id, account);

        // 2. Perform the worker strategy; sending LP tokens + borrowTokens; expecting LP tokens.
        (address strategy, bytes memory ext) = abi.decode(data, (address, bytes));
        require(strategiesOk[strategy], "unapproved work strategy");

        if (lpToken.balanceOf(address(this)) > 0) {
            lpToken.transfer(strategy, lpToken.balanceOf(address(this)));
        }

        for (uint256 i = 0; i < 2; ++i) {
            // transfer the borrow token.
            if (borrowAmount[i] > 0 && borrowTokens[i] != address(0)) {
                borrowTokens[i].safeTransferFrom(msg.sender, address(this), borrowAmount[i]);

                borrowTokens[i].safeApprove(address(strategy), 0);
                borrowTokens[i].safeApprove(address(strategy), uint256(-1));
            }
        }

        // -------------------------- execute --------------------------
        // strategy will send back all token and LP.
        uint256[2] memory deltaN = IStrategy(strategy).execute{value: msg.value}(
            account, borrowTokens, borrowAmount, debts, ext);

        _addPosition(id, account);


        // Handle stake reward.
        temp.afterLPAmount = posLPAmount[id];

        // 4. Update stored info after withdraw or deposit.

        // If withdraw some LP.
        if (temp.beforeLPAmount > temp.afterLPAmount) {
            temp.deltaAmount = temp.beforeLPAmount.sub(temp.afterLPAmount);
            farm.withdraw(poolId, account, temp.deltaAmount);

            (/* token0 */, /* token1 */, uint256 rate, uint256 whichWantBack) =
                abi.decode(ext, (address, address, uint256, uint256));

            // If it is repay, don't update principle.
            if (whichWantBack < 3) {
                _updatePrinciple(id, true, borrowTokens, deltaN, rate);
            }
        }
        // If depoist some LP.
        else if (temp.beforeLPAmount < temp.afterLPAmount) {
            temp.deltaAmount = temp.afterLPAmount.sub(temp.beforeLPAmount);
            farm.stake(poolId, account, temp.deltaAmount);
            _updatePrinciple(id, false, borrowTokens, deltaN, 0);
        }

        // 5. Send tokens back.
        for (uint256 i = 0; i < 2; ++i) {
            if (borrowTokens[i] == address(0)) {
                uint256 borrowTokenAmount = address(this).balance;
                if (borrowTokenAmount > 0) {
                    SafeToken.safeTransferETH(msg.sender, borrowTokenAmount);
                }
            } else {
                uint256 borrowTokenAmount = borrowTokens[i].myBalance();
                if(borrowTokenAmount > 0) {
                    SafeToken.safeTransfer(borrowTokens[i], msg.sender, borrowTokenAmount);
                }
            }
        }
    }

    /**
     * @dev Liquidate the given position by converting it to debtToken and return back to caller.
     * @param id The position ID to perform liquidation.
     * @param account The address than this position belong to.
     * @param borrowTokens Two tokens address user borrow from bank.
     * @param debts Two tokens debts.
     */
    function liquidate(
        uint256 id,
        address account,
        address[2] calldata borrowTokens,
        uint256[2] calldata debts
    )
        external
        override
        onlyOperator
        nonReentrant
    {
        require(borrowTokens[0] == token0 ||
                borrowTokens[0] == token1 ||
                borrowTokens[0] == address(0), "borrowTokens[0] not token0 and token1");

        require(borrowTokens[1] == token0 ||
                borrowTokens[1] == token1 ||
                borrowTokens[1] == address(0), "borrowTokens[1] not token0 and token1");


        // 1. Convert the position back to LP tokens and use liquidate strategy.
        farm.withdraw(poolId, account, posLPAmount[id]);
        _removePosition(id, account);
        uint256 lpTokenAmount = lpToken.balanceOf(address(this));
        lpToken.transfer(address(liqStrategy), lpTokenAmount);

        // address token0, address token1, uint256 rate, uint256 whichWantBack
        liqStrategy.execute(address(this), borrowTokens, uint256[2]([uint256(0), uint256(0)]), debts, abi.encode(
            lpToken.token0(), lpToken.token1(), 10000, 2));



        // 2. transfer borrowTokens and user want back to bank.
        uint256[2] memory tokensLiquidate;
        for (uint256 i = 0; i < 2; ++i) {
            if (borrowTokens[i] == address(0)) {
                tokensLiquidate[i] = address(this).balance;
                if (tokensLiquidate[i] > 0) {
                    SafeToken.safeTransferETH(msg.sender, tokensLiquidate[i]);
                }
            } else {
                tokensLiquidate[i] = borrowTokens[i].myBalance();
                if (tokensLiquidate[i] > 0) {
                    borrowTokens[i].safeTransfer(msg.sender, tokensLiquidate[i]);
                }
            }

            // Clear principal
            principal[id][i] = 0;
        }

        emit Liquidate(id, address(lpToken), lpTokenAmount, borrowTokens, tokensLiquidate);
    }

    /* ==================================== Internal ==================================== */

    // ------------------ The following are virtual function ------------------

    function _WBNB(address _router) internal view virtual returns (address);


    /**
     * @dev Return maximum output given the input amount and the status of Uniswap reserves.
     * @param aIn The amount of asset to market sell.
     * @param rIn the amount of asset in reserve for input.
     * @param rOut The amount of asset in reserve for output.
     */
    function _getMktSellAmount(uint256 aIn, uint256 rIn, uint256 rOut) internal pure virtual returns (uint256);

    /**
     * @dev Return minmum input given the output amount and the status of Uniswap reserves.
     * @param aOut The output amount of asset after market sell.
     * @param rIn the amount of asset in reserve for input.
     * @param rOut The amount of asset in reserve for output.
     */
    function _getMktSellInAmount(uint256 aOut, uint256 rIn, uint256 rOut) internal pure virtual returns (uint256);

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
    ) internal pure virtual returns (uint256);

    // ------------------------------------------------------------------------

    function _updatePrinciple(
        uint256 id,
        bool isWithdraw,
        address[2] calldata borrowTokens,
        uint256[2] memory deltaN,     // Only used for deposit
        uint256 rate    // Only used for withdraw
    ) 
        internal 
    {
        // Update principal.
        uint256[2] storage N = principal[id];
        (uint256 ra, uint256 rb,) = lpToken.getReserves();

        if (borrowTokens[0] == token1 || (borrowTokens[0] == address(0) && token1 == wBNB)) {
            // If reverse
            (ra, rb) = (rb, ra);
        }

        // If withdraw some LP.
        if (isWithdraw) {

            if (deltaN[0] > 0 || deltaN[1] > 0) {
                // Decrease some principal.
                if (N[0] > 0) {
                    if (rate < 10000) {
                        N[0] = N[0].mul(10000 - rate).div(10000);
                    } else {
                        N[0] = 1;   // Never return to 0
                    }
                } else {
                    // N[1] >= 0
                    if (rate < 10000) {
                        N[1] = N[1].mul(10000 - rate).div(10000);
                    } else {
                        N[1] = 1;   // Never return to 0
                    }
                }
            }
        }

        // If depoist some LP.
        else {

            if (N[0] == 0 && N[1] == 0) {
                // First time open the position, get the principal.
                // if deltaN[0] / deltaN[1] > ra / rb, that means token0 is worth more than token1.
                if (deltaN[0].mul(rb) > deltaN[1].mul(ra)) {
                    uint256 incN0 = _getMktSellAmount(deltaN[1], rb, ra);
                    N[0] = deltaN[0].add(incN0);
                } else {
                    uint256 incN1 = _getMktSellAmount(deltaN[0], ra, rb);
                    N[1] = deltaN[1].add(incN1);
                }
            } else {
                // Not the first time.
                if (deltaN[0] > 0 || deltaN[1] > 0){
                    // Increase some principal.
                    if (N[0] > 0) {
                        uint256 incN0 = _getMktSellAmount(deltaN[1], rb, ra);
                        N[0] = N[0].add(deltaN[0]).add(incN0);
                    } else {
                        // N[1] > 0
                        uint256 incN1 = _getMktSellAmount(deltaN[0], ra, rb);
                        N[1] = N[1].add(deltaN[1]).add(incN1);
                    }
                }
            }
        }
    }

    /**
     * @dev Return equivalent output given the input amount and the status of Uniswap reserves.
     * @param aIn The amount of asset to market sell.
     * @param rIn the amount of asset in reserve for input.
     * @param rOut The amount of asset in reserve for output.
     */
    function _getEqAmount(uint256 aIn, uint256 rIn, uint256 rOut) internal pure returns (uint256) {
        require(rIn > 0 && rOut > 0, "bad reserve values");
        return aIn.mul(rOut).div(rIn);
    }

    /// @dev Internal function to stake all outstanding LP tokens to the given position ID.
    function _addPosition(uint256 id, address account) internal {
        uint256 lpBalance = lpToken.balanceOf(address(this));
        if (lpBalance > 0) {
            posLPAmount[id] = posLPAmount[id].add(lpBalance);
            globalLp = globalLp.add(lpBalance);
            userLp[account] = userLp[account].add(lpBalance);
            emit AddPosition(id, lpBalance);
        }
    }

    /// @dev Internal function to remove shares of the ID and convert to outstanding LP tokens.
    function _removePosition(uint256 id, address account) internal {
        uint256 lpAmount = posLPAmount[id];
        if (lpAmount > 0) {
            globalLp = globalLp.sub(lpAmount);
            userLp[account] = userLp[account].sub(lpAmount);
            posLPAmount[id] = 0;
            emit RemovePosition(id, lpAmount);
        }
    }

    /// @dev Return the left amount of A after repay all debts
    function _repayDeptsAndSwapLeftToA(
        uint256 ra,
        uint256 rb,
        uint256 da,
        uint256 db,
        uint256 na,
        uint256 nb
    ) internal pure returns(uint256) {

        if (nb > db) {
            // Swap B to A
            uint256 incA = _getMktSellAmount(nb-db, rb, ra);
            if (na.add(incA) > da) {
                na = na.add(incA).sub(da);
            } else {
                // The left amount is not enough to repay debts.
                na = 0;
            }

        // nb <= db, swap A to B
        } else {
            if (db-nb > rb) {
                // There are not enough token B in DEX, no left A.
                na = 0;
            }
            else {
                uint256 decA = _getMktSellInAmount(db-nb, ra, rb);
                if (na > da.add(decA)) {
                    na = na.sub(decA).sub(da);
                } else {
                    // The left amount is not enough to repay debts.
                    na = 0;
                }
            }
        }
        return na;
    }

    /* ==================================== Only owner ==================================== */

    /**
     * @dev Recover ERC20 tokens that were accidentally sent to this smart contract.
     * @param token The token contract. Can be anything. This contract should not hold ERC20 tokens.
     * @param to The address to send the tokens to.
     * @param value The number of tokens to transfer to `to`.
     */
    function recover(address token, address to, uint256 value) external onlyOwner nonReentrant {
        require(token != address(lpToken), "Cannot recover lp token");
        if (token == address(0)) {
            SafeToken.safeTransferETH(to, value);
        } else {
            SafeToken.safeTransfer(token, to, value);
        }
    }

    /**
     * @dev Set the given strategies' approval status.
     * @param strategies The strategy addresses.
     * @param isOk Whether to approve or unapprove the given strategies.
     */
    function setStrategyOk(address[] calldata strategies, bool isOk) external onlyOwner {
        uint256 len = strategies.length;
        for (uint256 idx = 0; idx < len; idx++) {
            strategiesOk[strategies[idx]] = isOk;
        }
    }

    /**
     * @dev Update critical strategy smart contracts. EMERGENCY ONLY. Bad strategies can steal funds.
     * @param _liqStrategy The new liquidate strategy contract.
     */
    function setCriticalStrategies(IStrategy _liqStrategy) external onlyOwner {
        liqStrategy = _liqStrategy;
    }

    receive() external payable {}

}
