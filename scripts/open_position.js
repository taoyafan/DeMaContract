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
    setDex,
    setNetwork,
    toWei,
    networkId2Name,
} = require('../js_utils/utils.js');

// TODO need to set network and DEX
const network = 'bscmain';
setDex('Cake');
const {addressJson, name2Address} = setNetwork(network, web3)

const { createPosition }= require('../js_utils/prod_interface.js');

const { 
    bankDeposit,
    bankWithdraw,
    logBankUserInfo,    
}= require('../js_utils/lend_interface.js');

function openPosition(callback) {

    async function fun() {
        try {
            const networkId = await web3.eth.net.getId();
            if (networkId2Name(networkId) == network)
            {
                const accounts = await web3.eth.getAccounts();
                
                // await bankDeposit('Bnb', toWei(0.05), accounts[0]);
                // await bankDeposit('Busd', toWei(2), accounts[0]);
                // await bankDeposit('Usdt', toWei(20), accounts[0]);
                // await bankDeposit('Eth', toWei(4), accounts[0]);
                // await bankDeposit('Btc', toWei(5), accounts[0]);
                
                const amounts = [0.05, 20].map(b => toWei(b))
                const borrows = [0, 0].map(b => toWei(b))
                const posId = await createPosition(['Bnb', 'Usdt'], accounts[0], amounts, borrows, 0);
                console.log(`Create pos succeed, pos id is ${posId}`);
            } else {
                throw new Error("Network not support");
            }
            
        } catch(err) {
            console.error(err)
        }
    }

    fun().then(callback);
}

module.exports = openPosition;