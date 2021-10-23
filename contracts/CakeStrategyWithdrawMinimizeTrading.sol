pragma solidity ^0.6.0;

// import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/math/SafeMath.sol";
// import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.3.0/contracts/access/Ownable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.3.0/contracts/math/SafeMath.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.3.0/contracts/utils/ReentrancyGuard.sol";

import "./Interface/cakeInterface/IPancakeRouter02.sol";
import "./Interface/cakeInterface/IPancakeFactory.sol";
import "./Interface/cakeInterface/IPancakePair.sol";
import "./Interface/IWBNB.sol";
import "./Interface/IStrategy.sol";
import "./Interface/ISwapMining.sol";
import "./utils/SafeToken.sol";
import "./utils/Math.sol";


contract CakeStrategyWithdrawMinimizeTrading is Ownable, ReentrancyGuard, IStrategy {
    event posWithdraw(uint256[2] withdraw);   // Same order as borrow tokens.

    using SafeToken for address;
    using SafeMath for uint256;

    IPancakeFactory public factory;
    IPancakeRouter02 public router;
    address public wBNB;

    /// @dev Create a new withdraw minimize trading strategy instance for mdx.
    /// @param _router The mdx router smart contract.
    constructor(IPancakeRouter02 _router) public {
        factory = IPancakeFactory(_router.factory());
        router = _router;

        wBNB = _router.WETH();
    }

    /**
     * @dev Execute worker strategy. Take LP tokens. Return debt token + token want back.
     * @param user User address to withdraw liquidity.
     * @param borrowTokens The token user borrow from bank.
     * @param debts User's debt amount.
     * @param data Extra calldata information passed along to this strategy.
     */
    function execute(
        address user,
        address[2] calldata borrowTokens,
        uint256[2] calldata /* borrow */,
        uint256[2] calldata debts,
        bytes calldata data
    )
        external
        payable
        override
        nonReentrant
        returns (uint256[2] memory)
    {
        // rate will divide 10000. 10000 means all token will be withdrawn.
        // whichWantBack:
        // 0: token0;
        // 1: token1;
        // 2: token what surplus;
        // 3: don't back(all repay);
        (address token0, address token1, uint256 rate, uint256 whichWantBack) =
            abi.decode(data, (address, address, uint256, uint256));

        require((borrowTokens[0] == token0 || borrowTokens[0] == token1) || borrowTokens[0] == address(0),
                "borrowTokens[0] not token0 and token1");

        require((borrowTokens[1] == token0 || borrowTokens[1] == token1) || borrowTokens[1] == address(0),
                "borrowTokens[1] not token0 and token1");

        require(borrowTokens[0] != borrowTokens[1] ||
                debts[1] == 0, "borrowTokens should be different, or debts[1] should be 0");

        require(whichWantBack < 4, "whichWantBack could only be 0, 1, 2, 3");

        // 1. Replace BNB by WBNB for all tokens.
        {
            require(token0 != token1, "token0 and token1 cannot be same.");

            if (token0 == address(0)) {
                token0 = wBNB;
            } else if (token1 == address(0)) {
                token1 = wBNB;
            }

            // Now all tokens are all ERC20. BNB is repalced by WBNB
        }

        // 2. Find out lpToken and remove liquidity with the target rate.

        // Take a note of what user want in case the order of token0 and token1 switched.
        address tokenUserWant = whichWantBack == uint256(0) ? token0 : token1;
        IPancakePair lpToken = IPancakePair(factory.getPair(token0, token1));
        {
            // note that token0 and token1 from lpToken may be switched the order.
            token0 = lpToken.token0();
            token1 = lpToken.token1();

            lpToken.approve(address(router), uint256(0));
            lpToken.approve(address(router), uint256(-1));
            router.removeLiquidity(
                token0,
                token1,
                rate.mul(lpToken.balanceOf(address(this))).div(10000),
                0,
                0,
                address(this),
                now
            );
        }

        // 3. Repay debts.
        {
            uint256 da;
            uint256 db;
            if (borrowTokens[0] == token0 ||
                (borrowTokens[0] == address(0) && token0 == wBNB))
            {
                da = debts[0];
                db = debts[1];
            } else {
                da = debts[1];
                db = debts[0];
            }

            // If want token back, only repay debts with the given rate.
            // Otherwise, use all withdrawn money to repay debts.
            if (whichWantBack != 3) {
                da = da.mul(rate).div(10000);
                db = db.mul(rate).div(10000);
            }

            _repayDebts(da, db, lpToken);
        }

        if (lpToken.balanceOf(address(this)) > 0) {
            lpToken.transfer(msg.sender, lpToken.balanceOf(address(this)));
        }

        // If there are some tokens left here, send back to user.
        uint256[2] memory leftAmount;
        if (token0.myBalance() > 0 || token1.myBalance() > 0) {

            // 4. swap remaining token to what user want.
            if (whichWantBack == uint256(0) || whichWantBack == uint256(1)) {
                address tokenAnother = tokenUserWant == token0 ? token1 : token0;
                uint256 anotherAmount = tokenAnother.myBalance();
                if(anotherAmount > 0){
                    _swapExactTokensForTokens(anotherAmount, tokenAnother, tokenUserWant);
                }
            }

            // 5. send all tokens back.
            leftAmount = [token0.myBalance(), token1.myBalance()];
            _safeUnWrapperAndSend(token0, user, leftAmount[0]);
            _safeUnWrapperAndSend(token1, user, leftAmount[1]);
        }

        if (borrowTokens[0] == token0 || (borrowTokens[0] == address(0) && token0 == wBNB))
        {
            emit posWithdraw([leftAmount[0], leftAmount[1]]);
            return [leftAmount[0], leftAmount[1]];

        } else {
            emit posWithdraw([leftAmount[1], leftAmount[0]]);
            return [leftAmount[1], leftAmount[0]];
        }
    }

    /* ==================================== Internal ==================================== */

    function _swapTokensForExactTokens(uint256 amount, address token0, address token1) internal {
        if (amount < 1e5) {
            return;
        }

        token0.safeApprove(address(router), 0);
        token0.safeApprove(address(router), uint256(-1));

        address[] memory path = new address[](2);
        path[0] = token0;
        path[1] = token1;

        router.swapTokensForExactTokens(amount, path[0].myBalance(), path, address(this), now);
    }

    function _swapExactTokensForTokens(uint256 amount, address token0, address token1) internal {
        if (amount < 1e5) {
            return;
        }
        
        token0.safeApprove(address(router), 0);
        token0.safeApprove(address(router), uint256(-1));

        address[] memory path = new address[](2);
        path[0] = token0;
        path[1] = token1;

        router.swapExactTokensForTokens(amount, 0, path, address(this), now);
    }

    function _getMktSellAmount(uint256 aIn, uint256 rIn, uint256 rOut) internal pure returns (uint256) {
        if (aIn == 0) return 0;
        require(rIn > 0 && rOut > 0, "bad reserve values");
        uint256 aInWithFee = aIn.mul(997);
        uint256 numerator = aInWithFee.mul(rOut);
        uint256 denominator = rIn.mul(1000).add(aInWithFee);
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

    /**
     * @dev Repay debts of both token A and B.
     * @notice If it is not enough to repay debts, it will repay as much as possible
     *         according to the input debts ratio.
     *
     * @param da Debts of token A.
     * @param db Debts of token B.
     * @param lpToken LP token of token A and token B.
     */
    function _repayDebts(
        uint256 da,
        uint256 db,
        IPancakePair lpToken
    ) internal {

        address tokenA = lpToken.token0();
        address tokenB = lpToken.token1();
        (uint256 ra, uint256 rb, ) = lpToken.getReserves();
        uint256 na = tokenA.myBalance();
        uint256 nb = tokenB.myBalance();

        // 1. Swap first if needed
        {
            // Can repay debts without swap
            if (na >= da && nb >= db) {
                // Do nothing
            }

            // Directly swaped A to (db - nb) B can repay debts
            else if (na > da && nb <= db && _getMktSellAmount(na-da, ra, rb) > (db-nb)) {
                _swapTokensForExactTokens(db-nb, tokenA, tokenB);
            }

            // Directly swaped B to (da - na) A can repay debts
            else if (nb > db && na <= da && _getMktSellAmount(nb-db, rb, ra) > (da-na)){
                _swapTokensForExactTokens(da-na, tokenB, tokenA);
            }

            // Otherwise, exchange tokens according to two debts amount ratio
            else {

                // na/da > nb/db, swap A to B. If almost same, don't swap
                // TODO Do same thing in another file
                if (na.mul(db) > nb.mul(da).add(1e25)) {
                    uint256 amount = _swapAToBWithDebtsRatio(ra, rb, da, db, na, nb);
                    amount = amount > na ? na : amount;
                    _swapExactTokensForTokens(amount, tokenA, tokenB);
                }

                // na/da < nb/db, swap B to A. If almost same, don't swap
                else if (na.mul(db).add(1e25) < nb.mul(da)) {
                    uint256 amount = _swapAToBWithDebtsRatio(rb, ra, db, da, nb, na);
                    amount = amount > nb ? nb : amount;
                    _swapExactTokensForTokens(amount, tokenB, tokenA);
                }
            }
        }

        // 2. Repay debts
        {
            na = tokenA.myBalance();
            nb = tokenB.myBalance();

            if (na >= da) {
                _safeUnWrapperAndSend(tokenA, msg.sender, da);
            } else {
                _safeUnWrapperAndSend(tokenA, msg.sender, na);
            }

            if (nb >= db) {
                _safeUnWrapperAndSend(tokenB, msg.sender, db);
            } else {
                _safeUnWrapperAndSend(tokenB, msg.sender, nb);
            }
        }
    }

    /// get token balance, if is WBNB un wrapper to BNB and send to 'to'
    function _safeUnWrapperAndSend(address token, address to, uint256 amount) internal {
        if (amount > 0) {
            if (token == wBNB) {
                IWBNB(wBNB).withdraw(amount);
                SafeToken.safeTransferETH(to, amount);
            } else {
                SafeToken.safeTransfer(token, to, amount);
            }
        }
    }

    /* ==================================== Only Owner ==================================== */

    /**
     * @dev Recover ERC20 tokens that were accidentally sent to this smart contract.
     * @param token The token contract. Can be anything. This contract should not hold ERC20 tokens.
     * @param to The address to send the tokens to.
     * @param value The number of tokens to transfer to `to`.
     */
    function recover(address token, address to, uint256 value) external onlyOwner nonReentrant {
        token.safeTransfer(to, value);
    }

    // function withdrawRewards() external onlyOwner {
    //     ISwapMining _swapMining = ISwapMining(router.swapMining());
    //     _swapMining.takerWithdraw();

    //     // Send MDX back to owner.
    //     address mdx = _swapMining.mdx();
    //     mdx.safeTransfer(msg.sender, mdx.myBalance());
    // }

    receive() external payable {}
}
