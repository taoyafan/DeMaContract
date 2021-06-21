pragma solidity ^0.6.0;

interface IStrategy {

    /// @dev Execute worker strategy. Take LP tokens + debt token. Return LP tokens or debt token.
    /// @param user The original user that is interacting with the operator.
    /// @param borrowTokens Two borrow token address.
    /// @param borrows The amount of each borrow token.
    /// @param debts The user's total debt of each borrow token, for better decision making context.
    /// @param data Extra calldata information passed along to this strategy.
    /// @return Principal changed amount change of each token, increase or decrease.
    /// return token and amount need transfer back.
    function execute(
        address user,
        address[2] calldata borrowTokens,
        uint256[2] calldata borrows,
        uint256[2] calldata debts,
        bytes calldata data) external payable returns (uint256[2] memory);

}