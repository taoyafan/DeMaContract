// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.8.0;

interface IWETH {
    function balanceOf(address user) external returns (uint);

    function approve(address to, uint value) external returns (bool);

    function transfer(address to, uint value) external returns (bool);

    function deposit() external payable;

    function withdraw(uint) external;
}