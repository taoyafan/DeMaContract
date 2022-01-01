const WBNB = artifacts.require("WBNB");
const CakeToken = artifacts.require("CakeToken");
const SyrupBar = artifacts.require("SyrupBar");
const PancakeFactory = artifacts.require("PancakeFactory");
const PancakeRouter = artifacts.require("PancakeRouter");
const MasterChef = artifacts.require("MasterChef");

const BigNumber = require("bignumber.js");
let {saveToJson} = require('../js_utils/jsonRW.js');
let {getProdInfo} = require('../js_utils/config.js');

const {
    bnbAddress,
    MaxUint256,
    setDex,
    setNetwork,
    createPair,
    getPair,
    addLiquidate,
} = require("../js_utils/utils");

module.exports = async function (deployer, network, accounts) {

    if (network == 'development' || network == 'bsctest') {
        const { addressJson } = setNetwork(network, web3);
        setDex("Cake");

        // let cake = await deployer.deploy(CakeToken); // Has bug that cake is undefined
        await deployer.deploy(CakeToken);      // Cake Token
        const cake = await CakeToken.deployed();
        saveToJson("CakeToken", cake.address, network);
        await cake.mint(accounts[0], BigNumber(1e25));      // 1e7

        const factory = await deployer.deploy(
            PancakeFactory,            // Factory
            accounts[0]
        );
        saveToJson("PancakeFactory", PancakeFactory.address, network);
        console.log(`INIT_CODE_PAIR_HASH: ${await factory.INIT_CODE_PAIR_HASH()}`)

        let router = await deployer.deploy(
            PancakeRouter,              // PancakeRouter
            PancakeFactory.address,
            addressJson.WBNB            // WBNB should be saved in addressJson after deploying cake.
        );
        saveToJson("PancakeRouter", PancakeRouter.address, network);

        await deployer.deploy(
            SyrupBar,                   // SyrupBar
            CakeToken.address,
        );
        saveToJson("SyrupBar", SyrupBar.address, network);

        let masterChef = await deployer.deploy(
            MasterChef,                 // MasterChef
            CakeToken.address,
            SyrupBar.address,
            accounts[0],
            BigNumber(1e18),        // cakePerBlock, 1 cake per block
            0                       // startBlock
        );
        saveToJson("MasterChef", MasterChef.address, network);

        // MasterChef related operations

        // - Transfer owner ship
        cake.transferOwnership(MasterChef.address);

        // - Initialize each lp pool
        let productions = getProdInfo(network, "Cake");
        let poolId = 1;

        // - Update addressJson in utils
        setNetwork(network, web3);

        for (prod of productions) {
            console.log(`Begin to config ${prod.token0} and ${prod.token1} of account ${accounts[0]}`);

            let lp = await createPair(prod.token0Address, prod.token1Address);
            await masterChef.add(1000, lp, false);

            saveToJson(`Cake${prod.token0}${prod.token1}PoolId`, poolId++, network);

            if (network == 'bsctest') {
                await addLiquidate(prod.token0Address, prod.token1Address, prod.r0, prod.r1, accounts[0]);
            }
        }

        if (network == 'bsctest') {
            await addLiquidate(addressJson.DEMA, addressJson.USDT, BigNumber(1e24), BigNumber(2e24), accounts[0]);    // 2 USD
        }

        setDex("Mdx");      // Recover. In case there are some errors in later running.
    } else {
        throw new Error('Init for other network unfinished');
    }
};