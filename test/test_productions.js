
// Test flow:
    // MDX init
    // Add liquidity
    // Farm init
    // Bank init
    // Add token
    // Deposit toekn
    // opProduction
    // opPosition (Create position)
    // opPosition (Withdraw position)
    // Remove liquidity


// Functions

    // 1. Production token can borrow
        // Only allow borrow one token.
        // Can borrow two tokens.

    // 2. Positions usage
        // Create
        // Replenishment
        // Repay
        // Withdraw

    // 3. Health and liquidate
        // Open position health restrict
        // Health
        // New health
        // liquidate health

    // 4. Earn
        // MDX earn
        // Farm earn
        // Farm earn with inviation(test_bank has tested it)

    // 5. Global and user information
        // Productions number
        // Positions number
        // All positions
        // Users positions number
        // Users all positions

    // 6. Interest
        // For deposit token
        // For debts


// Unit
    // 1. For 3 Token pairs， r0: 1000   r1: 200,000, price 200 (getTokenPairAndInit(i))

    // 2.
        // token0 amount, token1 amount
        //      10              0
        //       0              10
        //      10              10
        //       1              10

    // 3.
        // Borrow0 amount, Borrow1 amount,
        //      0              0
        //     10              0
        //      0              10
        //     10              10


// Test plans:
    // 1. Production token can borrow
        // (1) Only allow borrow one token.
            // Unit 1
                // Token0 can borrow
                    // Deposit 10 token0, Unit 3, Expect: (success, fail, fail)
                // Token1 can borrow
                    // Deposit 10 token0, Unit 3, Expect: (fail, success, fail)
        // (2) Can borrow two tokens.
            // Unit 1
                // Deposit 10 token0, Unit 3, Expect: (success, success, success)

    // 2. Positions usage
        // Unit 1
            // Deposit 10 token0, Unit 3
                // Create
                // Replenishment
                // Repay
                // Withdraw

    // 3. Health and liquidate
        // Unit 1
            // Unit 2
                // Unit 3
                    // Check health and new health
                    // Swap to make new health to 50%, check new health
                    // Replenishment same as init, new health should be 75%
                    // Withdraw 50%, new health should be 75%, check health
                    // Repay 10%， new health should be 75%, check health
                    // Swap to make new health to 50%, Liquidate

    // 4. Earn
        // Deposit 10 BNB for pool BNB-USDT
            // Move time forward 30 second:
                // Check MDX earn, should equal to the value calculate bsc pool, reinvestment and boardroom.
                // Check Farm earn, Using stakeEarnedPerPool() in Farm.sol
                // Withdraw 100%. Then received MDX and DEMA should euqal to the value in above two steps.

    // 5. Global and user information
        // Create one BNB-USDT position and create two MDX-USDT position
            // Productions number should be 2
            // Get all productions id and check.
            // Positions number should be 3
            // All positions can aquire all 3 pos id
            // Users positions number 3
            // Users all positions should equal all positions id
            // Users positions num of BNB-USDT should be 1
            // Users positions num of MDX-USDT should be 2

        // Withdraw one MDX-USDT position
            // Productions number should be 2
            // Get all productions id and check.
            // Positions number should be 2
            // All positions can aquire all 2 pos id
            // Users positions number 2
            // Users all positions should equal all positions id
            // Users positions num of BNB-USDT should be 1
            // Users positions num of MDX-USDT should be 1

        // Withdraw one MDX-USDT position
            // Productions number should be 1
            // Get all productions id and check.
            // Positions number should be 1
            // All positions can aquire all 1 pos id
            // Users positions number 1
            // Users all positions should equal all positions id
            // Users positions num of BNB-USDT should be 1
            // Users positions num of MDX-USDT should be 0

        // Withdraw one MDX-USDT position
            // Productions number should be 0
            // Get all productions id and check.
            // Positions number should be 0
            // All positions should be empty
            // Users positions number 0
            // Users positions num of BNB-USDT should be 0
            // Users positions num of MDX-USDT should be 0


const MdxGoblin = artifacts.require("MdxGoblin");
const MdexFactory = artifacts.require("MdexFactory");
const WBNB = artifacts.require("WBNB");
const ERC20Token = artifacts.require("ERC20Token");
const MdexRouter = artifacts.require("MdexRouter");
const MdxToken = artifacts.require("MdxToken");
const MdexPair = artifacts.require("MdexPair");
const Bank = artifacts.require("Bank");
const DEMA = artifacts.require("DEMA");
const Farm = artifacts.require("Farm");

const BigNumber = require("bignumber.js");
const { assert } = require("console");
const fs = require('fs')

const bnbAddress = '0x0000000000000000000000000000000000000000'

contract("TestProduction", (accounts) => {

    const jsonString = fs.readFileSync("bin/contracts/address.json")
    const addressJson = JSON.parse(jsonString)

    let factory;
    let wbnb;
    let busd;
    let router;
    let mdx;
    let bank;

    const name2Address = {
        'Bnb': bnbAddress,
        'Busd': addressJson.BUSD,
        'Mdx': addressJson.MdxToken,
    }

    before('Init', async () => {
        factory = await MdexFactory.at(addressJson.MdexFactory);
        wbnb = await WBNB.at(addressJson.WBNB);
        busd = await BUSD.at(addressJson.BUSD);
        router = await MdexRouter.at(addressJson.MdexRouter);
        mdx = await MdxToken.at(addressJson.MdxToken);
        bank = await Bank.at(addressJson.Bank);

        // Deposit token in bank.
        let amount = toWei(100);
        bank.deposit(bnbAddress, amount, {from: accounts[0], value: amount});

        mdx.approve(bank.address, amount, {from: accounts[0]})
        bank.deposit(mdx.address, amount, {from: accounts[0]});

        busd.approve(bank.address, amount, {from: accounts[0]})
        bank.deposit(busd.address, amount, {from: accounts[0]});
    })

    // 2. Positions usage
        // Unit 1
            // Deposit 10 token0, Unit 3
                // Create
                // Replenishment
                // Repay
                // Withdraw
    describe('Positions usage test', async () => {

        for (i = 0; i < 3; i++) {
            let [token0Name, token1Name, goblinAddress] = getTokenPairAndInit(i);
            afterUnit1(token0Name, token1Name, goblinAddress);
            break;  // TODO debug only, need to remove.
        }

        async function afterUnit1(token0Name, token1Name, goblinAddress) {

            let borrowsArray = [[0, 0], [0, 10], [10, 0], [10, 10]];
            let posId;

            for(borrows of borrowsArray) {
                afterUnit3(token0Name, token1Name, borrows);
                break;  //TODO debug only, need to remove.
            }

            async function afterUnit3(token0Name, token1Name, borrows) {

                describe(`\n\nTest with ${token0Name} and ${token1Name}, borrow ${borrows[0]} and ${borrows[1]}`, async () => {

                    let posId;

                    describe(`\n\nTest create position`, async () => {
                        before(`Create position`, async () => {
                            posId = await createPosition([token0Name, token1Name], [toWei(10), 0], borrows, 0);
                        })

                        // Check result of create position
                    })

                    describe(`\n\nTest replenishment`, async () => {
                        before(`replenishment`, async () => {
                            await replenishment(posId, [token0Name, token1Name], [toWei(10), 0], borrows, 0);
                        })

                        // Check result of create position
                    })

                })
            }
        }

    })

    async function createPosition(tokensName, amounts, borrows, minDebt) {
        let token0Address = name2Address[tokensName[0]];
        let token1Address = name2Address[tokensName[1]];

        let bnbValue = 0;
        if (token0Address == bnbAddress) {
            bnbValue = amounts[0];
        } else if (token1Address == bnbAddress) {
            bnbValue = amounts[1];
        }

        let pid = addressJson[`Mdx${token0Name}${token1Name}ProdId`]
        let addStrategyAddress = addressJson.MdxStrategyAddTwoSidesOptimal;

        let strategyDate = web3.eth.abi.encodeParameters(
            ["address", "address", "uint256", "uint256", "uint256"],
            [token0Address, token1Address, amounts[0], amounts[1], minDebt]);

        let data = web3.eth.abi.encodeParameters(
            ["address", "bytes" ],
            [addStrategyAddress, strategyDate]);

        await approve(token0Address, addStrategyAddress, amounts[0], accounts[0]);
        await approve(token1Address, addStrategyAddress, amounts[1], accounts[0]);

        await bank.opPosition(0, pid, borrows, data).send({from: account, value: bnbValue});

        return (await bank.currentPid());
    }

    async function replenishment(posId, tokensName, amounts, borrows, minDebt) {
        let token0Address = name2Address[tokensName[0]];
        let token1Address = name2Address[tokensName[1]];

        let bnbValue = 0;
        if (token0Address == bnbAddress) {
            bnbValue = amounts[0];
        } else if (token1Address == bnbAddress) {
            bnbValue = amounts[1];
        }

        let pid = addressJson[`Mdx${token0Name}${token1Name}ProdId`]
        let addStrategyAddress = addressJson.MdxStrategyAddTwoSidesOptimal;

        let strategyDate = web3.eth.abi.encodeParameters(
            ["address", "address", "uint256", "uint256", "uint256"],
            [token0Address, token1Address, amounts[0], amounts[1], minDebt]);

        let data = web3.eth.abi.encodeParameters(
            ["address", "bytes" ],
            [addStrategyAddress, strategyDate]);

        await approve(token0Address, addStrategyAddress, amounts[0], accounts[0]);
        await approve(token1Address, addStrategyAddress, amounts[1], accounts[0]);

        bank.opPosition(posId, pid, borrows, data).send({from: account, value: bnbValue});
    }

    async function approve(tokenAddress, to, amount, from) {
        if (tokenAddress == bnbAddress)
            return

        let token = await ERC20.at(tokenAddress);
        await token.approve(to, amount, {from: from});
    }

    // Return token0 name, token1 name, goblin address
    async function getTokenPairAndInit(i) {
        assert(i == 0 || i == 1 || i == 2);

        let pair = [['Bnb', 'Busd'], ['Busd', 'Bnb'], ['Mdx', 'Busd']];
        let r0r1 = [[1000, 200000], [200000, 1000], [1000, 200000]];

        let token0Address = name2Address[pair[i][0]];
        let token1Address = name2Address[pair[i][1]];

        let r0 = r0r1[i][0];
        let r1 = r0r1[i][0];

        let goblinAddress = addressJson[`MdxGoblin${token0Address}${token1Address}`]

        await addLiquidate(token0Address, token1Address, r0, r1, goblinAddress);

        return [pair[i][0], pair[i][1], goblinAddress]
    }

    // Input token address
    async function addLiquidate(token0, token1, r0, r1, from) {
        if (token0 == bnbAddress) {
            token0 = wbnb.address
            wbnb.deposit({from: from, value: r0})
        } else if (token1 == bnbAddress) {
            token1 = wbnb.address
            wbnb.deposit({from: from, value: r1})
        }

        await approve(token0, router.address, r0, from)
        await approve(token1, router.address, r1, from)

        await router.addLiquidity(token0, token1,
            r0, r1, 0, 0, from, MaxUint256, {from: from});

        console.log(`After init add liquidity:`)
        await getR0R1(token0, token1);
    }

    // Input token address
    async function getR0R1(token0, token1) {
        if (token0 == bnbAddress) {
            token0 = wbnb.address
        } else if (token1 == bnbAddress) {
            token1 = wbnb.address
        }

        let lpAddress = await factory.getPair(token0, token1);
        let lp = await MdexPair.at(lpAddress)
        let token0InLp = await lp.token0()
        res = await lp.getReserves();
        let _r0, _r1
        if (token0 == token0InLp ||
            (token0 == bnbAddress && token0InLp == wbnb.address))
        {
            [_r0, _r1] = [res[0], res[1]]
        } else {
            [_r0, _r1] = [res[1], res[0]]
        }
        console.log(`r0 is: ${fromWei(_r0)}, r1 is: ${fromWei(_r1)}`);
        return [_r0, _r1];
    }
})

function toWei(ether) {
    return BigNumber(web3.utils.toWei(BigNumber(ether).toString()))
}

function fromWei(wei) {
    return BigNumber(web3.utils.fromWei(BigNumber(wei).toString()))
}