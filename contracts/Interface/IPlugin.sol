pragma solidity ^0.6.0;

interface IPlugin {

    function write(bytes calldata data) external payable;

    function read(bytes calldata data) external view returns (bytes memory);
}