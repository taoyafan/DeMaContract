'use strict'

const fs = require('fs')

const UserProfile = artifacts.require("UserProfile.sol");
const TripleSlopeModel = artifacts.require("TripleSlopeModel");
const BankConfig = artifacts.require("BankConfig");
const Bank = artifacts.require("Bank");
const DEMA = artifacts.require("DEMA");
const Farm = artifacts.require("Farm");
const ERC20Token = artifacts.require("ERC20Token");

function bankInit(callback) {

    async function fun() {
        // Each contract instance
        let interestModel;
        let bankConfig;
        let bank;
        let usdt;
        let busd;
        let bankFarm;
        let dema;

        // parameters
        let setReserveBps = 1000;   // 10% 
        let setLiquidateBps = 1000;     // 10%
        let bnbAddress = "0x0000000000000000000000000000000000000000";
        
        // Read address
        const jsonString = fs.readFileSync("bin/contracts/address.json")
        const addressJson = JSON.parse(jsonString)

        // Get instance
        interestModel = await TripleSlopeModel.deployed();
        bankConfig = await BankConfig.deployed();
        bank = await Bank.deployed();
        bankFarm = await Farm.at(addressJson.BankFarm);
        dema = await DEMA.deployed();

        // Add minter of dema for farm.
        dema.addMinter(bankFarm.address);
        
        // Init Farm
        let bnbPoolId = 0;
        // rewardFirstPeriod = 7680*30, leftPeriodTimes = 23, periodDuration = 1 month, 
        // leftRatioNextPeriod = 90, operator = Bank address.
        bankFarm.addPool(19200*30, 23, 60*60*24*30, 90, bank.address);

        let blockNum = await web3.eth.getBlockNumber();
        console.log("bnb pool added block: " + blockNum);
        let bnbFarmTime = web3.eth.getBlock(blockNum).timestamp;
        
        let usdtPoolId = 1;
        // rewardFirstPeriod = 7680*30, leftPeriodTimes = 23, periodDuration = 1 month, 
        // leftRatioNextPeriod = 90, operator = Bank address.
        bankFarm.addPool(15360*30, 23, 60*60*24*30, 90, bank.address);

        blockNum = await web3.eth.getBlockNumber();
        console.log("usdt pool added block: " + blockNum);
        let usdtFarmTime = web3.eth.getBlock(blockNum).timestamp;

        // Init usdt, busd
        {
            const networkId = await web3.eth.net.getId();

            // development
            if (networkId == 666) {
                usdt = await ERC20Token.at(addressJson.USDT);
                busd = await ERC20Token.at(addressJson.BUSD);
                
            // bsctest
            } else if(networkId == 97) {
                usdt = await ERC20Token.at("0x337610d27c682E347C9cD60BD4b3b107C9d34dDd");
                busd = await ERC20Token.at("0xed24fc36d5ee211ea25a80239fb8c4cfd80f12ee");
                
            } else {
                throw new Error('Undefined network');
            }
        }

        // Init Bank.
        await bankConfig.setParams(setReserveBps, setLiquidateBps, interestModel.address);
        await bank.updateConfig(bankConfig.address);
        await bank.addToken(bnbAddress, bnbPoolId);
        await bank.addToken(usdt.address, usdtPoolId);

        if(callback) {
            callback();
        }

        return [interestModel, bankConfig, bank, usdt, busd, bnbPoolId, bnbFarmTime, usdtPoolId, usdtFarmTime,
            bankFarm, setReserveBps, setLiquidateBps, bnbAddress];
    };

    return fun();
}

module.exports = bankInit;