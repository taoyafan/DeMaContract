pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Interface/IBankConfig.sol";
import "./Interface/IInterestModel.sol";

contract BankConfig is IBankConfig, Ownable {

    uint256 public override getReserveBps;
    uint256 public override getLiquidateBps;
    IInterestModel public interestModel;

    constructor() public {}

    function setParams(uint256 _getReserveBps, uint256 _getLiquidateBps, IInterestModel _interestModel) public onlyOwner {
        getReserveBps = _getReserveBps;
        getLiquidateBps = _getLiquidateBps;
        interestModel = _interestModel;
    }

    function getInterestRate(uint256 debt, uint256 floating) external view override returns (uint256) {
        return interestModel.getInterestRate(debt, floating);
    }
}