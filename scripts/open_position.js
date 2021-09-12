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
} = require('../js_utils/utils.js');
const {addressJson, name2Address} = setNetwork('bsctest')

const { createPosition }= require('../js_utils/prod_interface.js');

function openPosition(callback) {

    async function fun() {
        const networkId = await web3.eth.net.getId();
        assert(networkId == 97)

        const accounts = await web3.eth.getAccounts();
        const bank = Bank.at(addressJson.Bank);
        
        let posId = await createPosition(['Bnb', 'Usdt'], accounts[0], [0.5, 200], [1, 200], 0)
    }

    fun().then(callback);
}

module.exports = openPosition;