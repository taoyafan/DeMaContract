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
const [gFName, gFAddress, gFContract, gFInstance] = 
    [getDexRelatedName, getDexRelatedAddress, getDexRelatedContract, getContractInstance];

const migrateTable = {
    allDexs: ["Cake"],
    reinvestment:       false,
    withdrawStrategy:   false,
    addStrategy:        false,

    // TODO when deploy goblin, need to add dex pool id in address.json
    goblin:             true,
}

module.exports = async function (deployer, network, accounts) {

    const { addressJson } = setNetwork(network, web3);

    let farm = await Farm.at(addressJson.Farm);
    
    for (let dex of migrateTable.allDexs) {
        setDex(dex);
        console.log(`Begin to add goblin of ${dex}`);

        const productions = getProdInfo(network, dex);
        
        let reinvestment;
        if (migrateTable.reinvestment) {
            await deployer.deploy(
                gFContract("Reinvestment"), 
                gFAddress("BoardRoom"), 
                gFName("BoardRoomPoolId"), 
                gFAddress("DexToken"), 
                2000
            );
            reinvestment = await gFContract("Reinvestment").deployed();
            saveToJson(gFName("Reinvestment"), reinvestment.address, network);
        } else {
            reinvestment = await gFInstance("Reinvestment");
        }
        console.log(`Migrate reinvestment succeed`);

        let withdrawStrategy
        if (migrateTable.withdrawStrategy) {
            await deployer.deploy(
                gFContract("StrategyWithdrawMinimizeTrading"), gFAddress("Router"));
            withdrawStrategy = await gFContract("StrategyWithdrawMinimizeTrading").deployed();
            saveToJson(gFName("StrategyWithdrawMinimizeTrading"), withdrawStrategy.address, network);
        } else {
            withdrawStrategy = await gFInstance("StrategyWithdrawMinimizeTrading");
        }
        console.log(`Migrate withdrawStrategy succeed`);

        let addStrategy;
        if (migrateTable.addStrategy) {
            await deployer.deploy(
                gFContract("StrategyAddTwoSidesOptimal"), gFAddress("Router"));
            addStrategy = await gFContract("StrategyAddTwoSidesOptimal").deployed();
            saveToJson(gFName("StrategyAddTwoSidesOptimal"), addStrategy.address, network);
        } else {
            addStrategy = await gFInstance("StrategyAddTwoSidesOptimal");
        }
        console.log(`Migrate addStrategy succeed`);
    
        for (prod of productions) {
            console.log(`Begin to add goblin of ${prod.token0} and ${prod.token1}`);
            
            if (migrateTable.goblin) {

                prod.farmPoolId = await farm.nextPoolId();
                console.log(`Get next farm pool id: ${prod.farmPoolId}`);
                
                // Get dex pool id
                prod.dexPoolId = gFAddress("PoolId", [prod.token0, prod.token1]);
                
                // Get token address
                prod.token0Address = addressJson[prod.token0];
                prod.token1Address = addressJson[prod.token1];
                
                // Deploy
                await deployer.deploy(
                    gFContract("Goblin"),
                    addressJson.Bank,
                    addressJson.Farm,
                    prod.farmPoolId,                     // Farm pool id
                    reinvestment.address,
                    gFAddress("DexPool"),
                    prod.dexPoolId,                      // Bsc pool id
                    gFAddress("Router"),
                    gFAddress("DexToken"),
                    prod.token0Address,                  // Token0 address
                    prod.token1Address,                  // Token1 address
                    withdrawStrategy.address
                );
                prod.goblin = await gFContract("Goblin").deployed();
                // The order of token are same as production.borrowToken in Bank.
                // When call opPosition the order of borrows is same as this tokens. 
                saveToJson(gFName("Goblin", [prod.token0, prod.token1]), prod.goblin.address, network);
                console.log(`Migrate ${gFName("Goblin", [prod.token0, prod.token1])} succeed`);
                
                // farm add pool 
                // rewardFirstPeriod, leftPeriodTimes = 23, periodDuration = 1 month, 
                // leftRatioNextPeriod = 90, operator = goblin address.
                await farm.addPool(prod.rewardFirstPeriod, 23, time.duration.days(30), 90, prod.goblin.address);
                saveToJson(gFName("FarmPoolId", [prod.token0, prod.token1]), +prod.farmPoolId, network);
                console.log(`Farm add pool succeed`);
        
                // bank add production
                const bank = await Bank.at(addressJson.Bank);
                prod.prodId = await bank.currentProdId();
                saveToJson(gFName("ProdId", [prod.token0, prod.token1]), prod.prodId, network);
                saveToJson(gFName("ProdId", [prod.token1, prod.token0]), prod.prodId, network);
                
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

                console.log(`opProduction succeed, prod id is ${prod.prodId}`);
        
                // The order of tokens are same as production.borrowToken in Bank.
                // When call opPosition the order of borrows is same as this tokens. 
                saveToJson(gFName("ProdTokens", prod.prodId), [prod.token0, prod.token1], network);
            } else {
                prod.goblin = await gFInstance("Goblin", [prod.token0, prod.token1]);
            }
    
            if (migrateTable.goblin || migrateTable.addStrategy) {
                // Set strategy ok, StrategyWithdrawMinimizeTrading will be set true when deploy
                await prod.goblin.setStrategyOk([addStrategy.address], true)
                console.log(`setStrategyOk of addStrategy succeed`);
            }

            if ((!migrateTable.goblin) && migrateTable.withdrawStrategy) {
                // Didn't migrate goblin but migrate withdraw strategy, need to set ok.
                await prod.goblin.setStrategyOk([withdrawStrategy.address], true)
                console.log(`setStrategyOk of withdrawStrategy succeed`);
            }
        
        } // for (prod of productions)
    } // for (let dex of ["Mdx", "Cake"]) 
};
