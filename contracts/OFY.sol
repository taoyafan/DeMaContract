// heco: 0x52Ee54dd7a68e9cf131b0a57fd6015C74d7140E2

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./Interface/IOFY.sol";

contract OFY is IOFY, ERC20 {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;


    address public governance;
    mapping (address => bool) public minters;

    constructor () public ERC20("OFY Token", "OFY") {
        governance = tx.origin;
    }

    function mint(address account, uint256 amount) external override {
        require(minters[msg.sender], "!minter");
        _mint(account, amount);
    }

    function setGovernance(address _governance) external {
        require(msg.sender == governance, "!governance");
        governance = _governance;
    }

    function addMinter(address _minter) external {
        require(msg.sender == governance, "!governance");
        minters[_minter] = true;
    }

    function removeMinter(address _minter) external {
        require(msg.sender == governance, "!governance");
        minters[_minter] = false;
    }

    function burn(address account, uint256 amount) external override {
        require(msg.sender == account, "!burn");
        _burn(account, amount);
    }
}