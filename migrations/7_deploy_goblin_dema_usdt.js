const BigNumber = require("bignumber.js");

const Farm = artifacts.require("Farm");
const Bank = artifacts.require("Bank");
const{ time } = require('@openzeppelin/test-helpers');

let {saveToJson} = require('../js_utils/jsonRW.js');

const {
    getDexRelatedName,
    getDexRelatedAddress,
    getDexRelatedContract,
    getContractInstance,
    setDex,
    setNetwork,
} = require("../js_utils/utils");
const [gFName, gFAddress, gFContract, gFInstance] = 
    [getDexRelatedName, getDexRelatedAddress, getDexRelatedContract, getContractInstance];

const migrateTable = {
    allDexs: ["Cake"],
    withdrawStrategy:   false,
    addStrategy:        false,
    goblin:             true,
    openNewProd:        false,
}

const prod = {
    token0: "Dema",
    token1: "Usdt",
    rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18),
}

module.exports = async function (deployer, network, accounts) {

    const { addressJson } = setNetwork(network, web3);

    let farm = await Farm.at(addressJson.Farm);
    
    for (let dex of migrateTable.allDexs) {
        setDex(dex);
        console.log(`Begin to add goblin of ${dex}`);
        
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
    
        console.log(`Begin to add goblin of ${prod.token0} and ${prod.token1}`);
        
        if (migrateTable.goblin) {

            prod.farmPoolId = await farm.nextPoolId();
            console.log(`Get next farm pool id: ${prod.farmPoolId}`);
            
            // Get token address
            prod.token0Address = addressJson[prod.token0];
            prod.token1Address = addressJson[prod.token1];
            
            // Deploy
            await deployer.deploy(
                gFContract("GoblinWithoutDexPool"),
                addressJson.Bank,
                addressJson.Farm,
                prod.farmPoolId,                     // Farm pool id
                gFAddress("Router"),
                gFAddress("DexToken"),
                prod.token0Address,                  // Token0 address
                prod.token1Address,                  // Token1 address
                withdrawStrategy.address
            );
            prod.goblin = await gFContract("GoblinWithoutDexPool").deployed();
            // The order of token are same as production.borrowToken in Bank.
            // When call opPosition the order of borrows is same as this tokens. 
            saveToJson(gFName("GoblinWithoutDexPool", [prod.token0, prod.token1]), prod.goblin.address, network);
            console.log(`Migrate ${gFName("GoblinWithoutDexPool", [prod.token0, prod.token1])} succeed`);
            
            // farm add pool 
            // rewardFirstPeriod, leftPeriodTimes = 23, periodDuration = 1 month, 
            // leftRatioNextPeriod = 90, operator = goblin address.
            await farm.addPool(prod.rewardFirstPeriod, 23, time.duration.days(30), 90, prod.goblin.address);
            saveToJson(gFName("FarmPoolId", [prod.token0, prod.token1]), +prod.farmPoolId, network);
            console.log(`Farm add pool succeed`);
    
            // bank add production
            const bank = await Bank.at(addressJson.Bank);

            if (migrateTable.openNewProd) {
                prod.prodId = await bank.currentProdId();
                saveToJson(gFName("ProdId", [prod.token0, prod.token1]), prod.prodId, network);
                saveToJson(gFName("ProdId", [prod.token1, prod.token0]), prod.prodId, network);
            } else {
                prod.prodId = gFAddress("ProdId", [prod.token0, prod.token1]);
            }
            console.log(`Opening prod with id ${prod.prodId}`);

            await bank.opProduction(
                migrateTable.openNewProd ? 0 : prod.prodId, // uint256 pid,
                true,                                       // bool isOpen,
                [false, false],                             // bool[2] calldata canBorrow,
                [prod.token0Address, prod.token1Address],   // address[2] calldata borrowToken,
                prod.goblin.address,                        // address goblin,
                [0, 0],                                     // uint256[2] calldata minDebt,
                0,                                          // uint256 openFactor,
                0,                                          // uint256 liquidateFactor
            );

            console.log(`opProduction succeed, prod id is ${prod.prodId}`);
    
            // The order of tokens are same as production.borrowToken in Bank.
            // When call opPosition the order of borrows is same as this tokens. 
            saveToJson(gFName("ProdTokens", prod.prodId), [prod.token0, prod.token1], network);
        } else {
            prod.goblin = await gFInstance("GoblinWithoutDexPool", [prod.token0, prod.token1]);
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
        
    } // for (let dex of ["Mdx", "Cake"]) 
};
