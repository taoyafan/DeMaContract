global.artifacts = artifacts
const BigNumber = require("bignumber.js");

const { assert } = require('console');
let {
    bnbAddress,
    setNetwork,
    transfer,
    removeAllLiquidity,
} = require('../js_utils/utils.js');
const {addressJson} = setNetwork('bsctest')

async function transferToTestAccount(from) {
    const testAccount = "0xBd3Befc7e3859CFfc6E3b85b5773F620780E2419";

    await transfer(addressJson.BTC, testAccount, BigNumber(100e18), from);
    await transfer(addressJson.ETH, testAccount, BigNumber(100e18), from);
    await transfer(addressJson.USDT, testAccount, BigNumber(1e26), from);
    await transfer(addressJson.BUSD, testAccount, BigNumber(1e26), from);
    await transfer(addressJson.DEMA, testAccount, BigNumber(1e24), from);
}

function main(callback) {

    async function fun() {
        try {
            const networkId = await web3.eth.net.getId();
            assert(networkId == 97)
            const accounts = await web3.eth.getAccounts();
            
            // await removeAllLiquidity(bnbAddress, addressJson.USDT, accounts[0]);
            await transferToTestAccount(accounts[0]);
        } catch(err) {
            console.error(err)
        }
    }

    fun().then(callback);
}

module.exports = main;