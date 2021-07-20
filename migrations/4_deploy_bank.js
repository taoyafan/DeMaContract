const UserProfile = artifacts.require("UserProfile.sol");
const TripleSlopeModel = artifacts.require("TripleSlopeModel");
const BankConfig = artifacts.require("BankConfig");
const Bank = artifacts.require("Bank");
const DEMA = artifacts.require("DEMA");
const Farm = artifacts.require("Farm");

let saveToJson = require('./save_address_to_json.js')
const fs = require('fs')

module.exports = async function (deployer, network, accounts) {

    // Read address
    const jsonString = fs.readFileSync("bin/contracts/address.json")
    const addressJson = JSON.parse(jsonString)

    const interestModel = await deployer.deploy(TripleSlopeModel);
    const bankConfig = await deployer.deploy(BankConfig);
    const dema = await deployer.deploy(DEMA);
    const farm = await deployer.deploy(
        Farm,
        UserProfile.address,
        DEMA.address,
        500,
        500
    );
    const bank = await deployer.deploy(
        Bank,
        Farm.address
    );

    // Add minter of dema for farm.
    dema.addMinter(farm.address);

    saveToJson("TripleSlopeModel", model.address);
    saveToJson("BankConfig", bankConfig.address);
    saveToJson("DEMA", dema.address);
    saveToJson("Farm", farm.address);
    saveToJson("Bank", bank.address);

    // TODO add farm and get the correct pool id
    if (network == 'development') {

        // Add bank config
        let setReserveBps = 1000;   // 10%
        let setLiquidateBps = 1000;     // 10%
        await bankConfig.setParams(setReserveBps, setLiquidateBps, interestModel.address);
        await bank.updateConfig(bankConfig.address);

        // Farm add pools
        farm.addPool(BigNumber(19200*30).multipliedBy(1e18), 23, time.duration.days(30), 90, bank.address);
        farm.addPool(BigNumber(15360*30).multipliedBy(1e18), 23, time.duration.days(30), 90, bank.address);
        farm.addPool(BigNumber(15360*30).multipliedBy(1e18), 23, time.duration.days(30), 90, bank.address);
        farm.addPool(BigNumber(15360*30).multipliedBy(1e18), 23, time.duration.days(30), 90, bank.address);

        // Bank add tokens
        await bank.addToken(`0x0000000000000000000000000000000000000000`, 0);
        await bank.addToken(addressJson.USDT, 1);
        await bank.addToken(addressJson.MdxToken, 2);
        await bank.addToken(addressJson.BUSD, 3);
    } else {
        throw new Error('Add token for other network unfinished');
    }

};
