
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
const fs = require('fs')
const {initFile, saveLogToFile} = require("./lib/utils");
BigNumber.config({ EXPONENTIAL_AT: 30 })

const bnbAddress = '0x0000000000000000000000000000000000000000'
const MaxUint256 = BigNumber("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
const jsonString = fs.readFileSync("bin/contracts/address.json")
const addressJson = JSON.parse(jsonString)

const file = `test/log/log.json`;

contract("TestProduction", (accounts) => {

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

    let tokenPair = [['Bnb', 'Busd'], ['Busd', 'Bnb'], ['Mdx', 'Busd']];
    let r0r1 = [[1000, 200000], [200000, 1000], [1000, 200000]];

    before('Init', async () => {
        initFile(file);

        factory = await MdexFactory.at(addressJson.MdexFactory);
        wbnb = await WBNB.at(addressJson.WBNB);
        busd = await ERC20Token.at(addressJson.BUSD);
        router = await MdexRouter.at(addressJson.MdexRouter);
        mdx = await MdxToken.at(addressJson.MdxToken);
        bank = await Bank.at(addressJson.Bank);

        // Deposit token in bank.
        let amount = toWei(100);
        await bank.deposit(bnbAddress, amount, {from: accounts[0], value: amount});

        await mdx.approve(bank.address, amount, {from: accounts[0]})
        await bank.deposit(mdx.address, amount, {from: accounts[0]});

        await busd.approve(bank.address, amount, {from: accounts[0]})
        await bank.deposit(busd.address, amount, {from: accounts[0]});
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
            forEachTokenPair(tokenPair[i], r0r1[i]);
            break;  // TODO debug only, need to remove.
        }

        async function forEachTokenPair(tokensName, r) {

            let depositArray = [[10, 0]];
            let borrowsArray = [[0, 0], [0, 10], [10, 0], [10, 10]];

            for(borrows of borrowsArray) {
                forEachBorrow(tokensName, depositArray[0], borrows, r);
                break;  //TODO debug only, need to remove.
            }

            async function forEachBorrow(tokensName, deposits, borrows, r) {

                describe(`\n\nTest with ${tokensName[0]} and ${tokensName[1]}, deposits ${
                    deposits[0]}, ${deposits[1]}, borrow ${borrows[0]} and ${borrows[1]}`, async () => {

                    let posId;
                    let beforeStates;
                    let afterStates;

                    borrows = [toWei(borrows[0]), toWei(borrows[1])];
                    deposits = [toWei(deposits[0]), toWei(deposits[1])]
                    r = [toWei(r[0]), toWei(r[1])];

                    before(`Init`, async () => {
                        saveLogToFile(file, `Test with ${tokensName[0]} and ${
                            tokensName[1]}, deposits ${fromWei(deposits[0])}, ${
                            fromWei(deposits[1])}, borrow ${fromWei(borrows[0])} and ${fromWei(borrows[1])}`)

                        // Add liquidate first
                        let token0Address = name2Address[tokensName[0]];
                        let token1Address = name2Address[tokensName[1]];
                        await addLiquidate(token0Address, token1Address, r[0], r[1], accounts[0]);

                    })

                    describe(`\n\nTest create position`, async () => {
                        
                        before(`Create position`, async () => {
                            beforeStates = await getStates(0, accounts[0], tokensName);
                            // logObj(beforeStates, "beforeStates");
                            saveLogToFile(file, `Before create position`, beforeStates)

                            posId = await createPosition(tokensName, accounts[0], [deposits[0], deposits[1]], borrows, 0);

                            afterStates = await getStates(posId, accounts[0], tokensName);
                            // logObj(afterStates, "afterStates");
                            saveLogToFile(file, `After create position`, afterStates)
                        })

                        it(`Check create position result`, async () => {
                            await checkStates(beforeStates, afterStates, [deposits[0], deposits[1]], borrows);
                        })
                    })

                    describe(`\n\nTest replenishment`, async () => {
                        before(`replenishment`, async () => {
                            beforeStates = afterStates;
                            await replenishment(posId, tokensName, accounts[0], [deposits[0], deposits[1]], borrows, 0);
                            afterStates = await getStates(posId, accounts[0], tokensName);
                            saveLogToFile(file, `After replenishment`, afterStates)
                        })

                        it(`Check replenishment result`, async () => {
                            await checkStates(beforeStates, afterStates, [deposits[0], deposits[1]], borrows);
                        })
                    })

                    // describe(`\n\nTest withdraw`, async () => {
                    //     before(`withdraw`, async () => {
                    //         beforeStates = afterStates;
                    //         await withdraw(posId, tokensName, accounts[0], [deposits[0], deposits[1]], borrows, 0);
                    //         afterStates = await getStates(posId, accounts[0], tokensName);
                    //         saveLogToFile(file, `After withdraw`, afterStates)
                    //     })

                    //     it(`Check withdraw result`, async () => {
                    //         await checkStates(beforeStates, afterStates, 
                    //             [-deposits[0], -deposits[1]], [-borrows[0], -borrows[0]]);
                    //     })
                    // })

                })
            }
        }
    })

    // ------------------------------------- Interface -------------------------------------

    async function createPosition(tokensName, userAddress, amounts, borrows, minDebt) {
        await addLp(0, userAddress, tokensName, amounts, borrows, minDebt)
        return (await bank.currentPos() - 1);
    }

    async function replenishment(posId, tokensName, userAddress, amounts, borrows, minDebt) {
        await addLp(posId, userAddress, tokensName, amounts, borrows, minDebt)
    }

    async function repay() {

    }

    async function withdraw() {
        
    }

    // ------------------------------------- Utils -------------------------------------

    async function getStates(posId, userAddress, tokensName) {
        let tokensAddress = [name2Address[tokensName[0]], name2Address[tokensName[1]]];

        let states = {tokensAddress: tokensAddress};

        // user amount
        states.userBalance = [
            await getBalance(tokensAddress[0], userAddress), 
            await getBalance(tokensAddress[1], userAddress)
        ];

        // bank amount
        states.bankBalance = [
            await getBalance(tokensAddress[0], bank.address), 
            await getBalance(tokensAddress[1], bank.address)
        ];

        async function getBank(tokenAddress) {
            let info = await bank.banks(tokensAddress[0]);
            let infoObj = {
                tokenAddr:          info.tokenAddr,
                isOpen:             Boolean(info.isOpen),
                canDeposit:         Boolean(info.canDeposit),
                poolId:             +info.poolId,
                totalVal:           BigNumber(info.totalVal),
                totalShares:        BigNumber(info.totalShares),        
                totalDebt:          BigNumber(info.totalDebt),          
                totalDebtShares:    BigNumber(info.totalDebtShares),    
                totalReserve:       BigNumber(info.totalReserve), 
                lastInterestTime:   BigNumber(info.lastInterestTime),
            }
            return infoObj
        }
        states.banksInfo = [
            await getBank(tokensAddress[0]),
            await getBank(tokensAddress[1])
        ];

        // position info, ids, health
        if (posId == 0) {
            // no pos
            states.posInfo = {debts: [BigNumber(0), BigNumber(0)]}
        } else {
            // pos.productionId,
            // newHealth,
            // health,
            // [debt0, debt1],
            // pos.owner
            let info = await bank.positionInfo(posId);
            states.posInfo = {
                prodId: info[0],
                newHealth: BigNumber(info[1]),
                health: [BigNumber(info[2][0]), BigNumber(info[2][1])],
                debts: [BigNumber(info[3][0]),BigNumber(info[3][1])],
                owner: info[4]
            }
        }
        states.posInfo.posId = posId;
        let allPosIdAndHealth = await bank.allPosIdAndHealth();
        [states.allPosId, states.allPosHealth] = [allPosIdAndHealth[0], allPosIdAndHealth[1]];
        for (i = 0; i < states.allPosHealth.length; i++) {
            states.allPosHealth[i] = BigNumber(states.allPosHealth[i]);
        }

        // user position and production info
        states.userPosId = await bank.userAllPosId(userAddress);
        states.userProdId = await bank.userAllProdId(userAddress);

        // Goblin info
        let goblinAddress = addressJson[`MdxGoblin${tokensName[0]}${tokensName[1]}`];
        let goblin = await MdxGoblin.at(goblinAddress);
        states.goblin = {}

        // - goblin global info
        globalInfo = await goblin.globalInfo();
        states.goblin.globalInfo = {
            totalLp: BigNumber(globalInfo.totalLp),
            totalMdx: BigNumber(globalInfo.totalMdx),
            accMdxPerLp: BigNumber(globalInfo.accMdxPerLp),
            lastUpdateTime: BigNumber(globalInfo.lastUpdateTime),
        }

        // - goblin user info
        userInfo = await goblin.userInfo(userAddress);
        states.goblin.userInfo = {
            totalLp: BigNumber(userInfo.totalLp),
            earnedMdxStored: BigNumber(userInfo.earnedMdxStored),
            accMdxPerLpStored: BigNumber(userInfo.accMdxPerLpStored),
            lastUpdateTime: BigNumber(userInfo.lastUpdateTime),
        }

        states.goblin.lpAmount = BigNumber(await goblin.posLPAmount(posId));   // It will be 0 if posId is 0
        states.goblin.principals = [BigNumber(await goblin.principal(posId, 0)), 
                                    BigNumber(await goblin.principal(posId, 1))];

        // mdx pool lp amount
        
        let _tokens = tokensFilter(tokensAddress[0], tokensAddress[1]);
        let lpAddress = await factory.getPair(_tokens[0], _tokens[1]);
        states.mdxPoolLpAmount = await getBalance(lpAddress, addressJson.BSCPool)
        return states
    }

    // Assuming there is no time elapse
    async function checkStates(beforeStates, afterStates, depositAmounts, borrowAmounts) {
        const tokens = afterStates.tokensAddress;
        
        for (i = 0; i < 2; ++i) {
            // Check user balance
            let userIncBalance = aSubB(afterStates.userBalance[i], beforeStates.userBalance[i]);
            equal(userIncBalance, -depositAmounts[i], `User balance[${i}] changes wrong`, true, tokens[i])
            
            // Check bank balance
            let bankIncBalance = aSubB(afterStates.bankBalance[i], beforeStates.bankBalance[i]);
            equal(bankIncBalance, -borrowAmounts[i], `Bank balance[${i}] changes wrong`, true, tokens[i])

            // Check bank total val
            let bankIncVal = aSubB(afterStates.banksInfo[i].totalVal, beforeStates.banksInfo[i].totalVal);
            equal(bankIncVal, -borrowAmounts[i], `Bank val[${i}] changes wrong`, true, tokens[i])
            
            // Check bank total debt
            let bankIncDebt = aSubB(afterStates.banksInfo[i].totalDebt, beforeStates.banksInfo[i].totalDebt);
            equal(bankIncDebt, borrowAmounts[i], `Bank debt[${i}] changes wrong`, true, tokens[i])

            // Pos debt share
            let userPosIncDebt = aSubB(afterStates.posInfo.debts[i], beforeStates.posInfo.debts[i])
            equal(userPosIncDebt, borrowAmounts[i], `Pos debtShare[${i}] changes wrong`, true, tokens[i])

            // Goblin principals
            let principal = aSubB(afterStates.goblin.principals[i], beforeStates.goblin.principals[i]);
            equal(principal, depositAmounts[i], `Principal[${i}] amounts changes wrong`, true, tokens[i]); 
        }

        // Check goblin states
        // Lp amount
        let IncLpAmount = aSubB(afterStates.goblin.lpAmount, beforeStates.goblin.lpAmount);
        let IncLpTo0Amount = await SwapAllLpToToken0(tokens[0], tokens[1], IncLpAmount);
        let targetTo0Amount = await swapAllToA(tokens, [depositAmounts[0].plus(borrowAmounts[0]), 
                                                  depositAmounts[1].plus(borrowAmounts[1])]);
        
        equal(IncLpTo0Amount, targetTo0Amount, `Lp amount changes wrong`, false, 1); //1 means not bnb

        // Check global totalLp and user totalLp
        let userIncTotalLp = aSubB(afterStates.goblin.globalInfo.totalLp, beforeStates.goblin.globalInfo.totalLp);
        let globalIncTotalLp = aSubB(afterStates.goblin.userInfo.totalLp, beforeStates.goblin.userInfo.totalLp);

        equal(userIncTotalLp, IncLpAmount, `Global LP amounts changes wrong`, true, 1); //1 means not bnb
        equal(globalIncTotalLp, IncLpAmount, `User Lp amount changes wrong`, true, 1); //1 means not bnb
        
        // Check mdx pool lp amount
        let mdxPoolIncLp = aSubB(afterStates.mdxPoolLpAmount, beforeStates.mdxPoolLpAmount);
        equal(mdxPoolIncLp, IncLpAmount, `Mdx pool amounts changes wrong`, true, 1); //1 means not bnb

        // Health should be 10000 while there is no time elapse
        for (i = 0; i < afterStates.allPosId.length; ++i) {
            if (afterStates.allPosId[i] == afterStates.posInfo.posId) {
                equal(afterStates.allPosHealth[i], 10000, 'Health wrong');
                break;
            }
        }
    }

    function equal(amount0, amount1, info, strictEqual, token) {
        amount0 = BigNumber(amount0);
        amount1 = BigNumber(amount1);

        info = info + ` actual: ${fromWei(amount0)}, expect: ${fromWei(amount1)}`;
        let larger = amount0.isGreaterThan(amount1) ? amount0 : amount1
        let smaller =  amount0.isGreaterThan(amount1) ? amount1 : amount0

        if (strictEqual) {
            if (token == bnbAddress || token == addressJson.WBNB) {
                assert.equal(larger.minus(smaller)
                    .dividedToIntegerBy(1e17).toNumber(), 0, info)
            } else {
                assert.equal(amount0.toString(), amount1.toString(), info)
            }
        } else {
            let delta = larger.minus(smaller)
            if (token == bnbAddress || token == addressJson.WBNB) {
                assert(delta.isLessThanOrEqualTo(larger.multipliedBy(6)
                    .dividedToIntegerBy(1000).plus(1e16)), info)
            } else {
                assert(delta.isLessThanOrEqualTo(larger.multipliedBy(6)
                    .dividedToIntegerBy(1000)), info)
            }
        }
    }

    async function SwapAllLpToToken0(token0, token1, lpAmount) {
        [token0, token1] = tokensFilter(token0, token1);
        let _r0, _r1
        [_r0, _r1] = await getR0R1(token0, token1)

        // Get the value of incLp
        let lpAddress = await factory.getPair(token0, token1);
        let lp = await MdexPair.at(lpAddress)
        let totalLp = await lp.totalSupply();

        let token0AmountInLp = BigNumber(_r0).multipliedBy(lpAmount).dividedToIntegerBy(totalLp)
        let token1AmountInLp = BigNumber(_r1).multipliedBy(lpAmount).dividedToIntegerBy(totalLp)
        
        let to0Amount = _swapAllToA(token0AmountInLp, token1AmountInLp, _r0, _r1);

        return to0Amount
    }

    async function addLp(posId, userAddress, tokensName, amounts, borrows, minDebt) {
        let token0Address = name2Address[tokensName[0]];
        let token1Address = name2Address[tokensName[1]];

        let bnbValue = 0;
        if (token0Address == bnbAddress) {
            bnbValue = amounts[0];
        } else if (token1Address == bnbAddress) {
            bnbValue = amounts[1];
        }

        let pid = addressJson[`Mdx${tokensName[0]}${tokensName[1]}ProdId`]
        let addStrategyAddress = addressJson.MdxStrategyAddTwoSidesOptimal;

        let strategyDate = web3.eth.abi.encodeParameters(
            ["address", "address", "uint256", "uint256", "uint256"],
            [token0Address, token1Address, amounts[0], amounts[1], minDebt]);

        let data = web3.eth.abi.encodeParameters(
            ["address", "bytes" ],
            [addStrategyAddress, strategyDate]);

        await approve(token0Address, addStrategyAddress, amounts[0], accounts[0]);
        await approve(token1Address, addStrategyAddress, amounts[1], accounts[0]);

        console.log(`opPosition, posId: ${posId}, pid: ${pid}`);
        await bank.opPosition(posId, pid, borrows, data, {from: userAddress, value: bnbValue});
    }

    async function approve(tokenAddress, to, amount, from) {
        if (tokenAddress == bnbAddress)
            return

        let token = await ERC20Token.at(tokenAddress);
        await token.approve(to, amount, {from: from});
    }

    async function getBalance(tokenAddress, account) {
        if (tokenAddress == bnbAddress) {
            return BigNumber(await web3.eth.getBalance(account))
        } else {
            let token = await ERC20Token.at(tokenAddress);
            return BigNumber(await token.balanceOf(account));
        }
    }

    // Input token address
    async function addLiquidate(token0, token1, r0, r1, from) {
        if (token0 == bnbAddress) {
            token0 = addressJson.WBNB
            wbnb.deposit({from: from, value: r0})
        } else if (token1 == bnbAddress) {
            token1 = addressJson.WBNB
            wbnb.deposit({from: from, value: r1})
        }

        await approve(token0, router.address, r0, from)
        await approve(token1, router.address, r1, from)

        await router.addLiquidity(token0, token1,
            r0, r1, 0, 0, from, MaxUint256, {from: from});

        console.log(`After init add liquidity:`)
        await getR0R1(token0, token1, true);
    }

    // Input token address
    async function getR0R1(token0, token1, log = false) {
        [token0, token1] = tokensFilter(token0, token1);
        let lpAddress = await factory.getPair(token0, token1);
        let lp = await MdexPair.at(lpAddress)

        let token0InLp = await lp.token0()
        res = await lp.getReserves();
        let _r0, _r1
        if (token0 == token0InLp ||
            (token0 == bnbAddress && token0InLp == addressJson.WBNB))
        {
            [_r0, _r1] = [res[0], res[1]]
        } else {
            [_r0, _r1] = [res[1], res[0]]
        }
        if (log) {
            console.log(`r0 is: ${fromWei(_r0)}, r1 is: ${fromWei(_r1)}`);
        }
        return [_r0, _r1];
    }

    async function removeAllLiquidity(token0, token1, from) {
        [token0, token1] = tokensFilter(token0, token1);
        let lpAddress = await factory.getPair(token0, token1);
        let lpAmount = await getBalance(lpAddress, from)

        await approve(lpAddress, router.address, lpAmount, from)
        await router.removeLiquidity(token0, token1,
            lpAmount, 0, 0, from, MaxUint256, {from: from});

        console.log(`After remove all liquidity:`)
        await getR0R1(token0, token1);
    }

    async function swapAllToA(tokens, amounts) {
        let _r0, _r1
        [_r0, _r1] = await getR0R1(tokens[0], tokens[1])

        return _swapAllToA(amounts[0], amounts[1], _r0, _r1);
    }

    async function _swapAllToA(na, nb, ra, rb) {
        let deltaA = BigNumber(nb).multipliedBy(ra).dividedToIntegerBy(rb)
        return BigNumber(na).plus(deltaA)
    }
})

function toWei(ether) {
    return BigNumber(web3.utils.toWei(BigNumber(ether).toString()))
}

function fromWei(wei) {
    return BigNumber(web3.utils.fromWei(BigNumber(wei).toString()))
}

function aSubB(a, b) {
    return BigNumber(a).minus(BigNumber(b));
}

function tokensFilter(token0, token1) {
    if (token0 == bnbAddress) {
        token0 = addressJson.WBNB
    } else if (token1 == bnbAddress) {
        token1 = addressJson.WBNB
    }
    return [token0, token1]
}

function logObj(obj, name) {
    console.log(` ------------------ ${name}: ------------------ `)
    console.log(JSON.stringify(obj, null, 2))
}