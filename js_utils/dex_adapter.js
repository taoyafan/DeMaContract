const MdexFactory = artifacts.require("MdexFactory");
const MdexRouter = artifacts.require("MdexRouter");
const MdexPair = artifacts.require("MdexPair");
const MdxGoblin = artifacts.require("MdxGoblin");
const MdxReinvestment = artifacts.require("MdxReinvestment");
const MdxToken = artifacts.require("MdxToken");
const BSCPool = artifacts.require("BSCPool");
const BoardRoomMDX = artifacts.require("BoardRoomMDX");
const MdxStrategyAddTwoSidesOptimal = artifacts.require("MdxStrategyAddTwoSidesOptimal");
const MdxStrategyWithdrawMinimizeTrading = artifacts.require("MdxStrategyWithdrawMinimizeTrading");

const PancakeFactory = artifacts.require("PancakeFactory");
const PancakeRouter = artifacts.require("PancakeRouter");
const PancakePair = artifacts.require("PancakePair");
const CakeGoblin = artifacts.require("CakeGoblin");
const CakeGoblinWithoutDexPool = artifacts.require("CakeGoblinWithoutDexPool");
const CakeReinvestment = artifacts.require("CakeReinvestment");
const CakeToken = artifacts.require("CakeToken");
const CakeStrategyAddTwoSidesOptimal = artifacts.require("CakeStrategyAddTwoSidesOptimal");
const CakeStrategyWithdrawMinimizeTrading = artifacts.require("CakeStrategyWithdrawMinimizeTrading");

const gGetName = 
{
    "Mdx": {
        "Factory": () => "MdexFactory",
        "Router": () => "MdexRouter",
        "DexPool": () => "BSCPool",
        "Reinvestment": () => "MdxReinvestment",
        "DexToken": () => "MdxToken",
        "BoardRoom": () => "BoardRoomMDX",
        "BoardRoomPoolId": () => 4,
        "Goblin": (names) => `Mdx${names[0]}${names[1]}Goblin`,
        "GoblinWithoutDexPool": (names) => `Mdx${names[0]}${names[1]}GoblinWithoutDexPool`,
        "PoolId": (names) => `Mdx${names[0]}${names[1]}PoolId`,
        "FarmPoolId": (names) => `Mdx${names[0]}${names[1]}FarmPoolId`,
        "ProdId": (names) => `Mdx${names[0]}${names[1]}ProdId`,
        "ProdTokens": (prodId) => `MdxProd${prodId}Tokens`,
        "StrategyAddTwoSidesOptimal": () => "MdxStrategyAddTwoSidesOptimal",
        "StrategyWithdrawMinimizeTrading": () => "MdxStrategyWithdrawMinimizeTrading",
    },
    "Cake": {
        "Factory": () => "PancakeFactory",
        "Router": () => "PancakeRouter",
        "DexPool": () => "MasterChef",
        "Reinvestment": () => "CakeReinvestment",
        "DexToken": () => "CakeToken",
        "BoardRoom": () => "CakePool",
        "BoardRoomPoolId": () => 0,
        "Goblin": (names) => `Cake${names[0]}${names[1]}Goblin`,
        "GoblinWithoutDexPool": (names) => `Cake${names[0]}${names[1]}GoblinWithoutDexPool`,
        "PoolId": (names) => `Cake${names[0]}${names[1]}PoolId`,
        "FarmPoolId": (names) => `Cake${names[0]}${names[1]}FarmPoolId`,
        "ProdId": (names) => `Cake${names[0]}${names[1]}ProdId`,
        "ProdTokens": (prodId) => `CakeProd${prodId}Tokens`,
        "StrategyAddTwoSidesOptimal": () => "CakeStrategyAddTwoSidesOptimal",
        "StrategyWithdrawMinimizeTrading": () => "CakeStrategyWithdrawMinimizeTrading",
    },
}

const gContracts = {
    "Mdx": {
        "Factory": MdexFactory,
        "Router": MdexRouter,
        "Pair": MdexPair,
        "DexPool": BSCPool,
        "Reinvestment": MdxReinvestment,
        "DexToken": MdxToken,
        "Goblin": MdxGoblin,
        "GoblinWithoutDexPool": null,
        "BoardRoom": BoardRoomMDX,
        "StrategyAddTwoSidesOptimal": MdxStrategyAddTwoSidesOptimal,
        "StrategyWithdrawMinimizeTrading": MdxStrategyWithdrawMinimizeTrading,
    },
    "Cake": {
        "Factory": PancakeFactory,
        "Router": PancakeRouter,
        "Pair": PancakePair,
        "DexPool": null, // MasterChefV2,
        "Reinvestment": CakeReinvestment,
        "DexToken": CakeToken,
        "Goblin": CakeGoblin,
        "GoblinWithoutDexPool": CakeGoblinWithoutDexPool,
        "BoardRoom": null, // CakePool,
        "StrategyAddTwoSidesOptimal": CakeStrategyAddTwoSidesOptimal,
        "StrategyWithdrawMinimizeTrading": CakeStrategyWithdrawMinimizeTrading,
    },
}

function hardAssert(shouldTrue, mes) {
    if (!shouldTrue) {
        throw new Error(mes);
    }
}

function getName(dex, name, param=null) {
    const specName = gGetName[dex][name](param);
    hardAssert(specName!=null, `${name} name of ${dex} not found `);
    return specName;
}

function getAddress(addressJson, dex, name, param=null) {
    const address = addressJson[getName(dex, name, param)];
    hardAssert(address!=null, `${name} address of ${dex} not found `);
    return address;
}

function getInstance(addressJson, dex, contractName, param=null) {
    const contract = gContracts[dex][contractName];
    hardAssert(contract, `${contractName} contract of ${dex} not found `);
    
    const address = contractName == "Pair" ? param : getAddress(addressJson, dex, contractName, param);

    return contract.at(address);
}

module.exports = {
    gContracts,
    getName,
    getAddress,
    getInstance,
}