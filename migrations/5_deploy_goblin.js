const MdxStrategyWithdrawMinimizeTrading = artifacts.require("MdxStrategyWithdrawMinimizeTrading");
const MdxStrategyAddTwoSidesOptimal = artifacts.require("MdxStrategyAddTwoSidesOptimal");
const MdxGoblin = artifacts.require("MdxGoblin");
const Reinvestment = artifacts.require("Reinvestment");

const { assert } = require('console');
const fs = require('fs')
let saveToJson = require('./save_address_to_json.js')

module.exports = async function (deployer, network, accounts) {

    const jsonString = fs.readFileSync("bin/contracts/address.json")
    const addressJson = JSON.parse(jsonString)

    // TODO found the right mdx pool id.
    assert(network == 'development')

    productions = [
        {
            token0: "Bnb", 
            token1: "Busd", 
            token0Address: addressJson.WBNB,
            token1Address: addressJson.BUSD, 
            farmPoolId: 100,    // Goblin begin from 100
            mdxPoolId: 0,
        },
        {
            token0: "Mdx", 
            token1: "Busd", 
            token0Address: addressJson.MdxToken,
            token1Address: addressJson.BUSD, 
            farmPoolId: 101,
            mdxPoolId: 1,
        },
    ];

    await deployer.deploy(Reinvestment, addressJson.BoardRoomMDX, 4, addressJson.MdxToken, 1000);
    await deployer.deploy(MdxStrategyWithdrawMinimizeTrading, addressJson.MdexRouter);
    await deployer.deploy(MdxStrategyAddTwoSidesOptimal, addressJson.MdexRouter);

    saveToJson(`Reinvestment`, Reinvestment.address);
    saveToJson(`MdxStrategyWithdrawMinimizeTrading`, MdxStrategyWithdrawMinimizeTrading.address);
    saveToJson(`MdxStrategyAddTwoSidesOptimal`, MdxStrategyAddTwoSidesOptimal.address);

    for (prod of productions) {
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

        saveToJson(`MdxGoblin${prod.token0}${prod.token1}`, prod.goblin.address);
        saveToJson(`Mdx${prod.token0}${prod.token1}FarmPoolId`, prod.farmPoolId);
    }
};
