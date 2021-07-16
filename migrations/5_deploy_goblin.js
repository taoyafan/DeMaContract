const MdxStrategyWithdrawMinimizeTrading = artifacts.require("MdxStrategyWithdrawMinimizeTrading");
const MdxGoblin = artifacts.require("MdxGoblin");
const Reinvestment = artifacts.require("Reinvestment");
const Farm = artifacts.require("Farm");
const BSCPool = artifacts.require("BSCPool");
const MdexRouter = artifacts.require("MdexRouter");
const MdxToken = artifacts.require("MdxToken");

const fs = require('fs')

module.exports = async function (deployer, network, accounts) {

    const jsonString = fs.readFileSync("bin/contracts/address.json")
    const addressJson = JSON.parse(jsonString)

    const MdxGoblinBnbUsdt = await deployer.deploy(
        MdxGoblin,
        Farm.address,
        100,                    // Farm pool id, Goblin begin from 100
        Reinvestment.address,
        BSCPool.address,
        4,                      // Bsc pool id
        MdexRouter.address,
        MdxToken.address,
        "0x0000000000000000000000000000000000000000",   // Token0   bnb
        addressJson.USDT,                               // Token1   usdt
        MdxStrategyWithdrawMinimizeTrading.address
    );

    const MdxGoblinMdxUsdt = await deployer.deploy(
        MdxGoblin,
        Farm.address,
        101,                    // Farm pool id, Goblin begin from 100
        Reinvestment.address,
        BSCPool.address,
        4,                      // Bsc pool id
        MdexRouter.address,
        MdxToken.address,
        MdxToken.address,                               // Token0   mdx
        addressJson.USDT,                               // Token1   usdt
        MdxStrategyWithdrawMinimizeTrading.address
    );

    saveToJson("MdxGoblinBnbUsdt", MdxGoblinBnbUsdt.address);
    saveToJson("MdxGoblinMdxUsdt", MdxGoblinMdxUsdt);
};
