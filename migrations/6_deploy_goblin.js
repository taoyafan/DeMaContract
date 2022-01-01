const Farm = artifacts.require("Farm");
const Bank = artifacts.require("Bank");
const{ time } = require('@openzeppelin/test-helpers');

const { assert } = require('console');
let {saveToJson, readAddressJson} = require('../js_utils/jsonRW.js');
let {getProdInfo} = require('../js_utils/config.js');

const {
    bnbAddress,
    MaxUint256,
    getDexRelatedName,
    getDexRelatedAddress,
    getDexRelatedContract,
    getContractInstance,
    setDex,
    setNetwork,
    createPair,
    getPair,
    addLiquidate,
} = require("../js_utils/utils");
const [gFName, gFAddress, gFContract] = [getDexRelatedName, getDexRelatedAddress, getDexRelatedContract];

module.exports = async function (deployer, network, accounts) {

    const { addressJson } = setNetwork(network, web3);

    assert(network == 'development' || network == 'bsctest')

    let farm = await Farm.at(addressJson.Farm);
    
    for (let dex of ["Mdx", "Cake"]) {
        setDex(dex);

        const productions = getProdInfo(network, dex);
        
        const reinvestment = await deployer.deploy(
            gFContract("Reinvestment"), 
            gFAddress("BoardRoom"), 
            gFName("BoardRoomPoolId"), 
            gFAddress("DexToken"), 
            2000
        );

        const withdrawStrategy = await deployer.deploy(
            gFContract("StrategyWithdrawMinimizeTrading"), gFAddress("Router"));
        const addStrategy = await deployer.deploy(
            gFContract("StrategyAddTwoSidesOptimal"), gFAddress("Router"));
    
        saveToJson(gFName("Reinvestment"), reinvestment.address, network);
        saveToJson(gFName("StrategyWithdrawMinimizeTrading"), withdrawStrategy.address, network);
        saveToJson(gFName("StrategyAddTwoSidesOptimal"), addStrategy.address, network);
    
        for (prod of productions) {
    
            prod.farmPoolId = await farm.nextPoolId();
            
            // Get dex pool id
            prod.dexPoolId = gFAddress("PoolId", [prod.token0, prod.token1]);
    
            // Deploy
            prod.goblin = await deployer.deploy(
                gFContract("Goblin"),
                addressJson.Bank,
                addressJson.Farm,
                prod.farmPoolId,                     // Farm pool id, Goblin begin from 100
                reinvestment.address,
                gFAddress("DexPool"),
                prod.dexPoolId,                      // Bsc pool id
                gFAddress("Router"),
                gFAddress("DexToken"),
                prod.token0Address,                  // Token0 address
                prod.token1Address,                  // Token1 address
                withdrawStrategy.address
            );
    
            // The order of token are same as production.borrowToken in Bank.
            // When call opPosition the order of borrows is same as this tokens. 
            saveToJson(gFName("Goblin", [prod.token0, prod.token1]), prod.goblin.address, network);
    
            // Set strategy ok, StrategyWithdrawMinimizeTrading will be set true when deploy
            prod.goblin.setStrategyOk([addStrategy.address], true)
            
            // farm add pool 
            // rewardFirstPeriod, leftPeriodTimes = 23, periodDuration = 1 month, 
            // leftRatioNextPeriod = 90, operator = goblin address.
            await farm.addPool(prod.rewardFirstPeriod, 23, time.duration.days(30), 90, prod.goblin.address);
            saveToJson(gFName("FarmPoolId", [prod.token0, prod.token1]), +prod.farmPoolId, network);
    
            // bank add production
            const bank = await Bank.at(addressJson.Bank);
            await bank.opProduction(
                0,                                          // uint256 pid,
                true,                                       // bool isOpen,
                [true, true],                               // bool[2] calldata canBorrow,
                [prod.token0Address, prod.token1Address],   // address[2] calldata borrowToken,
                prod.goblin.address,                        // address goblin,
                [10000, 10000],                             // uint256[2] calldata minDebt,
                9000,                                       // uint256 openFactor,
                6000,                                       // uint256 liquidateFactor
            );
            prod.prodId = (await bank.currentProdId()) - 1;
            saveToJson(gFName("ProdId", [prod.token0, prod.token1]), prod.prodId, network);
            saveToJson(gFName("ProdId", [prod.token1, prod.token0]), prod.prodId, network);
    
            // The order of tokens are same as production.borrowToken in Bank.
            // When call opPosition the order of borrows is same as this tokens. 
            saveToJson(gFName("ProdTokens", prod.prodId), [prod.token0, prod.token1], network);
        
        } // for (prod of productions)
    } // for (let dex of ["Mdx", "Cake"]) 
};
