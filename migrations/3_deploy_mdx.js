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
let saveToJson = require('./save_address_to_json.js')

module.exports = async function (deployer, network, accounts) {
    
    const jsonString = fs.readFileSync("bin/contracts/address.json")
    const addressJson = JSON.parse(jsonString)
    const busdAddress = addressJson.BUSD;

    if (network == 'development') {
        await deployer.deploy(MdxToken)      // Mdex Token
        saveToJson("MdxToken", (await MdxToken.deployed()).address);

        await deployer.deploy(
                MdexFactory,            // Factory
                accounts[0]
        );
        saveToJson("MdexFactory", (await MdexFactory.deployed()).address);

        await deployer.deploy(WBNB);    // WBNB
        saveToJson("WBNB", (await WBNB.deployed()).address);

        await deployer.deploy(
                MdexRouter,             // MdexRouter, @todo need to setSwapMining
                MdexFactory.address,
                WBNB.address
        );
        saveToJson("MdexRouter", (await MdexRouter.deployed()).address);

        await deployer.deploy(
                Oracle,                 // Oracle
                MdexFactory.address
        );
        saveToJson("Oracle", (await Oracle.deployed()).address);

        await deployer.deploy(
                SwapMining,             // SwapMining
                MdxToken.address,
                MdexFactory.address,
                Oracle.address,
                MdexRouter.address,
                busdAddress,
                BigNumber(1e19),    //_mdxPerBlock,
                0                   // startBlock
        );
        saveToJson("SwapMining", (await SwapMining.deployed()).address);

        await deployer.deploy(
                BSCPool,                // BSCPool
                MdxToken.address,
                BigNumber(1e19),        //_mdxPerBlock, 10 mdx per block
                0                       // startBlock
        );
        saveToJson("BSCPool", (await BSCPool.deployed()).address);

        await deployer.deploy(
                BoardRoomMDX,
                MdxToken.address,
                1
        );
        saveToJson("BoardRoomMDX", (await BoardRoomMDX.deployed()).address);
        
        let factory = await MdexFactory.deployed();
        await factory.createPair(WBNB.address, busdAddress);
        await factory.createPair(MdxToken.address, busdAddress);

        // Add minter to BSC pool
        let mdx = await MdxToken.deployed();
        await mdx.addMinter(BSCPool.address);

        // Add wbnb-busd and mdx-busd pool to bsc pool
        let bscPool = await BSCPool.deployed();
        let wbnbBusdLp = await factory.getPair(WBNB.address, busdAddress);
        let mdxBusdLp = await factory.getPair(MdxToken.address, busdAddress);
        
        await bscPool.add(1000, wbnbBusdLp, false);
        await bscPool.add(1000, mdxBusdLp, false);

        saveToJson("MdxBnbBusdPoolId", 0);
        saveToJson("MdxMdxBusdPoolId", 1);
    }
};