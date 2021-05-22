pragma solidity ^0.6.0;

interface IPlugin {

    function execute(address account, bytes calldata data) external payable;
}