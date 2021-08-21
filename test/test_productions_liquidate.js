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
const Reinvestment = artifacts.require("Reinvestment");

const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 30 })
const fs = require('fs')

const file = `test/log/prod_liquidate.json`;

const {
    bnbAddress,
    MaxUint256,
    addressJson,
    name2Address,
    saveLogToFile,
    initFile,
    getStates,
    equal,
    swapAllLpToToken0,
    approve,
    getBalance,
    swapExactTo,
    swapToExact,
    addLiquidate,
    removeAllLiquidity,
    swapToTarget,
    getR0R1,
    getTokenAmountInLp,
    toWei,
    fromWei,
    aSubB,
    aAddB,
    aMulB,
    aDivB,
    tokensFilter,
} = require("./lib/utils");

const {
    createPosition,
    replenishment,
    repay,
    withdraw,
} = require("./lib/prod_interface");
const { assert } = require("console");

contract("TestProductionLiquidate", (accounts) => {

    let factory;
    let wbnb;
    let usdt;
    let busd;
    let router;
    let mdx;
    let bank;
    let reinvestment;

    let tokenPairs = [['Bnb', 'Busd'], ['Usdt', 'Busd'], ['Usdt', 'Busd'], ['Mdx', 'Busd']];
    let r = [[10000, 2000000], [2000000, 2000000], [2000000, 10000], [10000, 2000000]]

    before('Init', async () => {
        initFile(file);

        // factory = await MdexFactory.at(addressJson.MdexFactory);
        wbnb = await WBNB.at(addressJson.WBNB);
        usdt = await ERC20Token.at(addressJson.USDT);
        busd = await ERC20Token.at(addressJson.BUSD);
        // router = await MdexRouter.at(addressJson.MdexRouter);
        mdx = await MdxToken.at(addressJson.MdxToken);
        bank = await Bank.at(addressJson.Bank);
        // reinvestment = await Reinvestment.at(addressJson.Reinvestment);

        // Deposit token in bank.
        let amount = toWei(2000);
        await bank.deposit(bnbAddress, amount, {from: accounts[0], value: amount});

        await mdx.approve(bank.address, amount, {from: accounts[0]});
        await bank.deposit(mdx.address, amount, {from: accounts[0]});

        await usdt.approve(bank.address, amount, {from: accounts[0]});
        await bank.deposit(usdt.address, amount, {from: accounts[0]});

        await busd.approve(bank.address, amount, {from: accounts[0]});
        await bank.deposit(busd.address, amount, {from: accounts[0]});
    })

    describe('Positions usage test', async () => {

        // for (i = 0; i < 3; i++) {
        //     forEachTokenPair(tokenPairs[i], r[i]);
        // }

        forEachTokenPair(tokenPairs[3], r[3]);


        async function forEachTokenPair(tokensName, r) {
            let depositArray = [[2, 1], [1, 2], [2, 0], [0, 2]];
            let borrowsArray = [[0, 0], [0, 1], [1, 0], [2, 1], [1, 2]];

            depositArray.forEach((deposits) => {
                deposits.forEach((a, i, arr) => { arr[i] = r[i] / 10000 * a })
            })

            borrowsArray.forEach((borrows) => {
                borrows.forEach((a, i, arr) => { arr[i] = r[i] / 10000 * a })
            })

            // for (deposits of depositArray) {
            //     for (borrows of borrowsArray) {
            //         forEachBorrow(tokensName, deposits, borrows, r);
            //     }
            // }

            forEachBorrow(tokensName, depositArray[0], borrowsArray[3], r);

            // 1. Check health and new health
            // 2. Swap to make new health to 50%, check new health
            // 3. Replenishment same as init, new health should be 75%
            // 4. Withdraw 50%, new health should be 75%, check health
            // 5. Repay 10%， new health should be 75%, check health
            // 6. Swap to make new health to 50%, Liquidate
            async function forEachBorrow(tokensName, deposits, borrows, r) {

                describe(`\n\nTest with ${tokensName[0]} and ${tokensName[1]}, deposits ${
                    deposits[0]}, ${deposits[1]}, borrow ${borrows[0]} and ${borrows[1]}`, async () => {

                    let posId;
                    let beforeStates;
                    let afterStates;

                    borrows = [toWei(borrows[0]), toWei(borrows[1])];
                    deposits = [toWei(deposits[0]), toWei(deposits[1])]
                    r = [toWei(r[0]), toWei(r[1])];

                    let token0Address = name2Address[tokensName[0]];
                    let token1Address = name2Address[tokensName[1]];

                    before(`Init`, async () => {
                        saveLogToFile(file, `Test with ${tokensName[0]} and ${
                            tokensName[1]}, deposits ${fromWei(deposits[0])}, ${
                            fromWei(deposits[1])}, borrow ${fromWei(borrows[0])} and ${fromWei(borrows[1])}`)

                        // Add liquidate first
                        await addLiquidate(token0Address, token1Address, r[0], r[1], accounts[0]);

                    })

                    describe(`\n\nTest create position`, async () => {

                        before(`Create position`, async () => {
                            beforeStates = await getStates(0, accounts[0], tokensName);
                            saveLogToFile(file, `Before create position`, beforeStates)

                            posId = await createPosition(tokensName, accounts[0], deposits, borrows, 0);

                            afterStates = await getStates(posId, accounts[0], tokensName);
                            saveLogToFile(file, `After create position`, afterStates)
                        })

                        it(`Check create position result`, async () => {
                            await checkPosAddResult(beforeStates, afterStates, [deposits[0], deposits[1]], borrows);
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
                            await checkPosAddResult(beforeStates, afterStates, [deposits[0], deposits[1]], borrows);
                        })
                    })

                    describe(`\n\nTest repay`, async () => {

                        let withdrawRate = Math.floor(Math.random()*10000);

                        before(`Before`, async () => {
                            beforeStates = afterStates;
                            await repay(posId, tokensName, accounts[0], withdrawRate);
                            afterStates = await getStates(posId, accounts[0], tokensName);
                            saveLogToFile(file, `After repay ${withdrawRate/100}%`, afterStates)
                        })

                        it(`Repay ${withdrawRate/100}%`, async () => {
                            await checkPosWithdrawResult(beforeStates, afterStates, withdrawRate, 3);
                        })
                    })

                    describe(`\n\nTest withdraw`, async () => {

                        let withdrawRate = Math.floor(Math.random()*10000);
                        let whichWantBack = Math.floor(Math.random()*3);      // 0(token0), 1(token1), 2(token what surplus)
                        let backToken = [tokensName[0], tokensName[1], 'Optimal'];

                        it(`Withdraw ${withdrawRate/100}%`, async () => {
                            beforeStates = afterStates;
                            await withdraw(posId, tokensName, accounts[0], withdrawRate, whichWantBack);
                            afterStates = await getStates(posId, accounts[0], tokensName);
                            saveLogToFile(file, `After withdraw ${withdrawRate/100}%, back token ${
                                backToken[whichWantBack]}`, afterStates)
                        })

                        it(`Check withdraw ${withdrawRate/100}%`, async () => {
                            await checkPosWithdrawResult(beforeStates, afterStates, withdrawRate, whichWantBack);
                        })

                        it(`Withdraw 100%`, async () => {
                            withdrawRate = 10000;   // 100%
                            beforeStates = afterStates;
                            await withdraw(posId, tokensName, accounts[0], withdrawRate, whichWantBack);
                            afterStates = await getStates(posId, accounts[0], tokensName);
                            saveLogToFile(file, `After withdraw ${withdrawRate/100}%, back token ${
                                backToken[whichWantBack]}`, afterStates)
                        })

                        it(`Check withdraw 100%`, async () => {
                            await checkPosWithdrawResult(beforeStates, afterStates, withdrawRate, whichWantBack);
                        })
                    })

                    after('Recover', async () => {
                        await removeAllLiquidity(token0Address, token1Address, accounts[0]);
                    })

                })
            }
        }
    })
})

async function checkHealth(afterStates) {
    let rs = await getR0R1(afterStates.tokensAddress[0], afterStates.tokensAddress[1]);

    // Swap the token as the depts ratio. return the first token amount after swaping.
    function repayFirstAmount(ds, ns, rs) {
        if (ds[0].isGreaterThan(0) || ds[1].isGreaterThan(0)) {
            return ds[0].multipliedBy(aMulB(rs[1], ns[0]).plus(aMulB(rs[0], ns[1]))).dividedToIntegerBy(
                aMulB(ds[0], rs[1]).plus(aMulB(ds[1], rs[0])));
        } else {
            return ns[0];
        }
    }

    const debts = afterStates.posInfo.debts;
    const tokensAmountInLp = afterStates.goblin.userInfo.tokensAmountInLp;
    let ns = [tokensAmountInLp[0], tokensAmountInLp[1]];

    let health = [0, 0]
    health[0] = repayFirstAmount(debts, ns, rs);
    health[1] = repayFirstAmount([debts[1], debts[0]], [ns[1], ns[0]], [rs[1], rs[0]]);

    equal(afterStates.posInfo.health[0], health[0], `Health[${0}] changes wrong`, false)
    equal(afterStates.posInfo.health[1], health[1], `Health[${1}] changes wrong`, false)
}

async function checkNewHealth(beforeStates, afterStates, depositAmounts) {
    let tokens = afterStates.tokensAddress;
    let targetNewHealth = [0, 0];
    
    if (beforeStates.posInfo.posId == 0) {
        // Create position
        let [largerIdx, value] = await swapToTarget(tokens, depositAmounts, 2);
        targetNewHealth[largerIdx] = value;
    } else {
        // Add, repay, withdraw, swap the other amounts to target
        targetNewHealth = beforeStates.posInfo.newHealth;
        let base = targetNewHealth[0].toNumber() == 0 ? 1 : 0;
        let newHealthInc = await swapToTarget(tokens, depositAmounts, base);
        targetNewHealth[base] = aAddB(targetNewHealth[base], newHealthInc)
    }

    equal(afterStates.posInfo.newHealth, targetNewHealth, false);
}

async function swapToTargetNewHealth(states, targetNewHealth, from) {
    assert(states.posInfo.posId != 0, "Pos id not exist");
    
    let rs = await getR0R1(states.tokensAddress[0], states.tokensAddress[1]);
    let amountsInLp = states.goblin.tokensAmountInLp;
    let base = amountsInLp[0] == 0 ? 1 : 0;
    let principals = states.goblin.principals;

    let rDivN = aDivB(rs[base], amountsInLp[base]);
    let targetRBase = targetNewHealth.multipliedBy(principals[base]).multipliedBy(rDivN).dividedToIntegerBy(20000);

    // Swap to move r[base] equal target r[base]
    let swapFromBaseAmount = aSubB(targetRBase, rs[base]);
    if (swapFromBaseAmount > 0) {
        await swapExactTo(tokens, base, swapFromBaseAmount, from);
    } else if (swapFromBaseAmount < 0) {
        await swapToExact(tokens, 1-base, aMulB(swapFromBaseAmount, -1), from);
    }
}