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
    saveLogToFile,
    initFile,
    getStates,
    setNetwork,
    toWei,
} = require('../js_utils/utils.js');
const {addressJson, name2Address, address2Name} = setNetwork('bsctest')

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
        
        const file = `scripts/log/status.json`;
        initFile(file);

        let posId = 4;

        let bank = await Bank.at(addressJson.Bank);
        let info = await bank.positionInfo(posId);
        let prodId = info[0];
        let owner = info[5];
        
        console.log(`Prod id is ${prodId}, owner is ${owner}`)
        
        let tokensName = addressJson[`MdxProd${prodId}Tokens`];

        let status = await getStates(posId, owner, tokensName);
        console.log(`Get status success`);
        saveLogToFile(file, `Pos ${posId}, Token: ${tokensName}, Owner: ${owner}`, status)
    }

    fun().then(callback);
}

module.exports = openPosition;