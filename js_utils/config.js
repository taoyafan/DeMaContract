const BigNumber = require("bignumber.js");

function getBanksInfo(network) {
    let bankInfo;

    if (network == "development") {
        bankInfo = [
            {
                token: "Bnb",
                rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            },
            {
                token: "Usdt",
                rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            },
            {
                token: "Mdx",
                rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            },
            {
                token: "Cake",
                rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            },
            {
                token: "Busd",
                rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            }
        ]
    } else if (network == "bsctest") {
        bankInfo = [
            {
                token: "Busd",
                rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            },
            {
                token: "Usdt",
                rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            },
            {
                token: "Bnb",
                rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            },
            {
                token: "Eth",
                rewardFirstPeriod: BigNumber(7220).multipliedBy(1e18)
            },
            {
                token: "Btc",
                rewardFirstPeriod: BigNumber(7220).multipliedBy(1e18)
            },
            {
                token: "Cake",
                rewardFirstPeriod: BigNumber(7220).multipliedBy(1e18)
            },
        ]
    } else if (network == "bscmain") {
        bankInfo = [
            // {
            //     token: "Usdt",
            //     rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            // },
            // {
            //     token: "Bnb",
            //     rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            // },
            // {
            //     token: "Busd",
            //     rewardFirstPeriod: BigNumber(18050).multipliedBy(1e18)
            // },
        ]
    } else {
        throw new Error("Network not support");
    }
    return bankInfo
}

function getProdInfo(network, dex="Mdx") {
    let productions;

    // TODO found the right pool id in main net.
    if (network == "development") {
        productions = {
            "Mdx": [
                {
                    token0: "Bnb",
                    token1: "Busd",
                    rewardFirstPeriod: BigNumber(60*60*24*30).multipliedBy(1e18),    // 1 DEMA per second.
                },
                {
                    token0: "Mdx",
                    token1: "Busd",
                    rewardFirstPeriod: BigNumber(60*60*24*30).multipliedBy(1e18),    // 1 DEMA per second.
                },
                {
                    token0: "Usdt",
                    token1: "Busd",
                    rewardFirstPeriod: BigNumber(60*60*24*30).multipliedBy(1e18),    // 1 DEMA per second.
                },
            ],
        }
        productions["Cake"] = productions["Mdx"]
    } else if (network == "bsctest") {
        productions = {
            "Mdx": [
                {
                    token0: "Bnb",
                    token1: "Usdt",
                    rewardFirstPeriod: BigNumber(3610).multipliedBy(1e18),
                    r0: BigNumber(10e18),
                    r1: BigNumber(3000e18),        // 300
                },
                // {
                //     token0: "Btc",
                //     token1: "Usdt",
                //     rewardFirstPeriod: BigNumber(3610).multipliedBy(1e18),
                //     r0: BigNumber(1000e18),
                //     r1: BigNumber(60000000e18),    // 6 W
                // },
                {
                    token0: "Eth",
                    token1: "Usdt",
                    rewardFirstPeriod: BigNumber(3610).multipliedBy(1e18),
                    r0: BigNumber(1000e18),
                    r1: BigNumber(4000000e18),     // 4000
                },
            ],
            "Cake": [
                {
                    token0: "Cake",
                    token1: "Bnb",
                    rewardFirstPeriod: BigNumber(3610).multipliedBy(1e18),
                    r0: BigNumber(150e18),
                    r1: BigNumber(3e18),        // 1 : 50
                },
                // {
                //     token0: "Cake",
                //     token1: "Busd",
                //     token1Address: "0x0000000000000000000000000000000000000000",
                //     rewardFirstPeriod: BigNumber(1083).multipliedBy(1e18),
                //     r0: BigNumber(1000000e18),
                //     r1: BigNumber(10000000e18),        // 10
                // },
                {
                    token0: "Btc",
                    token1: "Busd",
                    rewardFirstPeriod: BigNumber(1083).multipliedBy(1e18),
                    r0: BigNumber(1000e18),
                    r1: BigNumber(60000000e18),    // 6 W
                },
                // {
                //     token0: "Bnb",
                //     token1: "Busd",
                //     rewardFirstPeriod: BigNumber(3610).multipliedBy(1e18),
                //     r0: BigNumber(3e18),
                //     r1: BigNumber(900e18),          // 300
                // },
                {
                    token0: "Bnb",
                    token1: "Usdt",
                    rewardFirstPeriod: BigNumber(5415).multipliedBy(1e18),
                    r0: BigNumber(3e18),
                    r1: BigNumber(900e18),     // 300
                },
                // {
                //     token0: "Eth",
                //     token1: "Bnb",
                //     rewardFirstPeriod: BigNumber(5415).multipliedBy(1e18),
                //     r0: BigNumber(0.3e18),
                //     r1: BigNumber(3e18),     // 1 : 10
                // },
            ]
        }
    } else if (network == "bscmain") {
        productions = {
            "Cake": [
                {
                    token0: "Bnb",
                    token1: "Usdt",
                    rewardFirstPeriod: BigNumber(5415).multipliedBy(1e18),
                },
            ]
        }
    } else {
        throw new Error("Network not support");
    }

    console.assert(dex in productions, "Dex not support");
    return productions[dex]
}

module.exports = {
    getProdInfo,
    getBanksInfo
};