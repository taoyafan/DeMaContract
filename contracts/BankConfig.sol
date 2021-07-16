pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Interface/IBankConfig.sol";
import "./Interface/IInterestModel.sol";

contract BankConfig is IBankConfig, Ownable {

    uint256 public override getReserveBps;      // Will divide 10000
    uint256 public override getLiquidateBps;
    IInterestModel public defaultModel;

    mapping(address => IInterestModel) modelForToken;

    function setParams(uint256 _getReserveBps, uint256 _getLiquidateBps, IInterestModel _interestModel) external onlyOwner {
        require(_getReserveBps < 10000, "ReserveBps should less than 10000");
        require(_getLiquidateBps < 5000, "_getLiquidateBps should less than 5000");

        getReserveBps = _getReserveBps;
        getLiquidateBps = _getLiquidateBps;
        defaultModel = _interestModel;
    }

    function setInterestModelForToken(address token, IInterestModel _interestModel) external onlyOwner {
        modelForToken[token] = _interestModel;
    }

    function getInterestRate(uint256 debt, uint256 floating, address token) external view override returns (uint256) {
        IInterestModel interestModel = address(modelForToken[token]) == address(0) ?
            defaultModel : modelForToken[token];

        return interestModel.getInterestRate(debt, floating);
    }
}