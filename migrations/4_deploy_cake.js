const WBNB = artifacts.require("WBNB");
const CakeToken = artifacts.require("CakeToken");
const SyrupBar = artifacts.require("SyrupBar");
const CakeFactory = artifacts.require("PancakeFactory");
const CakeRouter = artifacts.require("PancakeRouter");
const MasterChef = artifacts.require("MasterChef");

const BigNumber = require("bignumber.js");
let {saveToJson, readAddressJson} = require('../js_utils/jsonRW.js');
let {getProdInfo} = require('../js_utils/config.js');

const {
    bnbAddress,
    MaxUint256,
    setNetwork,
    createPair,
    getPair,
    addLiquidate,
} = require("../js_utils/utils");

module.exports = async function (deployer, network, accounts) {

    if (network == 'development' || network == 'bsctest') {
        const { addressJson } = setNetwork(network, web3);
        const busdAddress = addressJson.BUSD;

        let cakeToken = await deployer.deploy(CakeToken)      // Cake Token
        saveToJson("CakeToken", CakeToken.address, network);

        await deployer.deploy(
            CakeFactory,            // Factory
            accounts[0]
        );
        saveToJson("CakeFactory", CakeFactory.address, network);

        let router = await deployer.deploy(
            CakeRouter,             // CakeRouter
            CakeFactory.address,
            addressJson.WBNB        // WBNB should be saved in addressJson after deploying cake.
        );

        await deployer.deploy(
            SyrupBar,                // MasterChef
            CakeToken.address,
        );

        let masterChef = await deployer.deploy(
            MasterChef,             // MasterChef
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

        // TODO unfinished
        // - Update addressJson in utils
        setNetwork(network, web3);

        for (prod of productions) {
            console.log(`Begin to config ${prod.token0} and ${prod.token1} of account ${accounts[0]}`);

            let lp = await createPair(prod.token0Address, prod.token1Address);
            await bscPool.add(1000, lp, false);

            saveToJson(`Cake${prod.token0}${prod.token1}PoolId`, poolId++, network);

            if (network == 'bsctest') {
                await addLiquidate(prod.token0Address, prod.token1Address, prod.r0, prod.r1, accounts[0]);
            }
        }

        if (network == 'bsctest') {
            await addLiquidate(addressJson.DEMA, addressJson.USDT, BigNumber(1e24), BigNumber(2e24), accounts[0]);    // 2 USD
        }

    } else {
        throw new Error('Init for other network unfinished');
    }
};