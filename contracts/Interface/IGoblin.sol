pragma solidity >=0.5.0 <0.8.0;


interface IGoblin {

    /// @dev Send all mdx rewards earned in this goblin to account.
    function getAllRewards(address account) external;

    /**
     * @dev Work on the given position. Must be called by the operator.
     * @param id The position ID to work on.
     * @param user The original user that is interacting with the operator.
     * @param inviter The inviter address.
     * @param canInvite Whether user can earn the invite reward.
     * @param borrowTokens Address of two tokens user borrow from bank.
     * @param borrowAmounts The amount of two borrow tokens.
     * @param debts The user's debt amount of two tokens.
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
    ) external payable;

    /**
     * @dev Return the amount of each borrow token can be withdrawn with the given borrow amount rate.
     * @param id The position ID to perform health check.
     * @param borrowTokens Address of two tokens this position had debt.
     * @param debts Debts of two tokens.
     */
     function health(
        uint256 id,
        address[2] calldata borrowTokens,
        uint256[2] calldata debts
    ) external view returns (uint256[2] memory);

    /**
     * @dev Liquidate the given position by converting it to debtToken and return back to caller.
     * @param id The position ID to perform liquidation.
     * @param user The address than this position belong to.
     * @param inviter The address of inviter.
     * @param borrowTokens Two tokens address user borrow from bank.
     * @param debts Two tokens debts.
     */
    function liquidate(
        uint256 id,
        address user,
        address inviter,
        address[2] calldata borrowTokens,
        uint256[2] calldata debts) external;
}