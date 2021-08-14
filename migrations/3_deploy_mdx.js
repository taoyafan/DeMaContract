const WBNB = artifacts.require("WBNB");

const fs = require("fs");

const MdexRouter = artifacts.require("MdexRouter");
const MdxToken = artifacts.require("MdxToken");
const MdexFactory = artifacts.require("MdexFactory");
const SwapMining = artifacts.require("SwapMining");
const Oracle = artifacts.require("Oracle");
const BSCPool = artifacts.require("BSCPool");
const BoardRoomMDX = artifacts.require("BoardRoomMDX");

const BigNumber = require("bignumber.js");
let saveToJson = require('./save_address_to_json.js');
const MaxUint256 = BigNumber("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

module.exports = async function (deployer, network, accounts) {
    
    // TODO read correct address from different network
    const jsonString = fs.readFileSync("bin/contracts/address.json")
    const addressJson = JSON.parse(jsonString)
    const busdAddress = addressJson.BUSD;

    if (network == 'development' || network == 'bsctest') {
        await deployer.deploy(MdxToken)      // Mdex Token
        saveToJson("MdxToken", (await MdxToken.deployed()).address, network);

        await deployer.deploy(
            MdexFactory,            // Factory
            accounts[0]
        );
        saveToJson("MdexFactory", (await MdexFactory.deployed()).address, network);

        // Test network don't deploy wbnb
        let wbnb;
        if (network == 'development') {
            wbnb = await deployer.deploy(WBNB);    // WBNB
            saveToJson("WBNB", wbnb.address, network);
        } else {
            wbnb = await WBNB.at(addressJson.WBNB)
        }

        await deployer.deploy(
            MdexRouter,             // MdexRouter, @todo need to setSwapMining
            MdexFactory.address,
            wbnb.address
        );
        saveToJson("MdexRouter", (await MdexRouter.deployed()).address, network);

        await deployer.deploy(
            Oracle,                 // Oracle
            MdexFactory.address
        );
        saveToJson("Oracle", (await Oracle.deployed()).address, network);

        await deployer.deploy(
            SwapMining,             // SwapMining
            MdxToken.address,
            MdexFactory.address,
            Oracle.address,
            MdexRouter.address,
            busdAddress,
            BigNumber(1e18),    //_mdxPerBlock,
            0                   // startBlock
        );
        saveToJson("SwapMining", (await SwapMining.deployed()).address, network);

        await deployer.deploy(
            BSCPool,                // BSCPool
            MdxToken.address,
            BigNumber(1e18),        //_mdxPerBlock, 1 mdx per block
            0                       // startBlock
        );
        saveToJson("BSCPool", (await BSCPool.deployed()).address, network);

        let rewardsPerCycle = BigNumber(1e17);
        let cycles = 1000;
        let boardRoom = await deployer.deploy(
            BoardRoomMDX,
            MdxToken.address,
            cycles       // how many
        );
        saveToJson("BoardRoomMDX", (await BoardRoomMDX.deployed()).address, network);

        // BoardRoom add pool
        let mdxToken = await MdxToken.deployed();
        let blockNum = await web3.eth.getBlockNumber();
        await mdxToken.approve(boardRoom.address, MaxUint256);
        await boardRoom.newReward(rewardsPerCycle.multipliedBy(cycles), rewardsPerCycle, +blockNum+1);

        await boardRoom.add(0, mdxToken.address, false);
        await boardRoom.add(0, mdxToken.address, false);
        await boardRoom.add(0, mdxToken.address, false);
        await boardRoom.add(0, mdxToken.address, false);
        await boardRoom.add(1000, mdxToken.address, false);     // MDX pool
        
        // Factory related operations
        let factory = await MdexFactory.deployed();
        await factory.createPair(wbnb.address, busdAddress);
        await factory.createPair(MdxToken.address, busdAddress);
        await factory.createPair(addressJson.USDT, busdAddress);

        // BSC pool related operations
        // - Add minter to BSC pool
        let mdx = await MdxToken.deployed();
        await mdx.addMinter(BSCPool.address);

        // - Add wbnb-busd and mdx-busd pool to bsc pool
        let bscPool = await BSCPool.deployed();
        let wbnbBusdLp = await factory.getPair(wbnb.address, busdAddress);
        let mdxBusdLp = await factory.getPair(MdxToken.address, busdAddress);
        let usdtBusdLp = await factory.getPair(addressJson.USDT, busdAddress);
        
        await bscPool.add(1000, wbnbBusdLp, false);
        await bscPool.add(1000, mdxBusdLp, false);
        await bscPool.add(1000, usdtBusdLp, false);

        saveToJson("MdxBnbBusdPoolId", 0, network);
        saveToJson("MdxMdxBusdPoolId", 1, network);
        saveToJson("MdxUsdtBusdPoolId", 2, network);
    }
};