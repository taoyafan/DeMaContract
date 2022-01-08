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
    const bankConfig = await deployer.deploy(BankConfig);
    const dema = await DEMA.at(addressJson.DEMA);
    const farm = await deployer.deploy(
        Farm,
        UserProfile.address,
        dema.address,
        500,    // inviterBonusRatio 5%
        500     // bonusRatio 5%
    );
    const bank = await deployer.deploy(
        Bank,
        Farm.address
    );

    // Add minter of dema for farm.
    dema.addMinter(farm.address);

    saveToJson("TripleSlopeModel", TripleSlopeModel.address, network);
    saveToJson("BankConfig", bankConfig.address, network);
    saveToJson("Farm", farm.address, network);
    saveToJson("Bank", bank.address, network);

    // Add bank config
    let setReserveBps = 1000;   // 10%
    let setLiquidateBps = 1000;     // 10%
    await bankConfig.setParams(setReserveBps, setLiquidateBps, TripleSlopeModel.address);
    await bankConfig.setCanPayRewards(2, 1);
    await bank.updateConfig(bankConfig.address);

    let banksInfo = getBanksInfo(network);
    let farmId = 0;

    for (info of banksInfo) {
        farm.addPool(info.rewardFirstPeriod, 23, time.duration.days(30), 90, bank.address);
        await bank.addToken(addressJson[info.token], farmId);
        saveToJson(`Bank${info.token}FarmPoolId`, farmId, network);
        ++farmId;
    }
};
