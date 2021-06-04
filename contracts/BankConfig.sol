pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Interface/IBankConfig.sol";
import "./Interface/IInterestModel.sol";

contract BankConfig is IBankConfig, Ownable {

    uint256 public override getReserveBps;
    uint256 public override getLiquidateBps;
    IInterestModel public defaultModel;

    mapping(address => IInterestModel) modelForToken;

    function setParams(uint256 _getReserveBps, uint256 _getLiquidateBps, IInterestModel _interestModel) external onlyOwner {
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