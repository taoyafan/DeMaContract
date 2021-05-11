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

import "./Interface/IStakingRewards.sol";
import "./Interface/IMdexRouter.sol";
import "./Interface/IMdexFactory.sol";
import "./Interface/IMdexPair.sol";
import "./Interface/IGoblin.sol";
import "./Interface/IStrategy.sol";
import "./Interface/IBSCPool.sol";
import "./utils/SafeToken.sol";


contract MdxGoblin is Ownable, ReentrancyGuard, IGoblin {
    /// @notice Libraries
    using SafeToken for address;
    using SafeMath for uint256;

    /// @notice Events
    event AddPosition(uint256 indexed id, uint256 lpAmount);
    event RemovePosition(uint256 indexed id, uint256 lpAmount);
    event Liquidate(uint256 indexed id, address lpTokenAddress, uint256 lpAmount, address debtToken, uint256 liqAmount);
    event StakedbscPool(address indexed user, uint256 amount);
    event WithdrawnbscPool(address indexed user, uint256 amount);

    /// @notice Immutable variables
    IStakingRewards public staking;
    uint256 public poolId;

    IBSCPool public bscPool;
    uint256 public bscPoolId;

    IMdexPair public lpToken;
    address public wBNB;
    address public token0;
    address public token1;
    address public operator;    // Bank

    /// @notice Mutable state variables
    mapping(uint256 => uint256) public posLPAmount;
    mapping(address => bool) public strategiesOk;
    uint256 public totalLPAmount;
    IStrategy public liqStrategy;

    constructor(
        address _operator,
        IStakingRewards _staking,
        uint256 _poolId,
        IMdexRouter _router,
        address _token0,
        address _token1,
        IStrategy _liqStrategy
    ) public {
        operator = _operator;
        wBNB = _router.WBNB();
        staking = _staking;
        poolId  = _poolId;
        IMdexFactory factory = IMdexFactory(_router.factory());

        _token0 = _token0 == address(0) ? wBNB : _token0;
        _token1 = _token1 == address(0) ? wBNB : _token1;

        lpToken = IMdexPair(factory.getPair(_token0, _token1));
        token0 = lpToken.token0();
        token1 = lpToken.token1();

        liqStrategy = _liqStrategy;
        strategiesOk[address(liqStrategy)] = true;

        // 100% trust in the staking pool
        lpToken.approve(address(_staking), uint256(-1));
    }

    /// @dev Require that the caller must be the operator (the bank).
    modifier onlyOperator() {
        require(msg.sender == operator, "not operator");
        _;
    }

    /* ========== Read ========== */

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
        bool isDebtBNB = borrowTokens == address(0);
        require(borrowTokens == token0 || borrowTokens == token1 || isDebtBNB, "borrowTokens not token0 and token1");

        // 1. Get the position's LP balance and LP total supply.
        uint256 lpBalance = posLPAmount[id];
        uint256 lpSupply = lpToken.totalSupply();
        // Ignore pending mintFee as it is insignificant
        // 2. Get the pool's total supply of token0 and token1.
        (uint256 totalAmount0, uint256 totalAmount1,) = lpToken.getReserves();

        // 3. Convert the position's LP tokens to the underlying assets.
        uint256 userToken0 = lpBalance.mul(totalAmount0).div(lpSupply);
        uint256 userToken1 = lpBalance.mul(totalAmount1).div(lpSupply);

        if (isDebtBNB) {
            borrowTokens = token0 == wBNB ? token0 : token1;
        }

        // 4. Convert all farming tokens to debtToken and return total amount.
        if (borrowTokens == token0) {
            return getMktSellAmount(
                userToken1, totalAmount1.sub(userToken1), totalAmount0.sub(userToken0)
            ).add(userToken0);
        } else {
            return getMktSellAmount(
                userToken0, totalAmount0.sub(userToken0), totalAmount1.sub(userToken1)
            ).add(userToken1);
        }
    }

    /* ========== Write ========== */


    /**
     * @dev Work on the given position. Must be called by the operator.
     * @param id The position ID to work on.
     * @param user The original user that is interacting with the operator.
     * @param inviter The inviter address.
     * @param canInvite Whether user can earn the invite reward.
     * @param borrowTokens Address of two tokens user borrow from bank.
     * @param borrowAmounts The amount of two borrow tokens.
     * @param debts The user's debts amount of two tokens.
     * @param data The encoded data, consisting of strategy address and bytes to strategy.
     */
    function work(
        uint256 id, 
        address user, 
        address inviter,
        bool canInvite,
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

        // 1. Convert this position back to LP tokens.
        uint256 beforeLPAmount = posLPAmount[id];
        _removePosition(id, user);

        // 2. Perform the worker strategy; sending LP tokens + borrowTokens; expecting LP tokens.
        (address strategy, bytes memory ext) = abi.decode(data, (address, bytes));
        require(strategiesOk[strategy], "unapproved work strategy");

        lpToken.transfer(strategy, lpToken.balanceOf(address(this)));

        uint256 i;
        for (i = 0; i < 2; ++i) {
            // transfer the borrow token.
            if (borrowAmounts[i] > 0 && borrowTokens[i] != address(0)) {
                borrowTokens[i].safeTransferFrom(msg.sender, address(this), borrowAmounts[i]);

                borrowTokens[i].safeApprove(address(strategy), 0);
                borrowTokens[i].safeApprove(address(strategy), uint256(-1));
            }
        }
        // strategy will send back all token and LP.
        IStrategy(strategy).execute{value: msg.value}(user, borrowTokens, borrowAmounts, debts, ext);

        // 3. Add LP tokens back to the farming pool.
        _addPosition(id, user);
        
        // Handle stake reward.
        if (beforeLPAmount > posLPAmount[id]) {
            // Withdraw some LP
            staking.withdraw(poolId, user, beforeLPAmount-posLPAmount[id], inviter);
        } else if (beforeLPAmount < posLPAmount[id]) {
            // Depoist some LP
            inviter = canInvite ? inviter : address(0);
            staking.stake(poolId, user, posLPAmount[id]-beforeLPAmount, inviter);
        }

        for (i = 0; i < 2; ++i) {
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
     * @param user The address than this position belong to.
     * @param inviter The address of inviter.
     * @param borrowTokens Two tokens address user borrow from bank.
     */
    function liquidate(
        uint256 id, 
        address user, 
        address inviter, 
        address[2] calldata borrowTokens
    )
        external
        override
        onlyOperator
        nonReentrant
    {
        bool isBorrowBNB = borrowTokens == address(0);
        require(borrowTokens == token0 || borrowTokens == token1 || isBorrowBNB, "borrowTokens not token0 and token1");

        // 1. Convert the position back to LP tokens and use liquidate strategy.
        staking.withdraw(poolId, user, posLPAmount[id], inviter);
        _removePosition(id, user);
        uint256 lpTokenAmount = lpToken.balanceOf(address(this));
        lpToken.transfer(address(liqStrategy), lpTokenAmount);
        liqStrategy.execute(address(0), borrowTokens, uint256(0), uint256(0), abi.encode(address(lpToken)));

        // 2. transfer borrowTokens and user want back to goblin.
        uint256 tokenLiquidate;
        if (isBorrowBNB){
            tokenLiquidate = address(this).balance;
            SafeToken.safeTransferETH(msg.sender, tokenLiquidate);
        } else {
            tokenLiquidate = borrowTokens.myBalance();
            borrowTokens.safeTransfer(msg.sender, tokenLiquidate);
        }

        emit Liquidate(id, address(lpToken), lpTokenAmount, borrowTokens, tokenLiquidate);
    }

    /* ========== Internal ========== */

    /// @dev Stake to MDX pool.
    function _stake(uint256 amount, address user) internal {
        if (address(bscPool) != address(0) && bscPoolId >= 0) {
            lpToken.safeApprove(address(bscPool), 0);
            lpToken.safeApprove(address(bscPool), uint256(-1));
            bscPool.deposit(uint256(bscPoolId), amount);
            emit StakedbscPool(user, amount);
        }
    }

    /// @dev Withdraw from MDX pool.
    function _withdraw(uint256 amount, address user) internal {
        if (address(bscPool) != address(0) && bscPoolId >= 0) {
            // withdraw lp token back
            bscPool.withdraw(uint256(bscPoolId), amount);
            emit WithdrawnbscPool(user, amount);
        }
    }

    /// @dev Internal function to stake all outstanding LP tokens to the given position ID.
    function _addPosition(uint256 id, address user) internal {
        uint256 lpBalance = lpToken.balanceOf(address(this));
        if (lpBalance > 0) {
            // take lpToken to the pool2.
            _stake(lpBalance);
            posLPAmount[id] = posLPAmount[id].add(lpBalance);
            totalLPAmount = totalLPAmount.add(lpBalance);
            emit AddPosition(id, lpBalance);
        }
    }

    /// @dev Internal function to remove shares of the ID and convert to outstanding LP tokens.
    function _removePosition(uint256 id, address user) internal {
        uint256 lpAmount = posLPAmount[id];
        if (lpAmount > 0) {
            _withdraw(lpAmount, user);
            totalLPAmount = totalLPAmount.sub(lpAmount);
            posLPAmount[id] = 0;
            emit RemovePosition(id, lpAmount);
        }
    }

    /* ========== Only owner ========== */

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

    fallback() external {
        require(false, "Error call");
    }
    
    receive() external payable {
        require(false, "Error call");
    }
}
