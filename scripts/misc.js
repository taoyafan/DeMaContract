global.artifacts = artifacts
const BigNumber = require("bignumber.js");

const { assert } = require('console');
let {
    bnbAddress,
    setNetwork,
    transfer,
    removeAllLiquidity,
} = require('../js_utils/utils.js');
const {addressJson} = setNetwork('bsctest', web3)

async function transferToTestAccount(from) {
    const testAccounts = [
        "0xBd3Befc7e3859CFfc6E3b85b5773F620780E2419",   // m
        "0xD56936ED720550AC0e0008e6b928884B7a3d82CD",
        "0xdF385C23be07789a6115Ff371D68Cf056589B485",
        "0x271e565C662c174aDFBe876D4c5d5Cb55a12427B",    
        "0x47f0a028B5B3eF557ffEe65f88ffb3C52305e040",    // xie
    ];

    for (testAccount of testAccounts) {
        console.log(`Start send token to ${testAccount}`)

        await transfer(addressJson.BTC, testAccount, BigNumber(100e18), from);
        console.log(`Send BTC succeed`);
        await transfer(addressJson.ETH, testAccount, BigNumber(100e18), from);
        console.log(`Send ETH succeed`);
        await transfer(addressJson.USDT, testAccount, BigNumber(1e26), from);
        console.log(`Send USDT succeed`);
        await transfer(addressJson.BUSD, testAccount, BigNumber(1e26), from);
        console.log(`Send BUSD succeed`);
        await transfer(addressJson.DEMA, testAccount, BigNumber(1e24), from);
        console.log(`Send DEMA succeed`);
        await transfer(addressJson.Cake, testAccount, BigNumber(1e24), from);
        console.log(`Send Cake succeed`);
    }
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