pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "./Interface/IDEMA.sol";

contract DEMA is IDEMA, ERC20Capped{

    using EnumerableSet for EnumerableSet.AddressSet;
    
    // Dead address used to burn
    address public constant dead = address(0x000000000000000000000000000000000000dEaD); 
    address public governance;
    EnumerableSet.AddressSet minters;
    // mapping (address => bool) public minters;

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
        require(isMinter(msg.sender), "!minter");
        _mint(account, amount);
    }

    /* ==================================== Only Governance ==================================== */

    function setGovernance(address _governance) external onlyGovernance {
        governance = _governance;
    }

    function addMinter(address _minter) external onlyGovernance {
        EnumerableSet.add(minters, _minter);
    }

    function removeMinter(address _minter) external onlyGovernance {
        EnumerableSet.remove(minters, _minter);
    }

    // Burn tokens in dead address
    function burnDead(uint256 amount) external onlyGovernance {
        _burn(dead, amount);
    }

    /* ==================================== Read ==================================== */

    function mintersNum() public view returns (uint256) {
        return EnumerableSet.length(minters);
    }

    function getMinter(uint256 index) public view returns (address) {
        return EnumerableSet.at(minters, index);
    }

    function isMinter(address inAddress) public view returns (bool) {
        return EnumerableSet.contains(minters, inAddress);
    }

    function allMinters() external view returns (address[] memory){
        uint256 len = mintersNum();
        address[] memory mintersArray = new address[](len);

        for (uint256 i = 0; i < len; ++i) { 
            mintersArray[i] = getMinter(i);
        }
        return mintersArray;
    }

    /* ==================================== Write ==================================== */

    function burn(address account, uint256 amount) external override {
        require(msg.sender == account, "Sender is not the burned account.");
        _burn(account, amount);
    }
}
