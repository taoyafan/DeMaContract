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

    await deployer.deploy(TripleSlopeModel);
    await deployer.deploy(BankConfig);
    let dema = await deployer.deploy(DEMA);
    let farm = await deployer.deploy(
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

    // Add minter of dema for farm.
    dema.addMinter(farm.address);

    saveToJson("TripleSlopeModel", (await TripleSlopeModel.deployed()).address);
    saveToJson("BankConfig", (await BankConfig.deployed()).address);
    saveToJson("DEMA", (await DEMA.deployed()).address);
    saveToJson("Farm", (await Farm.deployed()).address);
    saveToJson("Bank", (await Bank.deployed()).address);

    // TODO add farm and get the correct pool id
    if (network == 'development') {

        const bank = await Bank.deployed();
        await bank.addToken(`0x0000000000000000000000000000000000000000`, 0);
        await bank.addToken(addressJson.USDT, 1); 
        await bank.addToken(addressJson.MdxToken, 2);
        await bank.addToken(addressJson.BUSD, 3);
    } else {
        throw new Error('Add token for other network unfinished');
    }
    
};
