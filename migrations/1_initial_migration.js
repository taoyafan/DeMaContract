const Migrations = artifacts.require("./Migrations.sol");
const ERC20Token = artifacts.require("ERC20Token");
const BigNumber = require("bignumber.js");

let saveToJson = require('./save_address_to_json.js')

module.exports = async function(deployer, network) {
    // await deployer.deploy(Migrations);
    if (network == 'development') {
        // There is a bug that first time deploy failed, must deploy twice.
        let usdt = await deployer.deploy(ERC20Token, "USDT", "USDT", BigNumber(1e25));    //1e7
        usdt = await deployer.deploy(ERC20Token, "USDT", "USDT", BigNumber(1e25));    //1e7
        let busd = await deployer.deploy(ERC20Token, "BUSD", "BUSD", BigNumber(1e25));    //1e7

        saveToJson("USDT", usdt.address);
        saveToJson("BUSD", busd.address);
    } else {
        throw new Error('Init for other network unfinished');
    }
};
