// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

// This is a test for plugin. 
// The introduction will cost a lot of gas. We may use IPFS to save data.

import "./interface/IPlugin.sol";

contract PlgUserIntroduction is IPlugin{ 
    /// @notice Events
    event Write(address account, bytes contents);
    
    mapping(address => bytes) intro;    // Self introduction

    function write(bytes calldata data) external payable override {
        (address account, bytes memory contents) = abi.decode(data, (address, bytes));
        require(tx.origin == account, "Account must be the address of tx.origin");

        intro[account] = contents;
        emit Write(account, contents);
    }

    function read(bytes calldata data) external view override returns (bytes memory) {
        (address account) = abi.decode(data, (address));
        return intro[account];
    }
}
