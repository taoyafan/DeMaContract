global.artifacts = artifacts

const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 30 })

const { assert } = require('console');
let {
    bnbAddress,
    MaxUint256,
    setNetwork,
    fromWei,
} = require('../js_utils/utils.js');
const {addressJson, name2Address} = setNetwork('bsctest')

const getAbi = require(`../js_utils/get_abi_address`)

async function getPrice(tokenAddr, USDTAddr) {
    if (tokenAddr == bnbAddress) {
        tokenAddr = addressJson.WBNB;
    }
    
    const mdexFactoryAbi = getAbi(`MdexFactory`);
    const mdexPairAbi = getAbi(`MdexPair`);

    const factory = new web3.eth.Contract(mdexFactoryAbi, addressJson.MdexFactory);
    const lpAddr = await factory.methods.getPair(tokenAddr, USDTAddr).call();
    assert(lpAddr != bnbAddress); // Lp must exist

    const lp = new web3.eth.Contract(mdexPairAbi, lpAddr);
    const token0 = await lp.methods.token0().call();

    const rs = await lp.methods.getReserves().call();
    let rToken = BigNumber(rs[0]);
    let rUSDT = BigNumber(rs[1]);

    if (token0 == USDTAddr) {
        [rToken, rUSDT] = [rUSDT, rToken];
    }
    const tokenPrice = rUSDT.dividedBy(rToken);

    // Calculate lp price:
    const lpAmounts = await lp.methods.totalSupply().call();
    const lpPrice = rUSDT.multipliedBy(2).dividedBy(lpAmounts);

    console.log(`r_token is ${fromWei(rToken)}, r_usdt is ${fromWei(rUSDT)}, lp total is ${fromWei(lpAmounts)}`);

    return [tokenPrice, lpPrice]
}

function main(callback) {

    async function fun() {
        const networkId = await web3.eth.net.getId();
        assert(networkId == 97)

        const accounts = await web3.eth.getAccounts();
        
        tokenNames = ['Btc', 'Eth', 'Bnb', 'Dema']

        for (let name of tokenNames) {
            console.log(`------------------------------ ${name} ------------------------------`);
            let [tokenPrice, lpPrice] = await getPrice(name2Address[name], addressJson.USDT);
            console.log(`Token price is ${tokenPrice}, lp price is ${lpPrice}`);
        }
    }

    fun().then(callback);
}

module.exports = main;