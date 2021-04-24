'use strict'

const TripleSlopeModel = artifacts.require("TripleSlopeModel");
const BankConfig = artifacts.require("BankConfig");
const Bank = artifacts.require("Bank");
const USDT = artifacts.require("ERC20Token");

function bankInit(callback) {

    async function fun() {
        // Each contract instance
        let interestModel;
        let bankConfig;
        let bank;
        let usdt;

        // parameters
        let setReserveBps = 10000; 
        let setLiquidateBps = 10000;
        let ETHAddress = "0x0000000000000000000000000000000000000000";
        let USDTAddress;
        
        interestModel = await TripleSlopeModel.deployed();
        bankConfig = await BankConfig.deployed();
        bank = await Bank.deployed();

        const networkId = await web3.eth.net.getId();
        if (networkId == 666) {
            // development
            usdt = await USDT.deployed();
            usdt.setupDecimals(18);
        } else if(networkId == 256) {
            // hecotest
            usdt = await USDT.at("0x04F535663110A392A6504839BEeD34E019FdB4E0");
        } else if(networkId == 97) {
            // bsctest
            usdt = await USDT.at("0x337610d27c682E347C9cD60BD4b3b107C9d34dDd");
        } else {
            throw new Error('Undefined network');
        }

        USDTAddress = usdt.address;

        await bankConfig.setParams(setReserveBps, setLiquidateBps, interestModel.address);
        await bank.updateConfig(bankConfig.address);
        await bank.addToken(ETHAddress, "oBNB");
        await bank.addToken(USDTAddress, "oUSDT");

        if(callback) {
            callback();
        }

        return [interestModel, bankConfig, bank, usdt,
            setReserveBps, setLiquidateBps, ETHAddress, USDTAddress];
    };

    return fun();
}

module.exports = bankInit;