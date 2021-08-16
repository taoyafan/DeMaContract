const WBNB = artifacts.require("WBNB");
const MdexRouter = artifacts.require("MdexRouter");
const MdxToken = artifacts.require("MdxToken");
const MdexFactory = artifacts.require("MdexFactory");
const SwapMining = artifacts.require("SwapMining");
const Oracle = artifacts.require("Oracle");
const BSCPool = artifacts.require("BSCPool");
const BoardRoomMDX = artifacts.require("BoardRoomMDX");

const BigNumber = require("bignumber.js");
let {saveToJson, readAddressJson} = require('../js_utils/jsonRW.js');
let {getProdInfo} = require('../js_utils/config.js');
const MaxUint256 = BigNumber("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

module.exports = async function (deployer, network, accounts) {
    
    if (network == 'development' || network == 'bsctest') {
        const addressJson = readAddressJson(network)
        const busdAddress = addressJson.BUSD;

        await deployer.deploy(MdxToken)      // Mdex Token
        saveToJson("MdxToken", MdxToken.address, network);

        await deployer.deploy(
            MdexFactory,            // Factory
            accounts[0]
        );
        saveToJson("MdexFactory", MdexFactory.address, network);

        // Test network don't deploy wbnb
        let wbnb;
        if (network == 'development') {
            wbnb = await deployer.deploy(WBNB);    // WBNB
            saveToJson("WBNB", wbnb.address, network);
        } else {
            wbnb = await WBNB.at(addressJson.WBNB)
        }

        let router = await deployer.deploy(
            MdexRouter,             // MdexRouter
            MdexFactory.address,
            wbnb.address
        );
        saveToJson("MdexRouter", router.address, network);

        await deployer.deploy(
            Oracle,                 // Oracle
            MdexFactory.address
        );
        saveToJson("Oracle", Oracle.address, network);

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
        saveToJson("SwapMining", SwapMining.address, network);
        
        // Set swap ming for router, TODO SwapMining need to config.
        await router.setSwapMining(SwapMining.address);

        await deployer.deploy(
            BSCPool,                // BSCPool
            MdxToken.address,
            BigNumber(1e18),        //_mdxPerBlock, 1 mdx per block
            0                       // startBlock
        );
        saveToJson("BSCPool", BSCPool.address, network);

        let rewardsPerCycle = BigNumber(1e17);
        let cycles = 1000;
        let boardRoom = await deployer.deploy(
            BoardRoomMDX,
            MdxToken.address,
            cycles       // how many
        );
        saveToJson("BoardRoomMDX", BoardRoomMDX.address, network);

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

        // BSC pool related operations
        // - Add minter to BSC pool
        let mdx = await MdxToken.deployed();
        await mdx.addMinter(BSCPool.address);

        // Initialize each lp pool
        let bscPool = await BSCPool.deployed();
        let productions = getProdInfo(network);
        let poolId = 0;
        
        for (prod of productions) {
            prod.token0Address = prod.token0 == 'Bnb' ? wbnb.address : prod.token0Address;
            prod.token1Address = prod.token1 == 'Bnb' ? wbnb.address : prod.token1Address;

            await factory.createPair(prod.token0Address, prod.token1Address);
            let lp = await factory.getPair(prod.token0Address, prod.token1Address);
            await bscPool.add(1000, lp, false);
            saveToJson(`Mdx${prod.token0}${prod.token1}PoolId`, poolId++, network);
        }

    } else {
        throw new Error('Init for other network unfinished');
    }
};