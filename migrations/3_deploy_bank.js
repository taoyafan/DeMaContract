const UserProfile = artifacts.require("UserProfile.sol");
const TripleSlopeModel = artifacts.require("TripleSlopeModel");
const BankConfig = artifacts.require("BankConfig");
const Bank = artifacts.require("Bank");
const DEMA = artifacts.require("DEMA");
const Farm = artifacts.require("Farm");

const BigNumber = require("bignumber.js");

module.exports = function (deployer, network, accounts) {

    deployer.deploy(TripleSlopeModel)
    .then(() => {
        return deployer.deploy(BankConfig);
    }).then(() => {
        return deployer.deploy(DEMA);
    }).then(() => {
        return deployer.deploy(
            Farm,
            UserProfile.address,
            DEMA.address,
            500,
            500
            );
    }).then(() => {
        return deployer.deploy(
            Bank,
            Farm.address
            );
    });
};
