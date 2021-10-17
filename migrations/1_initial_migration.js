const ERC20Token = artifacts.require("ERC20Token");
const BigNumber = require("bignumber.js");
const DEMA = artifacts.require("DEMA");

let {saveToJson, readAddressJson} = require('../js_utils/jsonRW.js');

module.exports = async function(deployer, network, accounts) {
    // await deployer.deploy(Migrations);
    if (network == 'development' || network == 'bsctest') {
        await deployer.deploy(ERC20Token, "USDT", "USDT", BigNumber(1e27));    // 1e9
        let usdt = await ERC20Token.deployed();
        let busd = await deployer.deploy(ERC20Token, "BUSD", "BUSD", BigNumber(1e27));    // 1e9
        let eth = await deployer.deploy(ERC20Token, "ETH", "ETH", BigNumber(1e27));    // 1e9
        let btc = await deployer.deploy(ERC20Token, "BTC", "BTC", BigNumber(1e27));    // 1e9
        const dema = await deployer.deploy(DEMA);
        await dema.addMinter(accounts[0]);
        await dema.mint(accounts[0], BigNumber(1e25));      // 1e7

        saveToJson("USDT", usdt.address, network);
        saveToJson("BUSD", busd.address, network);
        saveToJson("ETH", eth.address, network);
        saveToJson("BTC", btc.address, network);
        saveToJson("DEMA", dema.address, network);
    } else {
        throw new Error('Init for other network unfinished');
    }
};
