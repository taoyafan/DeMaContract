pragma solidity >=0.5.0 <0.8.0;

interface ISwapMining {

    function mdx() external pure returns (address);

    function takerWithdraw() external;
}