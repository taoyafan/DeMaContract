'use strict'

const fs = require('fs')
const BigNumber = require("bignumber.js");
const{ shouldFail, time } = require('@openzeppelin/test-helpers');

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

        let bnbAddress = "0x0000000000000000000000000000000000000000";
        
        // Read address
        const jsonString = fs.readFileSync("bin/contracts/address.json")
        const addressJson = JSON.parse(jsonString)

        // Get instance
        bank = await Bank.deployed();
        bankFarm = await Farm.at(addressJson.BankFarm);
        dema = await DEMA.deployed();
        let mdx = await MdxToken.deployed();

        
        // Init Farm
        let bnbPoolId = 0;
        // rewardFirstPeriod = 7680*30, leftPeriodTimes = 23, periodDuration = 1 month, 
        // leftRatioNextPeriod = 90, operator = Bank address.
        bankFarm.addPool(BigNumber(19200*30).multipliedBy(1e18), 23, time.duration.days(30), 90, bank.address);

        await time.advanceBlock();
        let blockNum = await web3.eth.getBlockNumber();
        console.log("bnb pool added block: " + blockNum);
        let bnbFarmTime = (await web3.eth.getBlock(blockNum)).timestamp;
        console.log("Block time stamp: " + bnbFarmTime)
        bnbFarmTime = await time.latest();
        console.log("time.latest(): " + bnbFarmTime);
        
        let usdtPoolId = 1;
        // rewardFirstPeriod = 7680*30, leftPeriodTimes = 23, periodDuration = 1 month, 
        // leftRatioNextPeriod = 90, operator = Bank address.
        bankFarm.addPool(BigNumber(15360*30).multipliedBy(1e18), 23, time.duration.days(30), 90, bank.address);

        blockNum = await web3.eth.getBlockNumber();
        console.log("usdt pool added block: " + blockNum);
        let usdtFarmTime = (await web3.eth.getBlock(blockNum)).timestamp;
        console.log("Block time stamp: " + usdtFarmTime);
        usdtFarmTime = await time.latest()
        console.log("time.latest(): " + usdtFarmTime);

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
            bankFarm, dema, setReserveBps, setLiquidateBps, bnbAddress];
    };

    return fun();
}

module.exports = bankInit;