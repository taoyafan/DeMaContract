const MdexFactory = artifacts.require("MdexFactory");
const WBNB = artifacts.require("WBNB");
const ERC20Token = artifacts.require("ERC20Token");
const MdexPair = artifacts.require("MdexPair");

const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 30 })

const { assert } = require('console');
let {saveToJson, readAddressJson} = require('../js_utils/jsonRW.js');
let {getProdInfo} = require('../js_utils/config.js');
const bnbAddress = '0x0000000000000000000000000000000000000000'

const addressJson = readAddressJson('bsctest')

function mdxInit(callback) {

    async function fun() {
        const networkId = await web3.eth.net.getId();
        assert(networkId == 97)
        const accounts = await web3.eth.getAccounts();
        await addLiquidate(bnbAddress, addressJson.USDT, BigNumber(5e18), BigNumber(2000e18), accounts[0]);
        await addLiquidate(addressJson.BTC, addressJson.USDT, BigNumber(10e18), BigNumber(500000e18), accounts[0]);
        await addLiquidate(addressJson.ETH, addressJson.USDT, BigNumber(100e18), BigNumber(400000e18), accounts[0]);
    }

    fun().then(callback);
}

async function addLiquidate(token0, token1, r0, r1, from) {
    let wbnb = await WBNB.at(addressJson.WBNB);
    if (token0 == bnbAddress) {
        token0 = addressJson.WBNB
        await wbnb.deposit({from: from, value: r0})
    } else if (token1 == bnbAddress) {
        token1 = addressJson.WBNB
        await wbnb.deposit({from: from, value: r1})
    }

    // let router = await MdexRouter.at(addressJson.MdexRouter);
    // await approve(token0, router.address, r0, from)
    // await approve(token1, router.address, r1, from)

    let factory = await MdexFactory.at(addressJson.MdexFactory);
    let lpAddress = await factory.getPair(token0, token1);
    let lp = await MdexPair.at(lpAddress)
    await transfer(token0, lpAddress, r0, from)
    await transfer(token1, lpAddress, r1, from)
    await lp.mint(from)
}


async function approve(tokenAddress, to, amount, from) {
    if (tokenAddress == bnbAddress)
        return

    let token = await ERC20Token.at(tokenAddress);
    await token.approve(to, amount, {from: from});
}

async function transfer(tokenAddress, to, amount, from) {
    if (tokenAddress == bnbAddress) {
        await web3.eth.sendTransaction({from: from, to: to, value: amount})
    } else {
        let token = await ERC20Token.at(tokenAddress);
        await token.transfer(to, amount, {from: from});
    }
}

module.exports = mdxInit;