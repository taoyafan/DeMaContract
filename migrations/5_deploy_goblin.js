const MdxStrategyWithdrawMinimizeTrading = artifacts.require("MdxStrategyWithdrawMinimizeTrading");
const MdxStrategyAddTwoSidesOptimal = artifacts.require("MdxStrategyAddTwoSidesOptimal");
const MdxGoblin = artifacts.require("MdxGoblin");
const Reinvestment = artifacts.require("Reinvestment");
const Farm = artifacts.require("Farm");
const Bank = artifacts.require("Bank");
const{ time } = require('@openzeppelin/test-helpers');

const { assert } = require('console');
let {saveToJson, readAddressJson} = require('../js_utils/jsonRW.js');
let {getProdInfo} = require('../js_utils/config.js');

module.exports = async function (deployer, network, accounts) {

    const addressJson = readAddressJson(network)

    assert(network == 'development' || network == 'bsctest')

    let productions = getProdInfo(network);

    await deployer.deploy(Reinvestment, addressJson.BoardRoomMDX, 4, addressJson.MdxToken, 2000);
    await deployer.deploy(MdxStrategyWithdrawMinimizeTrading, addressJson.MdexRouter);
    await deployer.deploy(MdxStrategyAddTwoSidesOptimal, addressJson.MdexRouter);

    saveToJson(`Reinvestment`, Reinvestment.address, network);
    saveToJson(`MdxStrategyWithdrawMinimizeTrading`, MdxStrategyWithdrawMinimizeTrading.address, network);
    saveToJson(`MdxStrategyAddTwoSidesOptimal`, MdxStrategyAddTwoSidesOptimal.address, network);

    let farm = await Farm.at(addressJson.Farm);

    for (prod of productions) {

        prod.farmPoolId = await farm.nextPoolId();
        
        // Get mdx pool id
        prod.mdxPoolId = addressJson[`Mdx${prod.token0}${prod.token1}PoolId`];

        // Deploy
        prod.goblin = await deployer.deploy(
            MdxGoblin,
            addressJson.Bank,
            addressJson.Farm,
            prod.farmPoolId,                     // Farm pool id, Goblin begin from 100
            Reinvestment.address,
            addressJson.BSCPool,
            prod.mdxPoolId,                      // Bsc pool id
            addressJson.MdexRouter,
            addressJson.MdxToken,
            prod.token0Address,                  // Token0 address
            prod.token1Address,                  // Token1 address
            MdxStrategyWithdrawMinimizeTrading.address
        );

        saveToJson(`Mdx${prod.token0}${prod.token1}Goblin`, prod.goblin.address, network);

        // Set strategy ok, MdxStrategyWithdrawMinimizeTrading will be set true when deploy
        prod.goblin.setStrategyOk([MdxStrategyAddTwoSidesOptimal.address], true)
        
        // farm add pool 
        // rewardFirstPeriod, leftPeriodTimes = 23, periodDuration = 1 month, 
        // leftRatioNextPeriod = 90, operator = goblin address.
        await farm.addPool(prod.rewardFirstPeriod, 23, time.duration.days(30), 90, prod.goblin.address);
        saveToJson(`Mdx${prod.token0}${prod.token1}FarmPoolId`, +prod.farmPoolId, network);

        // bank add production
        bank = await Bank.at(addressJson.Bank);
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
        saveToJson(`Mdx${prod.token0}${prod.token1}ProdId`, prod.prodId, network);
        saveToJson(`Mdx${prod.token1}${prod.token0}ProdId`, prod.prodId, network);

        saveToJson(`MdxProd${prod.prodId}Tokens`, [prod.token0, prod.token1], network);
    }
};
