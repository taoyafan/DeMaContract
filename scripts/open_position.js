global.artifacts = artifacts

const MdexFactory = artifacts.require("MdexFactory");
const WBNB = artifacts.require("WBNB");
const ERC20Token = artifacts.require("ERC20Token");
const MdexPair = artifacts.require("MdexPair");
const Bank = artifacts.require("Bank");

const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 30 })

const { assert } = require('console');
let {
    bnbAddress,
    MaxUint256,
    setNetwork,
    toWei,
} = require('../js_utils/utils.js');
const {addressJson, name2Address} = setNetwork('bsctest', web3)

const { createPosition }= require('../js_utils/prod_interface.js');

const { 
    bankDeposit,
    bankWithdraw,
    logBankUserInfo,    
}= require('../js_utils/lend_interface.js');

function openPosition(callback) {

    async function fun() {
        const networkId = await web3.eth.net.getId();
        assert(networkId == 97)

        const accounts = await web3.eth.getAccounts();
        
        await bankDeposit('Bnb', toWei(1), accounts[0]);
        await bankDeposit('Busd', toWei(2), accounts[0]);
        await bankDeposit('Usdt', toWei(3), accounts[0]);
        await bankDeposit('Eth', toWei(4), accounts[0]);
        await bankDeposit('Btc', toWei(5), accounts[0]);

        // await logBankUserInfo('Bnb', accounts[0]);
        // await logBankUserInfo('Busd', accounts[0]);
        // await logBankUserInfo('Usdt', accounts[0]);
        // await logBankUserInfo('Eth', accounts[0]);
        // await logBankUserInfo('Btc', accounts[0]);
        
        // let posId = await createPosition(['Bnb', 'Usdt'], accounts[0], [0.5, 100], [0.5, 100], 0);
    }

    fun().then(callback);
}

module.exports = openPosition;