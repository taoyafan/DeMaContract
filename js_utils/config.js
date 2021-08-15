let {readAddressJson} = require('./jsonRW.js');
const BigNumber = require("bignumber.js");

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
                rewardFirstPeriod: BigNumber(60*60*24*30).multipliedBy(1e18),    // 1 DEMA per second.
            },
            {
                token0: "Btc", 
                token1: "Usdt", 
                token0Address: addressJson.BTC,
                token1Address: addressJson.USDT, 
                rewardFirstPeriod: BigNumber(60*60*24*30).multipliedBy(1e18),    // 1 DEMA per second.
            },
            {
                token0: "Eth", 
                token1: "Usdt", 
                token0Address: addressJson.ETH,
                token1Address: addressJson.USDT, 
                rewardFirstPeriod: BigNumber(60*60*24*30).multipliedBy(1e18),    // 1 DEMA per second.
            },
        ];
    } else {
        throw new Error('Network not support');
    }

    return productions
}

module.exports = getProdInfo;