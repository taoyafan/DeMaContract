pragma solidity >=0.5.0 <0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDEMA is IERC20{

    function mint(address account, uint256 amount) external;

    function burn(address account, uint256 amount) external;
}