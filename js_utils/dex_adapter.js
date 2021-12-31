const MdexFactory = artifacts.require("MdexFactory");
const MdexRouter = artifacts.require("MdexRouter");
const MdexPair = artifacts.require("MdexPair");
const MdxGoblin = artifacts.require("MdxGoblin");
const MdxReinvestment = artifacts.require("MdxReinvestment");
const MdxToken = artifacts.require("MdxToken");
const BSCPool = artifacts.require("BSCPool");

const PancakeFactory = artifacts.require("PancakeFactory");
const PancakeRouter = artifacts.require("PancakeRouter");
const PancakePair = artifacts.require("PancakePair");
const CakeGoblin = artifacts.require("CakeGoblin");
const CakeReinvestment = artifacts.require("CakeReinvestment");
const CakeToken = artifacts.require("CakeToken");
const MasterChef = artifacts.require("MasterChef");

const g_getName = 
{
    "Mdx": {
        "Factory": () => "MdexFactory",
        "Router": () => "MdexRouter",
        "DexPool": () => "BSCPool",
        "Reinvestment": () => "MdxReinvestment",
        "DexToken": () => "MdxToken",
        "Goblin": (names) => `Mdx${names[0]}${names[1]}Goblin`,
        "PoolId": (names) => `Mdx${names[0]}${names[1]}PoolId`,
        "FarmPoolId": (names) => `Mdx${names[0]}${names[1]}FarmPoolId`,
        "ProdId": (names) => `Mdx${names[0]}${names[1]}ProdId`,
        "ProdTokens": (prodId) => `MdxProd${prodId}Tokens`,
    },
    "Cake": {
        "Factory": () => "PancakeFactory",
        "Router": () => "PancakeRouter",
        "DexPool": () => "MasterChef",
        "Reinvestment": () => "CakeReinvestment",
        "DexToken": () => "CakeToken",
        "Goblin": (names) => `Cake${names[0]}${names[1]}Goblin`,
        "PoolId": (names) => `Cake${names[0]}${names[1]}PoolId`,
        "FarmPoolId": (names) => `Cake${names[0]}${names[1]}FarmPoolId`,
        "ProdId": (names) => `Cake${names[0]}${names[1]}ProdId`,
        "ProdTokens": (prodId) => `CakeProd${prodId}Tokens`,
    },
}

const g_contracts = {
    "Mdx": {
        "Factory": MdexFactory,
        "Router": MdexRouter,
        "Pair": MdexPair,
        "DexPool": BSCPool,
        "Reinvestment": MdxReinvestment,
        "DexToken": MdxToken,
        "Goblin": MdxGoblin,
    },
    "Cake": {
        "Factory": PancakeFactory,
        "Router": PancakeRouter,
        "Pair": PancakePair,
        "DexPool": MasterChef,
        "Reinvestment": CakeReinvestment,
        "DexToken": CakeToken,
        "Goblin": CakeGoblin,
    },
}

function getName(dex, name, param=null) {
    const specName = g_getName[dex][name](param);
    console.assert(specName, `${name} name of ${dex} not found `);
    return specName;
}

function getAddress(addressJson, dex, name, param=null) {
    const address = addressJson[getName(dex, name, param)];
    console.assert(address, `${name} address of ${dex} not found `);
    return address;
}

function getInstance(addressJson, dex, contractName, param=null) {
    const contract = g_contracts[dex][contractName];
    console.assert(contract, `${contractName} contract of ${dex} not found `);
    
    const address = contractName == "Pair" ? param : getAddress(addressJson, dex, contractName, param);

    return contract.at(address);
}

module.exports = {
    getName,
    getAddress,
    getInstance,
}