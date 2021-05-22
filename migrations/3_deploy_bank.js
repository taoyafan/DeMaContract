const TripleSlopeModel = artifacts.require("TripleSlopeModel");
const BankConfig = artifacts.require("BankConfig");
const Bank = artifacts.require("Bank");
const BigNumber = require("bignumber.js");

module.exports = function (deployer, network, accounts) {

    // deployer.deploy(TripleSlopeModel);
    // deployer.deploy(BankConfig);
    // deployer.deploy(Bank, "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd");
    // if(network == 'development') {
    //     const USDT = artifacts.require("ERC20Token");
    //     deployer.deploy(USDT, "USDT", "USDT", BigNumber(1000e18));
    // }

    // deployer.deploy(TripleSlopeModel).then((model) => {
    //     return deployer.deploy(BankConfig);
    // })
};
