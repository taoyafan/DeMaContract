global.artifacts = artifacts

const { assert } = require('console');
let {
    bnbAddress,
    setNetwork,
    removeAllLiquidity,
} = require('../js_utils/utils.js');
const {addressJson} = setNetwork('bsctest')

function main(callback) {

    async function fun() {
        const networkId = await web3.eth.net.getId();
        assert(networkId == 97)
        const accounts = await web3.eth.getAccounts();
        
        await removeAllLiquidity(bnbAddress, addressJson.USDT, accounts[0]);
    }

    fun().then(callback);
}

module.exports = main;