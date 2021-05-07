pragma solidity >=0.5.0 <0.8.0;


interface IGoblin {

    /// @dev Work on a (potentially new) position. Optionally send surplus token back to Bank.
    function work(
        uint256 id, 
        address user, 
        address inviter,
        bool canInvite,
        address[2] calldata borrowToken, 
        uint256[2] calldata amount, 
        uint256[2] calldata debt, 
        bytes calldata data
    ) external payable;

    /// @dev Return the amount of each borrow token can be withdrawn with the given borrow amount rate. 
    function health(
        uint256 id, 
        address[2] calldata borrowToken, 
        uint256[2] calldata amount
    ) external view returns (uint256);

    /// @dev Liquidate the given position to token need. Send all borrow token back to Bank.
    function liquidate(uint256 id, address user, address inviter, address[2] calldata borrowToken) external;
}