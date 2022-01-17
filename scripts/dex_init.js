global.artifacts = artifacts

const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 30 })

const {
    setDex,
    setNetwork,
    addLiquidate,
    networkId2Name,
} = require("../js_utils/utils");

function mdxInit(callback) {

    async function fun() {
        const networkId = await web3.eth.net.getId();
        
        if (networkId == 97) {
            const network = networkId2Name(networkId);
            const accounts = await web3.eth.getAccounts();

            const { addressJson } = setNetwork(network, web3);
            
            // await addLiquidate(addressJson.Bnb, addressJson.USDT, BigNumber(5e18), BigNumber(2000e18), accounts[0]);
            // await addLiquidate(addressJson.BTC, addressJson.USDT, BigNumber(10e18), BigNumber(500000e18), accounts[0]);
            // await addLiquidate(addressJson.ETH, addressJson.USDT, BigNumber(100e18), BigNumber(400000e18), accounts[0]);
            // await addLiquidate(addressJson.DEMA, addressJson.USDT, BigNumber(250000e18), BigNumber(500000e18), accounts[0]);
            setDex("Mdx");  // 0.5U
            await addLiquidate(addressJson.Mdx, addressJson.USDT, BigNumber(20000e18), BigNumber(10000e18), accounts[0]);
            
            setDex("Cake"); // 1U
            await addLiquidate(addressJson.Cake, addressJson.USDT, BigNumber(10000e18), BigNumber(10000e18), accounts[0]);
        } else {
            throw new Error("Network not support");
        }
    }

    fun().then(callback);
}

module.exports = mdxInit;