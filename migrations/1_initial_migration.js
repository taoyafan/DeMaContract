const Migrations = artifacts.require("./Migrations.sol");
const ERC20Token = artifacts.require("ERC20Token");
const BigNumber = require("bignumber.js");

let saveToJson = require('./save_address_to_json.js')

module.exports = async function(deployer, network) {
    // await deployer.deploy(Migrations);
    if (network == 'development' || network == 'bsctest') {
        await deployer.deploy(ERC20Token, "USDT", "USDT", BigNumber(1e25));    //1e7
        let usdt = await ERC20Token.deployed();
        let busd = await deployer.deploy(ERC20Token, "BUSD", "BUSD", BigNumber(1e25));    //1e7

        saveToJson("USDT", usdt.address, network);
        saveToJson("BUSD", busd.address, network);
    } else {
        throw new Error('Init for other network unfinished');
    }
};
