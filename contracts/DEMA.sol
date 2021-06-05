pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";

import "./Interface/IDEMA.sol";

contract DEMA is IDEMA, ERC20Capped{
    
    // Dead address used to burn
    address public constant dead = address(0x000000000000000000000000000000000000dEaD); 
    address public governance;
    mapping (address => bool) public minters;

    /* ==================================== Constructor ==================================== */

    constructor () 
        public 
        ERC20("DeMac Coin", "DEMA") // Name is DeMac Coin, symbol is DEMA, decimal is 1e18
        ERC20Capped(1e8 * 1e18)     // Total supply is 1e8 DEMA.
    {
        governance = tx.origin;
    }

    /* ==================================== Modifier ==================================== */

    modifier onlyGovernance() {
        require(msg.sender == governance, "!governance");
        _;
    }

    /* ==================================== Only Minters ==================================== */

    function mint(address account, uint256 amount) external override {
        require(minters[msg.sender], "!minter");
        _mint(account, amount);
    }

    /* ==================================== Only Governance ==================================== */

    function setGovernance(address _governance) external onlyGovernance {
        governance = _governance;
    }

    function addMinter(address _minter) external onlyGovernance {
        minters[_minter] = true;
    }

    function removeMinter(address _minter) external onlyGovernance {
        minters[_minter] = false;
    }

    // Burn tokens in dead address
    function burnDead(uint256 amount) external onlyGovernance {
        _burn(dead, amount);
    }

    /* ==================================== Write ==================================== */

    function burn(address account, uint256 amount) external override {
        require(msg.sender == account, "Sender is not the burned account.");
        _burn(account, amount);
    }
}
