pragma solidity ^0.6.0;

// import "@openzeppelin/contracts/access/Ownable.sol";
// // import "@openzeppelin/contracts/math/Math.sol";
// import "@openzeppelin/contracts/math/SafeMath.sol";
// // import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// // import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// // import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
// // import "@openzeppelin/contracts/utils/Address.sol";
// // import "@openzeppelin/contracts/utils/EnumerableSet.sol";
// import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.3.0/contracts/access/Ownable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.3.0/contracts/math/SafeMath.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.3.0/contracts/utils/ReentrancyGuard.sol";

import "./Interface/IFarm.sol";
// import "./Interface/IReinvestment.sol";
import "./Interface/cakeInterface/IPancakeRouter02.sol";
import "./Interface/cakeInterface/IPancakeFactory.sol";
import "./Interface/cakeInterface/IPancakePair.sol";
import "./Interface/IGoblin.sol";
import "./Interface/IStrategy.sol";
import "./Interface/cakeInterface/IMasterChef.sol";

import "./utils/SafeToken.sol";
import "./utils/Math.sol";


contract CakeGoblin is Ownable, ReentrancyGuard, IGoblin {
    /// @notice Libraries
    using SafeToken for address;
    using SafeMath for uint256;

    /// @notice Events
    event AddPosition(uint256 indexed id, uint256 lpAmount);
    event RemovePosition(uint256 indexed id, uint256 lpAmount);
    event Liquidate(uint256 indexed id, address lpTokenAddress, uint256 lpAmount,
        address[2] debtToken, uint256[2] liqAmount);
    event StakedbscPool(address indexed user, uint256 amount);
    event WithdrawnbscPool(address indexed user, uint256 amount);

    /// @notice Immutable variables
    IFarm public farm;
    uint256 public poolId;
    // IReinvestment reinvestment;

    IMasterChef public bscPool;
    uint256 public bscPoolId;

    IPancakePair public lpToken;
    address public cake;
    address public wBNB;
    address public token0;      // lpToken.token0(), Won't be 0
    address public token1;      // lpToken.token1(), Won't be 0
    address public operator;    // Bank

    /// @notice Mutable state variables
    struct GlobalInfo {
        uint256 totalLp;        // Total staked lp amount.
        uint256 totalCake;       // Total Mdx amount that already staked to board room.
        uint256 accCakePerLp;    // Accumulate cake rewards amount per lp token.
        uint256 lastUpdateTime;
    }

    struct UserInfo {
        uint256 totalLp;            // Total Lp amount.
        uint256 earnedMdxStored;    // Earned cake amount stored at the last time user info was updated.
        uint256 accMdxPerLpStored;  // The accCakePerLp at the last time user info was updated.
        uint256 lastUpdateTime;
    }

    GlobalInfo public globalInfo;
    mapping(address => UserInfo) public userInfo;
    mapping(uint256 => uint256) public override posLPAmount;

    // Principal of each tokens in each pos. Same order with borrow tokens
    mapping(uint256 => uint256[2]) public principal;
    mapping(address => bool) public strategiesOk;
    IStrategy public liqStrategy;

    /// @notice temp params
    struct TempParams {
        uint256 beforeLPAmount;
        uint256 afterLPAmount;
        uint256 returnMdxAmount;
        uint256 deltaAmount;
    }

    constructor(
        address _operator,              // Bank
        IFarm _farm,                    // Farm
        uint256 _poolId,                // Farm pool id
        // IReinvestment _reinvestment,    // Mdx reinvestment
        IMasterChef _bscPool,
        uint256 _bscPoolId,
        IPancakeRouter02 _router,
        address _mdx,
        address _token0,
        address _token1,
        IStrategy _liqStrategy
    ) public {
        operator = _operator;
        wBNB = _router.WETH();
        farm = _farm;
        poolId  = _poolId;
        // reinvestment = _reinvestment;

        // MDX related params.
        bscPool = _bscPool;
        bscPoolId  = _bscPoolId;
        cake = _mdx;
        IPancakeFactory factory = IPancakeFactory(_router.factory());

        _token0 = _token0 == address(0) ? wBNB : _token0;
        _token1 = _token1 == address(0) ? wBNB : _token1;

        lpToken = IPancakePair(factory.getPair(_token0, _token1));
        require(address(lpToken) != address(0), 'Pair not exit');
        // May switch the order of tokens
        token0 = lpToken.token0();
        token1 = lpToken.token1();

        liqStrategy = _liqStrategy;
        strategiesOk[address(liqStrategy)] = true;

        // 100% trust in the bsc pool
        lpToken.approve(address(bscPool), uint256(-1));
        // cake.safeApprove(address(reinvestment), uint256(-1));
    }

    /// @dev Require that the caller must be the operator (the bank).
    modifier onlyOperator() {
        require(msg.sender == operator, "not operator");
        _;
    }

    /* ==================================== Read ==================================== */

    /**
     * @dev Return equivalent output given the input amount and the status of Uniswap reserves.
     * @param aIn The amount of asset to market sell.
     * @param rIn the amount of asset in reserve for input.
     * @param rOut The amount of asset in reserve for output.
     */
    function getEqAmount(uint256 aIn, uint256 rIn, uint256 rOut) public pure returns (uint256) {
        if (aIn == 0) return 0;
        require(rIn > 0 && rOut > 0, "bad reserve values");
        return rIn.mul(rOut).div(aIn);
    }
    /**
     * @dev Return maximum output given the input amount and the status of Uniswap reserves.
     * @param aIn The amount of asset to market sell.
     * @param rIn the amount of asset in reserve for input.
     * @param rOut The amount of asset in reserve for output.
     */
    function getMktSellAmount(uint256 aIn, uint256 rIn, uint256 rOut) public pure returns (uint256) {
        if (aIn == 0) return 0;
        require(rIn > 0 && rOut > 0, "bad reserve values");
        uint256 aInWithFee = aIn.mul(997);
        uint256 numerator = aInWithFee.mul(rOut);
        uint256 denominator = rIn.mul(1000).add(aInWithFee);
        return numerator.div(denominator);
    }

    /**
     * @dev Return minmum input given the output amount and the status of Uniswap reserves.
     * @param aOut The output amount of asset after market sell.
     * @param rIn the amount of asset in reserve for input.
     * @param rOut The amount of asset in reserve for output.
     */
    function getMktSellInAmount(uint256 aOut, uint256 rIn, uint256 rOut) public pure returns (uint256) {
        if (aOut == 0) return 0;
        require(rIn > 0, "Get sell in amount, rIn must > 0");
        require(rOut > aOut, "Get sell in amount, rOut must > aOut");
        uint256 numerator = rIn.mul(aOut).mul(1000);
        uint256 denominator = rOut.sub(aOut).mul(997);
        return numerator.div(denominator);
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
            nb = nb.add(getMktSellAmount(amount, ra, rb));
        }

        // na/da < nb/db, swap B to A
        else if (na.mul(db).add(1e25) < nb.mul(da)) {
            uint256 amount = _swapAToBWithDebtsRatio(rb, ra, db, da, nb, na);
            amount = amount > nb ? nb : amount;
            na = na.add(getMktSellAmount(amount, rb, ra));
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

        // 1. Get the position's LP balance and LP total supply.
        uint256 lpBalance = posLPAmount[id];
        uint256[2] storage N = principal[id];

        if (N[0] > 0 || N[1] > 0) {
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

    /// @dev total Mdx rewards can be withdrawn.
    function totalRewards() public view returns (uint256) {
        uint256 poolPendingMdx= bscPool.pendingCake(bscPoolId, address(this));

        // uint256 reservedRatio = reinvestment.reservedRatio();
        // If reserved some rewards
        // if (reservedRatio != 0) {
        //     // And then div the left share ratio.
        //     poolPendingMdx = poolPendingMdx.sub(poolPendingMdx.mul(reservedRatio).div(10000));
        // }

        // return poolPendingMdx.add(reinvestment.userEarnedAmount(address(this)));
        return poolPendingMdx;
    }

    function rewardPerLp() public view  returns (uint256) {
        if (globalInfo.totalLp != 0) {
            // globalInfo.totalCake is the cake amount at the last time update.
            return (totalRewards().sub(globalInfo.totalCake)).mul(1e18).div(
                globalInfo.totalLp).add(globalInfo.accCakePerLp);
        } else {
            return globalInfo.accCakePerLp;
        }
    }

    /// @return Earned MDX and DEMA amount.
    function userEarnedAmount(address account) public view override returns (uint256, uint256) {
        UserInfo storage user = userInfo[account];

        return (user.totalLp.mul(rewardPerLp().sub(user.accMdxPerLpStored)).div(1e18).add(user.earnedMdxStored),
                farm.stakeEarnedPerPool(poolId, account));
    }

    /* ==================================== Write ==================================== */

    /// @dev Send both MDX and DEMA rewards to user.
    function getAllRewards(address account) public override {
        _updatePool(account);
        UserInfo storage user = userInfo[account];

        // Send MDX
        if (user.earnedMdxStored > 0) {
            // reinvestment.withdraw(user.earnedMdxStored);    // TODO This may be not correct
            cake.safeTransfer(account, user.earnedMdxStored);
            globalInfo.totalCake = globalInfo.totalCake.sub(user.earnedMdxStored);
            user.earnedMdxStored = 0;
        }

        // Send DEMA
        farm.getStakeRewardsPerPool(poolId, account);
    }


    /**
     * @dev Work on the given position. Must be called by the operator.
     * @param id The position ID to work on.
     * @param account The original user that is interacting with the operator.
     * @param borrowTokens Address of two tokens user borrow from bank.
     * @param borrowAmounts The amount of two borrow tokens.
     * @param debts The user's debts amount of two tokens.
     * @param data The encoded data, consisting of strategy address and bytes to strategy.
     */
    function work(
        uint256 id,
        address account,
        address[2] calldata borrowTokens,
        uint256[2] calldata borrowAmounts,
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

        _updatePool(account);

        // 1. Convert this position back to LP tokens.
        temp.beforeLPAmount = posLPAmount[id];
        _removePosition(id, account);

        // 2. Perform the worker strategy; sending LP tokens + borrowTokens; expecting LP tokens.
        (address strategy, bytes memory ext) = abi.decode(data, (address, bytes));
        require(strategiesOk[strategy], "unapproved work strategy");

        lpToken.transfer(strategy, lpToken.balanceOf(address(this)));

        for (uint256 i = 0; i < 2; ++i) {
            // transfer the borrow token.
            if (borrowAmounts[i] > 0 && borrowTokens[i] != address(0)) {
                borrowTokens[i].safeTransferFrom(msg.sender, address(this), borrowAmounts[i]);

                borrowTokens[i].safeApprove(address(strategy), 0);
                borrowTokens[i].safeApprove(address(strategy), uint256(-1));
            }
        }

        temp.returnMdxAmount = cake.myBalance();  // Now is cake balance before execute

        // -------------------------- execute --------------------------
        // strategy will send back all token and LP.
        uint256[2] memory deltaN = IStrategy(strategy).execute{value: msg.value}(
            account, borrowTokens, borrowAmounts, debts, ext);

        if (cake.myBalance() > temp.returnMdxAmount) {
            // There are return cake, that means it's a withdraw
            temp.returnMdxAmount = cake.myBalance() - temp.returnMdxAmount;
        } else {
            // No return or Mdx amount decrease which means it's an add.
            temp.returnMdxAmount = 0;
        }

        // 3. Add LP tokens back to the bsc pool.
        _addPosition(id, account);

        // Send cake to reinvestment.
        // reinvestment.deposit(cake.myBalance().sub(temp.returnMdxAmount));

        // Handle stake reward.
        temp.afterLPAmount = posLPAmount[id];

        // Update principal.
        uint256[2] storage N = principal[id];
        (uint256 ra, uint256 rb,) = lpToken.getReserves();

        if (borrowTokens[0] == token1 || (borrowTokens[0] == address(0) && token1 == wBNB)){
            // If reverse
            (ra, rb) = (rb, ra);
        }

        // 4. Update stored info after withdraw or deposit.

        // If withdraw some LP.
        if (temp.beforeLPAmount > temp.afterLPAmount) {
            temp.deltaAmount = temp.beforeLPAmount.sub(temp.afterLPAmount);
            farm.withdraw(poolId, account, temp.deltaAmount);

            if (deltaN[0] > 0 || deltaN[1] > 0){
                // Decrease some principal.
                if (N[0] > 0) {
                    uint256 decN0 = getEqAmount(deltaN[1], ra, rb);
                    if (N[0] > deltaN[0].add(decN0)) {
                        N[0] = N[0].sub(deltaN[0]).sub(decN0);
                    } else {
                        N[0] = 1;   // Never return to 0
                    }
                } else {
                    // N[1] >= 0
                    uint256 decN1 = getEqAmount(deltaN[0], rb, ra);
                    if (N[1] > deltaN[1].add(decN1)) {
                        N[1] = N[1].sub(deltaN[1]).sub(decN1);
                    } else {
                        N[1] = 1;   // Never return to 0
                    }
                }
            }
        }

        // If depoist some LP.
        else if (temp.beforeLPAmount < temp.afterLPAmount) {
            temp.deltaAmount = temp.afterLPAmount.sub(temp.beforeLPAmount);
            farm.stake(poolId, account, temp.deltaAmount);

            if (N[0] == 0 && N[1] == 0) {
                // First time open the position, get the principal.
                // if deltaN[0] / deltaN[1] > ra / rb, that means token0 is worth more than token1.
                if (deltaN[0].mul(rb) > deltaN[1].mul(ra)) {
                    uint256 incN0 = getMktSellAmount(deltaN[1], rb, ra);
                    N[0] = deltaN[0].add(incN0);
                } else {
                    uint256 incN1 = getMktSellAmount(deltaN[0], ra, rb);
                    N[1] = deltaN[1].add(incN1);
                }
            } else {
                // Not the first time.
                if (deltaN[0] > 0 || deltaN[1] > 0){
                    // Increase some principal.
                    if (N[0] > 0) {
                        uint256 incN0 = getMktSellAmount(deltaN[1], rb, ra);
                        N[0] = N[0].add(deltaN[0]).add(incN0);
                    } else {
                        // N[1] > 0
                        uint256 incN1 = getMktSellAmount(deltaN[0], ra, rb);
                        N[1] = N[1].add(deltaN[1]).add(incN1);
                    }
                }
            }
        }

        // 5. Send tokens back.
        for (uint256 i = 0; i < 2; ++i) {
            if (borrowTokens[i] == address(0)) {
                SafeToken.safeTransferETH(msg.sender, address(this).balance);
            } else {
                uint256 borrowTokenAmount = borrowTokens[i].myBalance();
                if(borrowTokenAmount > 0){
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


        _updatePool(account);

        // 1. Convert the position back to LP tokens and use liquidate strategy.
        farm.withdraw(poolId, account, posLPAmount[id]);
        _removePosition(id, account);
        uint256 lpTokenAmount = lpToken.balanceOf(address(this));
        lpToken.transfer(address(liqStrategy), lpTokenAmount);

        uint256 returnMdxAmount = cake.myBalance();  // Now is cake balance before execute

        // address token0, address token1, uint256 rate, uint256 whichWantBack
        liqStrategy.execute(address(this), borrowTokens, uint256[2]([uint256(0), uint256(0)]), debts, abi.encode(
            lpToken.token0(), lpToken.token1(), 10000, 2));

        if (cake.myBalance() > returnMdxAmount) {
            // There are return cake, that means it's a withdraw
            returnMdxAmount = cake.myBalance() - returnMdxAmount;
        } else {
            // No return or Mdx amount decrease which means it's an add.
            returnMdxAmount = 0;
        }

        // Send cake to reinvestment.
        // reinvestment.deposit(cake.myBalance().sub(returnMdxAmount));

        // 2. transfer borrowTokens and user want back to bank.
        uint256[2] memory tokensLiquidate;
        for (uint256 i = 0; i < 2; ++i) {
            if (borrowTokens[i] == address(0)) {
                tokensLiquidate[i] = address(this).balance;
                SafeToken.safeTransferETH(msg.sender, tokensLiquidate[i]);
            } else {
                tokensLiquidate[i] = borrowTokens[i].myBalance();
                borrowTokens[i].safeTransfer(msg.sender, tokensLiquidate[i]);
            }

            // Clear principal
            principal[id][i] = 0;
        }

        emit Liquidate(id, address(lpToken), lpTokenAmount, borrowTokens, tokensLiquidate);
    }

    /* ==================================== Internal ==================================== */

    /// @dev Internal function to stake all outstanding LP tokens to the given position ID.
    function _addPosition(uint256 id, address account) internal {
        uint256 lpBalance = lpToken.balanceOf(address(this));
        if (lpBalance > 0) {
            UserInfo storage user = userInfo[account];
            // take lpToken to the pool2.
            bscPool.deposit(bscPoolId, lpBalance);
            posLPAmount[id] = posLPAmount[id].add(lpBalance);
            globalInfo.totalLp = globalInfo.totalLp.add(lpBalance);
            user.totalLp = user.totalLp.add(lpBalance);
            emit AddPosition(id, lpBalance);
        }
    }

    /// @dev Internal function to remove shares of the ID and convert to outstanding LP tokens.
    function _removePosition(uint256 id, address account) internal {
        uint256 lpAmount = posLPAmount[id];
        if (lpAmount > 0) {
            UserInfo storage user = userInfo[account];
            bscPool.withdraw(bscPoolId, lpAmount);
            globalInfo.totalLp = globalInfo.totalLp.sub(lpAmount);
            user.totalLp = user.totalLp.sub(lpAmount);
            posLPAmount[id] = 0;
            emit RemovePosition(id, lpAmount);
        }
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
    ) internal pure returns (uint256) {
        // This can also help to make sure db != 0
        require(na.mul(db) > nb.mul(da), "na/da should lager than nb/db");

        if (da == 0) {
            return na;
        }

        uint256 part1 = na.sub(nb.mul(da).div(db));
        uint256 part2 = ra.mul(1000).div(997);
        uint256 part3 = da.mul(rb).div(db);

        uint256 b = part2.add(part3).sub(part1);
        uint256 nc = part1.mul(part2);

        // (-b + math.sqrt(b * b + 4 * nc)) / 2
        // Note that nc = - c
        return Math.sqrt(b.mul(b).add(nc.mul(4))).sub(b).div(2);
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
            uint256 incA = getMktSellAmount(nb-db, rb, ra);
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
                uint256 decA = getMktSellInAmount(db-nb, ra, rb);
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

    /// @dev update pool info and user info.
    function _updatePool(address account) internal {
        // Check last update first.
        if (globalInfo.lastUpdateTime != block.timestamp) {
            /// @notice MUST update accCakePerLp first as it will use the old totalCake
            globalInfo.accCakePerLp = rewardPerLp();
            globalInfo.totalCake = totalRewards();
            globalInfo.lastUpdateTime = block.timestamp;
        }

        UserInfo storage user = userInfo[account];
        if (account != address(0) && user.lastUpdateTime != block.timestamp) {
            user.earnedMdxStored = user.totalLp.mul(globalInfo.accCakePerLp.sub(user.accMdxPerLpStored)
                ).div(1e18).add(user.earnedMdxStored);
            user.accMdxPerLpStored = globalInfo.accCakePerLp;
            user.lastUpdateTime = block.timestamp;
        }
    }

    /* ==================================== Only owner ==================================== */

    /**
     * @dev Recover ERC20 tokens that were accidentally sent to this smart contract.
     * @param token The token contract. Can be anything. This contract should not hold ERC20 tokens.
     * @param to The address to send the tokens to.
     * @param value The number of tokens to transfer to `to`.
     */
    function recover(address token, address to, uint256 value) external onlyOwner nonReentrant {
        token.safeTransfer(to, value);
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
