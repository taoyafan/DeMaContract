pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
// import "@openzeppelin/contracts/utils/Address.sol";
// import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./Interface/IFarm.sol";
import "./Interface/IReinvestment.sol";
import "./Interface/IMdexRouter.sol";
import "./Interface/IMdexFactory.sol";
import "./Interface/IMdexPair.sol";
import "./Interface/IGoblin.sol";
import "./Interface/IStrategy.sol";
import "./Interface/IBSCPool.sol";

import "./utils/SafeToken.sol";
import "./utils/Math.sol";


contract MdxGoblin is Ownable, ReentrancyGuard, IGoblin {
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
    IReinvestment reinvestment;

    IBSCPool public bscPool;
    uint256 public bscPoolId;

    IMdexPair public lpToken;
    address public mdx;
    address public wBNB;
    address public token0;      // lpToken.token0(), Won't be 0
    address public token1;      // lpToken.token1(), Won't be 0
    address public operator;    // Bank

    /// @notice Mutable state variables
    struct GlobalInfo {
        uint256 totalLp;        // Total staked lp amount.
        uint256 totalMdx;       // Total Mdx amount that already staked to board room.
        uint256 accMdxPerLp;    // Accumulate mdx rewards amount per lp token.
        uint256 lastUpdateTime;
    }

    struct UserInfo {
        uint256 totalLp;            // Total Lp amount.
        uint256 earnedMdxStored;    // Earned mdx amount stored at the last time user info was updated.
        uint256 accMdxPerLpStored;  // The accMdxPerLp at the last time user info was updated.
    }

    GlobalInfo public globalInfo;
    mapping(address => UserInfo) userInfo;
    mapping(uint256 => uint256) public posLPAmount;
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
        IFarm _farm,                    // Farm
        uint256 _poolId,                // Farm pool id
        IReinvestment _reinvestment,    // Mdx reinvestment
        IBSCPool _bscPool,
        uint256 _bscPoolId,
        IMdexRouter _router,
        address _mdx,
        address _token0,
        address _token1,
        IStrategy _liqStrategy
    ) public {
        operator = _operator;
        wBNB = _router.WBNB();
        farm = _farm;
        poolId  = _poolId;
        reinvestment = _reinvestment;

        // MDX related params.
        bscPool = _bscPool;
        bscPoolId  = _bscPoolId;
        mdx = _mdx;
        IMdexFactory factory = IMdexFactory(_router.factory());

        _token0 = _token0 == address(0) ? wBNB : _token0;
        _token1 = _token1 == address(0) ? wBNB : _token1;

        lpToken = IMdexPair(factory.getPair(_token0, _token1));
        // May switch the order of tokens
        token0 = lpToken.token0();
        token1 = lpToken.token1();

        liqStrategy = _liqStrategy;
        strategiesOk[address(liqStrategy)] = true;

        // 100% trust in the bsc pool
        lpToken.approve(address(bscPool), uint256(-1));
        mdx.safeApprove(address(reinvestment), uint256(-1));
    }

    /// @dev Require that the caller must be the operator (the bank).
    modifier onlyOperator() {
        require(msg.sender == operator, "not operator");
        _;
    }

    /* ==================================== Read ==================================== */

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
        return numerator / denominator;
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

        // 3. Convert the position's LP tokens to the underlying assets.
        uint256 na = lpBalance.mul(ra).div(lpSupply);
        uint256 nb = lpBalance.mul(rb).div(lpSupply);
        ra = ra.sub(na);
        rb = rb.sub(nb);

        // 4. Convert debts with the order of token0 and token1
        bool reversed = false;
        uint256 da;
        uint256 db;
        if (borrowTokens[0] == token0 ||
            (borrowTokens[0] == address(0) && token0 == wBNB))
        {
            da = debts[0];
            db = debts[1];
        } else {
            reversed = true;
            da = debts[1];
            db = debts[0];
        }

        // 5. Get the amount after swaped

        // na/da > nb/db, swap A to B
        if (na.mul(db) > nb.mul(da)) {
            uint256 amount = _swapAToBWithDebtsRatio(ra, rb, da, db, na, nb);
            amount = amount > na ? na : amount;
            na = na.sub(amount);
            nb = nb.add(getMktSellAmount(amount, ra, rb));
        }

        // na/da < nb/db, swap B to A
        else if (na.mul(db) < nb.mul(da)) {
            uint256 amount = _swapAToBWithDebtsRatio(rb, ra, db, da, nb, na);
            amount = amount > nb ? nb : amount;
            na = na.add(getMktSellAmount(amount, rb, ra));
            nb = nb.sub(amount);
        }

        // 6. Return the amount after swaping according to the debts ratio
        if (reversed == false) {
            return [na, nb];
        } else {
            return [nb, na];
        }
    }

    /// @dev total Mdx rewards can be withdrawn.
    function totalRewards() public view returns (uint256) {
        (uint256 poolPendingMdx, /* poolPendingLp */) = bscPool.pending(bscPoolId, address(this));

        uint256 reservedRatio = reinvestment.reservedRatio();
        // If reserved some rewards
        if (reservedRatio != 0) {
            // And then div the left share ratio.
            poolPendingMdx.mul(uint256(10000).sub(reservedRatio)).div(10000);
        }

        return poolPendingMdx.add(reinvestment.userEarnedAmount(address(this)));
    }

    function rewardPerLp() public view  returns (uint256) {
        if (globalInfo.totalLp != 0) {
            // globalInfo.totalMdx is the mdx amount at the last time update.
            return (totalRewards().sub(globalInfo.totalMdx)).div(
                globalInfo.totalLp).add(globalInfo.accMdxPerLp);
        } else {
            return globalInfo.accMdxPerLp;
        }
    }

    /// @return Earned MDX amount and DEMA amount.
    function userEarnedAmount(address account) public view  returns (uint256, uint256) {
        UserInfo storage user = userInfo[account];
        return user.totalLp.mul(rewardPerLp().sub(user.accMdxPerLpStored)).add(user.earnedMdxStored),
               farm.earnedPerPool(poolId, account);
    }

    /* ==================================== Write ==================================== */

    /// @dev Send both MDX and DEMA rewards to user.
    function getAllRewards(address account) public override {
        _updatePool(account);
        UserInfo storage user = userInfo[account];

        // Send MDX
        if (user.earnedMdxStored > 0) {
            reinvestment.withdraw(user.earnedMdxStored);
            mdx.safeTransfer(account, user.earnedMdxStored);
            globalInfo.totalMdx = globalInfo.totalMdx.sub(user.earnedMdxStored);
            user.earnedMdxStored = 0;
        }

        // Send DEMA
        farm.getRewardsPerPool(poolId, account);
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
        // strategy will send back all token and LP.
        IStrategy(strategy).execute{value: msg.value}(account, borrowTokens, borrowAmounts, debts, ext);

        // 3. Add LP tokens back to the bsc pool.
        _addPosition(id, account);

        // Send mdx to reinvestment.
        reinvestment.deposit(mdx.myBalance());

        // Handle stake reward.
        temp.afterLPAmount = posLPAmount[id];

        // If withdraw some LP.
        if (temp.beforeLPAmount > temp.afterLPAmount) {
            temp.deltaAmount = temp.beforeLPAmount.sub(temp.afterLPAmount);
            farm.withdraw(poolId, account, temp.deltaAmount);

        // If depoist some LP.
        } else if (temp.beforeLPAmount < temp.afterLPAmount) {
            temp.deltaAmount = temp.afterLPAmount.sub(temp.beforeLPAmount);
            farm.stake(poolId, account, temp.deltaAmount);
        }

        // Send tokens back.
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

        // address token0, address token1, uint256 rate, uint256 whichWantBack
        liqStrategy.execute(address(this), borrowTokens, uint256[2]([uint256(0), uint256(0)]), debts, abi.encode(
            lpToken.token0(), lpToken.token1(), 10000, 2));

        // Send mdx to reinvestment.
        reinvestment.deposit(mdx.myBalance());

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

        uint256 part1 = nb.mul(da).div(db).sub(na);
        uint256 part2 = ra.mul(1000).div(997);
        uint256 part3 = da.mul(rb).div(db);

        uint256 b = part1.add(part2).add(part3);
        uint256 c = part1.mul(part2);

        // (-b + math.sqrt(b * b - 4 * c)) / 2
        return Math.sqrt(b.mul(b).sub(c.mul(4))).sub(b).div(2);
    }

    /// @dev update pool info and user info.
    function _updatePool(address account) internal {
        // Check last update first.
        if (globalInfo.lastUpdateTime != block.timestamp) {
            /// @notice MUST update accMdxPerLp first as it will use the old totalMdx
            globalInfo.accMdxPerLp = rewardPerLp();
            globalInfo.totalMdx = totalRewards();
            globalInfo.lastUpdateTime = block.timestamp;

            if (account != address(0)) {
                UserInfo storage user = userInfo[account];
                user.earnedMdxStored = userEarnedAmount(account);
                user.accMdxPerLpStored = globalInfo.accMdxPerLp;
            }
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

}
