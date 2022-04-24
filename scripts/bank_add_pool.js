global.artifacts = artifacts

const Bank = artifacts.require("Bank");
const Farm = artifacts.require("Farm");

const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 30 })

let {saveToJson} = require('../js_utils/jsonRW.js');
let {getBanksInfo} = require('../js_utils/config.js');
const{ time } = require('@openzeppelin/test-helpers');

let {
    bnbAddress,
    MaxUint256,
    setDex,
    setNetwork,
    toWei,
    networkId2Name,
} = require('../js_utils/utils.js');

// Note: set network here 
const network = 'bsctest';
setDex('Cake');
const {addressJson, name2Address} = setNetwork(network, web3)

function bankAddPool(callback) {

    async function fun() {
        try {

            const networkId = await web3.eth.net.getId();

            if (networkId2Name(networkId) == network)
            {
                const accounts = await web3.eth.getAccounts();
                const farm = await Farm.at(addressJson.Farm);
                const bank = await Bank.at(addressJson.Bank);
                
                let banksInfo = getBanksInfo(network);
                console.log(`banksInfo length: ${banksInfo.length}`);

                let farmId = await farm.nextPoolId();
            
                for (info of banksInfo) {
                    let tokenFarmId = farmId;

                    if (info.rewardFirstPeriod) {
                        tokenFarmId = farmId;
                        await farm.addPool(info.rewardFirstPeriod, 23, time.duration.days(30), 90, bank.address);
                        console.log(`Farm add pool ${farmId} success`)
                        ++farmId;
                    } else {
                        tokenFarmId = 0; // Farm pool 0 doesn't has reward.
                    }

                    console.log(`Next farm id is: ${tokenFarmId}`);
                    await bank.addToken(addressJson[info.token], tokenFarmId);
                    console.log(`addToken for ${info.token} succeed`);

                    saveToJson(`Bank${info.token}FarmPoolId`, tokenFarmId, network);
                    
                } // for (info of banksInfo)

            } else {
                throw new Error("Network not support");
            }
            
        } catch(err) {
            console.error(err)
        }
    }

    fun().then(callback);
}

module.exports = bankAddPool;