const UserProfile = artifacts.require("UserProfile.sol");
const TripleSlopeModel = artifacts.require("TripleSlopeModel");
const BankConfig = artifacts.require("BankConfig");
const Bank = artifacts.require("Bank");
const DEMA = artifacts.require("DEMA");
const Farm = artifacts.require("Farm");
const ERC20Token = artifacts.require("ERC20Token");

const BigNumber = require("bignumber.js");
let saveToJson = require('./save_address_to_json.js')

module.exports = async function (deployer, network, accounts) {

    await deployer.deploy(TripleSlopeModel);
    await deployer.deploy(BankConfig);
    await deployer.deploy(DEMA);
    await deployer.deploy(
        Farm,
        UserProfile.address,
        DEMA.address,
        500,
        500
    );
    await deployer.deploy(
        Bank,
        Farm.address
    );

    saveToJson("TripleSlopeModel", (await TripleSlopeModel.deployed()).address);
    saveToJson("BankConfig", (await BankConfig.deployed()).address);
    saveToJson("DEMA", (await DEMA.deployed()).address);
    saveToJson("BankFarm", (await Farm.deployed()).address);
    saveToJson("Bank", (await Bank.deployed()).address);

    if (network == 'development') {
        const usdt = await deployer.deploy(ERC20Token, "USDT", "USDT", BigNumber(1e25))    //1e7
        const busd = await deployer.deploy(ERC20Token, "BUSD", "BUSD", BigNumber(1e25))    //1e7

        saveToJson("USDT", usdt.address);
        saveToJson("BUSD", busd.address);
    }
};
