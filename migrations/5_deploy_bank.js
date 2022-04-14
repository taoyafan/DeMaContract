const UserProfile = artifacts.require("UserProfile.sol");
const TripleSlopeModel = artifacts.require("TripleSlopeModel");
const BankConfig = artifacts.require("BankConfig");
const Bank = artifacts.require("Bank");
const DEMA = artifacts.require("DEMA");
const Farm = artifacts.require("Farm");
const BigNumber = require("bignumber.js");
const{ time } = require('@openzeppelin/test-helpers');

let {saveToJson} = require('../js_utils/jsonRW.js');
let {getBanksInfo} = require('../js_utils/config.js');

const {setNetwork} = require("../js_utils/utils");

module.exports = async function (deployer, network, accounts) {

    // Read address
    const { addressJson } = setNetwork(network, web3);

    await deployer.deploy(TripleSlopeModel);
    const model = await TripleSlopeModel.deployed();
    saveToJson("TripleSlopeModel", model.address, network);

    await deployer.deploy(BankConfig);
    const bankConfig = await BankConfig.deployed();
    saveToJson("BankConfig", bankConfig.address, network);

    const dema = await DEMA.at(addressJson.DEMA);
    await deployer.deploy(
        Farm,
        addressJson.UserProfile,
        dema.address,
        500,    // inviterBonusRatio 5%
        500     // bonusRatio 5%
    );
    const farm = await Farm.deployed();
    saveToJson("Farm", farm.address, network);

    await deployer.deploy(
        Bank,
        farm.address
    );
    const bank = await Bank.deployed();
    saveToJson("Bank", bank.address, network);

    // Add minter of dema for farm.
    await dema.addMinter(farm.address);
    console.log("addMinter succeed");

    // Add bank config
    let setReserveBps = 1000;   // 10%
    let setLiquidateBps = 1000;     // 10%
    await bankConfig.setParams(setReserveBps, setLiquidateBps, TripleSlopeModel.address);
    console.log("setParams succeed");
    await bankConfig.setCanPayRewards(2, 1);
    console.log("setCanPayRewards succeed");
    await bank.updateConfig(bankConfig.address);
    console.log("updateConfig succeed");

    let banksInfo = getBanksInfo(network);
    let farmId = await farm.nextPoolId();

    for (info of banksInfo) {
        await farm.addPool(info.rewardFirstPeriod, 23, time.duration.days(30), 90, bank.address);
        await bank.addToken(addressJson[info.token], farmId);
        console.log(`addToken for ${info.token} succeed`);
        saveToJson(`Bank${info.token}FarmPoolId`, farmId, network);
        ++farmId;
    }
};
