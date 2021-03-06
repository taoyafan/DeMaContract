// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./../interface/IPair.sol";
import "./../interface/IRouter.sol";
import "./../interface/IFactory.sol";
import "./../interface/IWBNB.sol";
import "./../interface/IStrategy.sol";
import "./../utils/SafeToken.sol";
import "./../utils/Math.sol";


abstract contract AStrategyAddTwoSidesOptimal is Ownable, ReentrancyGuard, IStrategy {
    event posDeposit(uint256[2] amount);

    using SafeToken for address;
    using SafeMath for uint256;

    address public factory;
    address public router;
    address public wBNB;

    // Used in execute to prevent stack over deep
    struct InputData {
        address token0;
        address token1;
        uint256 token0Amount;
        uint256 token1Amount;
        uint256 minLPAmount;
        bool canSwap;
    }

    constructor(address _router) public {
        factory = IRouter(_router).factory();
        router = _router;
    }

    /// @dev Compute optimal deposit amount.
    /// @param amtA amount of token A desired to deposit
    /// @param amtB amonut of token B desired to deposit
    /// @param resA amount of token A in reserve
    /// @param resB amount of token B in reserve
    function optimalDeposit(
        uint256 amtA,
        uint256 amtB,
        uint256 resA,
        uint256 resB
    ) internal pure returns (uint256 swapAmt, bool isReversed) {
        if (amtA.mul(resB) >= amtB.mul(resA)) {
            // There are more A than B, we will swap some A for B.
            swapAmt = _optimalDepositA(amtA, amtB, resA, resB);
            isReversed = false;
        } else {
            swapAmt = _optimalDepositA(amtB, amtA, resB, resA);
            isReversed = true;
        }
    }

    /// @dev Compute optimal deposit amount helper, A is much more than B,
    ///      and we need to swap some A for B.
    /// @param amtA amount of token A desired to deposit
    /// @param amtB amonut of token B desired to deposit
    /// @param resA amount of token A in reserve
    /// @param resB amount of token B in reserve
    function _optimalDepositA(
        uint256 amtA,
        uint256 amtB,
        uint256 resA,
        uint256 resB
    ) internal pure virtual returns (uint256);

    /// @dev Execute worker strategy. Take LP tokens + debtToken. Return LP tokens.
    /// @param user User address
    /// @param borrowTokens The token user borrow from bank.
    /// @param borrows The amount user borrow from bank.
    /// @param data Extra calldata information passed along to this strategy.
    function execute(
        address user,
        address[2] calldata borrowTokens,
        uint256[2] calldata borrows,
        uint256[2] calldata /* debt */,
        bytes calldata data
    )
        external
        payable
        override
        nonReentrant
        returns (uint256[2] memory)
    {
        InputData memory dt;    // input data
        // 1. decode token and amount info, and transfer to contract.
        // TODO change all interface related place
        (dt.token0, dt.token1, dt.token0Amount, dt.token1Amount, dt.minLPAmount, dt.canSwap) =
            abi.decode(data, (address, address, uint256, uint256, uint256, bool));
        {
            require(((borrowTokens[0] == dt.token0) && (borrowTokens[1] == dt.token1)) ||
                    ((borrowTokens[0] == dt.token1) && (borrowTokens[1] == dt.token0)), "borrowTokens not token0 and token1");

            if (dt.token0Amount > 0 && dt.token0 != address(0)) {
                dt.token0.safeTransferFrom(user, address(this), dt.token0Amount);
            }
            if (dt.token1Amount > 0 && dt.token1 != address(0)) {
                dt.token1.safeTransferFrom(user, address(this), dt.token1Amount);
            }
        }

        address BNBRelative = address(0);
        {
            if (borrows[0] > 0 && borrowTokens[0] != address(0)) {
                borrowTokens[0].safeTransferFrom(msg.sender, address(this), borrows[0]);
            }
            if (borrows[1] > 0 && borrowTokens[1] != address(0)) {
                borrowTokens[1].safeTransferFrom(msg.sender, address(this), borrows[1]);
            }
            if (dt.token0 == address(0)){
                dt.token0 = wBNB;
                BNBRelative = dt.token1;
            }
            if (dt.token1 == address(0)){
                dt.token1 = wBNB;
                BNBRelative = dt.token0;
            }

            // change all BNB to WBNB if need.
            uint256 BNBBalance = address(this).balance;
            if (BNBBalance > 0) {
                IWBNB(wBNB).deposit{value: BNBBalance}();
            }
        }
        // tokens are all ERC20 token now.

        IPair lpToken = IPair(IFactory(factory).getPair(dt.token0, dt.token1));
        // 2. Compute the optimal amount of token0 and token1 to be converted.
        {
            dt.token0.safeApprove(router, 0);
            dt.token0.safeApprove(router, uint256(-1));

            dt.token1.safeApprove(router, 0);
            dt.token1.safeApprove(router, uint256(-1));

            if (dt.canSwap) {
                // 3. swap and mint LP tokens.
                calAndSwap(lpToken, dt.token0, dt.token1);
            }

            (,, uint256 moreLPAmount) = IRouter(router).addLiquidity(dt.token0, dt.token1, dt.token0.myBalance(), dt.token1.myBalance(), 0, 0, address(this), now);
            require(moreLPAmount >= dt.minLPAmount, "insufficient LP tokens received");
        }

        // 4. send lpToken and borrowTokens back to the sender.
        lpToken.transfer(msg.sender, lpToken.balanceOf(address(this)));

        if (BNBRelative == address(0)) {
            dt.token0.safeTransfer(msg.sender, dt.token0.myBalance());
            dt.token1.safeTransfer(msg.sender, dt.token1.myBalance());
        } else {
            safeUnWrapperAndAllSend(dt.token0, msg.sender);
            safeUnWrapperAndAllSend(dt.token1, msg.sender);
        }

        if (borrowTokens[0] == dt.token0 || (borrowTokens[0] == address(0) && dt.token0 == wBNB))
        {
            emit posDeposit([dt.token0Amount, dt.token1Amount]);
            return [dt.token0Amount, dt.token1Amount];
        } else {
            emit posDeposit([dt.token1Amount, dt.token0Amount]);
            return [dt.token1Amount, dt.token0Amount];
        }
    }

    /// get token balance, if is WBNB un wrapper to BNB and send to 'to'
    function safeUnWrapperAndAllSend(address token, address to) internal {
        uint256 total = SafeToken.myBalance(token);
        if (total > 0) {
            if (token == wBNB) {
                IWBNB(wBNB).withdraw(total);
                SafeToken.safeTransferETH(to, total);
            } else {
                SafeToken.safeTransfer(token, to, total);
            }
        }
    }

    /// Compute amount and swap between borrowToken and tokenRelative.
    function calAndSwap(IPair lpToken, address tokenA, address tokenB) internal {
        (uint256 token0Reserve, uint256 token1Reserve,) = lpToken.getReserves();
        (uint256 tokenAReserve, uint256 tokenBReserve) = tokenA ==
            lpToken.token0() ? (token0Reserve, token1Reserve) : (token1Reserve, token0Reserve);
        (uint256 swapAmt, bool isReversed) = optimalDeposit(tokenA.myBalance(), tokenB.myBalance(),
            tokenAReserve, tokenBReserve);

        if (swapAmt > 1e5){
            address[] memory path = new address[](2);
            (path[0], path[1]) = isReversed ? (tokenB, tokenA) : (tokenA, tokenB);
            // path[0] is the token who need to be swaped for path[1]
            IRouter(router).swapExactTokensForTokens(swapAmt, 0, path, address(this), now);
        }
    }

    /* ==================================== Only Owner ==================================== */

    /// @dev Recover ERC20 tokens that were accidentally sent to this smart contract.
    /// @param token The token contract. Can be anything. This contract should not hold ERC20 tokens.
    /// @param to The address to send the tokens to.
    /// @param value The number of tokens to transfer to `to`.
    function recover(address token, address to, uint256 value) external onlyOwner nonReentrant {
        token.safeTransfer(to, value);
    }

    receive() external payable {}
}
