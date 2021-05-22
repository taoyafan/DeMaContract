pragma solidity ^0.6.0;

// This is a test for plugin. 
// The introduction will cost a lot of gas. We may use IPFS to save data.

import "./Interface/IPlugin.sol";

contract PlgUserIntroduction is IPlugin{ 
    
    mapping(address => bytes) intro;    // Self introduction

    function write(bytes calldata data) external payable override {
        (address account, bytes memory contents) = abi.decode(data, (address, bytes));
        require(tx.origin == account, "Account must be the address of tx.origin");

        intro[account] = contents;
    }

    function read(bytes calldata data) external payable override returns (bytes memory) {
        (address account) = abi.decode(data, (address));
        return intro[account];
    }
}
