let {readAddressJson} = require('./jsonRW.js');
const BigNumber = require("bignumber.js");

function getBanksInfo(network) {
    let bankInfo;
    let addressJson = readAddressJson(network);

    if (network == 'development') {
        bankInfo = [
            {
                token: "Bnb",
                tokenAddress: "0x0000000000000000000000000000000000000000",
                rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            },
            {
                token: "Usdt",
                tokenAddress: addressJson.USDT,
                rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            },
            {
                token: "Mdx",
                tokenAddress: addressJson.MdxToken,
                rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            },
            {
                token: "Busd",
                tokenAddress: addressJson.BUSD,
                rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            }
        ]
    } else if (network == 'bsctest') {
        bankInfo = [
            {
                token: "Busd",
                tokenAddress: addressJson.BUSD,
                rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            },
            {
                token: "Usdt",
                tokenAddress: addressJson.USDT,
                rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            },
            {
                token: "Bnb",
                tokenAddress: "0x0000000000000000000000000000000000000000",
                rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            },
            {
                token: "Eth",
                tokenAddress: addressJson.ETH,
                rewardFirstPeriod: BigNumber(7220).multipliedBy(1e18)
            },
            {
                token: "Btc",
                tokenAddress: addressJson.BTC,
                rewardFirstPeriod: BigNumber(7220).multipliedBy(1e18)
            },
        ]
    } else {
        throw new Error('Network not support');
    }
    return bankInfo
}

function getProdInfo(network) {
    let productions;
    let addressJson = readAddressJson(network);

    // TODO found the right mdx pool id. and rewardFirstPeriod
    if (network == 'development') {
        productions = [
            {
                token0: "Bnb", 
                token1: "Busd", 
                token0Address: "0x0000000000000000000000000000000000000000",
                token1Address: addressJson.BUSD, 
                rewardFirstPeriod: BigNumber(60*60*24*30).multipliedBy(1e18),    // 1 DEMA per second.
            },
            {
                token0: "Mdx", 
                token1: "Busd", 
                token0Address: addressJson.MdxToken,
                token1Address: addressJson.BUSD, 
                rewardFirstPeriod: BigNumber(60*60*24*30).multipliedBy(1e18),    // 1 DEMA per second.
            },
            {
                token0: "Usdt", 
                token1: "Busd", 
                token0Address: addressJson.USDT,
                token1Address: addressJson.BUSD, 
                rewardFirstPeriod: BigNumber(60*60*24*30).multipliedBy(1e18),    // 1 DEMA per second.
            },
        ];
    } else if (network == 'bsctest') {
        productions = [
            {
                token0: "Bnb", 
                token1: "Usdt", 
                token0Address: "0x0000000000000000000000000000000000000000",
                token1Address: addressJson.USDT, 
                rewardFirstPeriod: BigNumber(3610).multipliedBy(1e18),    // 1 DEMA per second.
            },
            {
                token0: "Btc", 
                token1: "Usdt", 
                token0Address: addressJson.BTC,
                token1Address: addressJson.USDT, 
                rewardFirstPeriod: BigNumber(3610).multipliedBy(1e18),    // 1 DEMA per second.
            },
            {
                token0: "Eth", 
                token1: "Usdt", 
                token0Address: addressJson.ETH,
                token1Address: addressJson.USDT, 
                rewardFirstPeriod: BigNumber(3610).multipliedBy(1e18),    // 1 DEMA per second.
            },
        ];
    } else {
        throw new Error('Network not support');
    }

    return productions
}

module.exports = {
    getProdInfo,
    getBanksInfo
};