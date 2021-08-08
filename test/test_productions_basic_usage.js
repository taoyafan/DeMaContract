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

const file = `test/log/prod_basic_usage.json`;

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

contract("TestProduction", (accounts) => {

    let factory;
    let wbnb;
    let busd;
    let router;
    let mdx;
    let bank;
    let reinvestment;

    let tokenPair = [['Bnb', 'Busd'], ['Busd', 'Bnb'], ['Mdx', 'Busd']];
    let r0r1 = [[1000, 200000], [200000, 1000], [1000, 200000]];

    before('Init', async () => {
        initFile(file);

        // factory = await MdexFactory.at(addressJson.MdexFactory);
        wbnb = await WBNB.at(addressJson.WBNB);
        busd = await ERC20Token.at(addressJson.BUSD);
        // router = await MdexRouter.at(addressJson.MdexRouter);
        mdx = await MdxToken.at(addressJson.MdxToken);
        bank = await Bank.at(addressJson.Bank);
        // reinvestment = await Reinvestment.at(addressJson.Reinvestment);

        // Deposit token in bank.
        let amount = toWei(2000);
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
            // break;  // TODO debug only, need to remove.
        }

        async function forEachTokenPair(tokensName, r) {

            let depositArray = [[1, 10]];
            let borrowsArray = [[0, 0], [0, 1], [1, 0], [1, 100]];

            for(borrows of borrowsArray) {
                forEachBorrow(tokensName, depositArray[0], borrows, r);
            }

            // forEachBorrow(tokensName, depositArray[0], borrowsArray[3], r);

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
                            // logObj(beforeStates, "beforeStates");
                            saveLogToFile(file, `Before create position`, beforeStates)

                            posId = await createPosition(tokensName, accounts[0], [deposits[0], deposits[1]], borrows, 0);

                            afterStates = await getStates(posId, accounts[0], tokensName);
                            // logObj(afterStates, "afterStates");
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
                            await checkPosWithdrawResult(beforeStates, afterStates, withdrawRate, whichWantBack);
                        })

                        it(`Withdraw 100%`, async () => {
                            withdrawRate = 10000;   // 100%
                            beforeStates = afterStates;
                            await withdraw(posId, tokensName, accounts[0], withdrawRate, whichWantBack);
                            afterStates = await getStates(posId, accounts[0], tokensName);
                            saveLogToFile(file, `After withdraw ${withdrawRate/100}%, back token ${
                                backToken[whichWantBack]}`, afterStates)
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

    async function checkPosWithdrawResult(beforeStates, afterStates, withdrawRate, whichWantBack) {
        const tokensAmountInLp = await getTokenAmountInLp(beforeStates.tokensAddress, beforeStates.goblin.lpAmount)
        let toUser = [0, 0], toBank = [0, 0]; 
        const debts = beforeStates.posInfo.debts;

        let ns = [aDivB(aMulB(tokensAmountInLp[0], withdrawRate), 10000),
                  aDivB(aMulB(tokensAmountInLp[1], withdrawRate), 10000)];

        // If repay
        if (whichWantBack == 3) {
            let rs = await getR0R1(beforeStates.tokensAddress[0], beforeStates.tokensAddress[1])
            
            function repayFirstAmount(ds, ns, rs) {
                if (ds[0].isGreaterThan(0) || ds[1].isGreaterThan(0)) {
                    return ds[0].multipliedBy(aMulB(rs[1], ns[0]).plus(aMulB(rs[0], ns[1]))).dividedToIntegerBy(
                        aMulB(ds[0], rs[1]).plus(aMulB(ds[1], rs[0])));
                } else {
                    return ns[0];
                }
            }

            toBank[0] = repayFirstAmount(debts, ns, rs);
            toBank[1] = repayFirstAmount([debts[1], debts[0]], [ns[1], ns[0]], [rs[1], rs[0]]);

            for (i = 0; i < 2; ++i) {
                if (toBank[i].isGreaterThan(debts[i])) {
                    // We can repay all debts

                    if (ns[i].isGreaterThan(debts[i])) {
                        // Don't need to swap

                        if (ns[i].isLessThan(toBank[i])) {
                            // But swap to this from another, Then recover.
                            let redundant = aSubB(toBank[i], ns[i]);
                            toUser[i] = aSubB(ns[i], debts[i]);
                            toUser[1-i] = aAddB(toUser[1-i], redundant.multipliedBy(rs[1-i]).dividedToIntegerBy(rs[i]));
                        } else {
                            // Swap some token to another
                            let leftAmount = aSubB(toBank[i], debts[i]);
                            toUser[i] = aAddB(toUser[i], leftAmount);
                        }

                    } else {
                        // Need to swap from another token, but swap a lot
                        let redundant = aSubB(toBank[i], debts[i]);
                        toUser[1-i] = aAddB(toUser[1-i], redundant.multipliedBy(rs[1-i]).dividedToIntegerBy(rs[i]));
                        toUser[i] = 0;
                    }

                    toBank[i] = debts[i];  
                } else {
                    // All token used to repay, There are no left to user
                }
            }
            console.log(`After repay, to bank: ${fromWei(toBank[0])}, ${fromWei(toBank[1])}, to user: ${
                [fromWei(toUser[0]), fromWei(toUser[1])]}`);
        } else {
            toBank[0] = aDivB(aMulB(debts[0], withdrawRate), 10000);
            toBank[1] = aDivB(aMulB(debts[1], withdrawRate), 10000);
            
            toUser[0] = aSubB(ns[0], toBank[0]);
            toUser[1] = aSubB(ns[1], toBank[1]);
        }
        
        if (whichWantBack == 0) {
            toUser[0] = await swapToTarget(beforeStates.tokensAddress, toUser, 0);
            toUser[1] = 0;
        } else if (whichWantBack == 1) {
            toUser[0] = 0;
            toUser[1] = await swapToTarget(beforeStates.tokensAddress, toUser, 1);
        } else {
            // Don't swap
        }

        let depositAmounts = [-toUser[0], -toUser[1]];
        let borrowAmounts = [-toBank[0], -toBank[1]];

        await checkPosAddResult(beforeStates, afterStates, depositAmounts, borrowAmounts)
    }

    // Assuming there is no time elapse
    async function checkPosAddResult(beforeStates, afterStates, depositAmounts, borrowAmounts) {
        const tokens = afterStates.tokensAddress;
        
        for (i = 0; i < 2; ++i) {
            // Check user balance
            let userIncBalance = aSubB(afterStates.userBalance[i], beforeStates.userBalance[i]);
            equal(userIncBalance, -depositAmounts[i], `User balance[${i}] changes wrong`, false, tokens[i])
            
            // Check bank balance
            let bankIncBalance = aSubB(afterStates.bankBalance[i], beforeStates.bankBalance[i]);
            equal(bankIncBalance, -borrowAmounts[i], `Bank balance[${i}] changes wrong`, false, tokens[i])

            // Check bank total val
            let bankIncVal = aSubB(afterStates.banksInfo[i].totalVal, beforeStates.banksInfo[i].totalVal);
            equal(bankIncVal, bankIncBalance, `Bank val[${i}] changes wrong`, true, tokens[i])
            
            // Check bank total debt
            let bankIncDebt = aSubB(afterStates.banksInfo[i].totalDebt, beforeStates.banksInfo[i].totalDebt);
            equal(bankIncDebt, -bankIncBalance, `Bank debt[${i}] changes wrong`, false, tokens[i])

            // Pos debt share
            let userPosIncDebt = aSubB(afterStates.posInfo.debts[i], beforeStates.posInfo.debts[i])
            equal(userPosIncDebt, -bankIncBalance, `Pos debtShare[${i}] changes wrong`, false, tokens[i])
        }

        // Check goblin states
        // - Lp amount
        let IncLpAmount = aSubB(afterStates.goblin.lpAmount, beforeStates.goblin.lpAmount);
        let IncLpTo0Amount = await swapAllLpToToken0(tokens[0], tokens[1], IncLpAmount);
        let targetTo0Amount = await swapToTarget(tokens, [aAddB(depositAmounts[0], borrowAmounts[0]), 
                                                        aAddB(depositAmounts[1], borrowAmounts[1])]);
        
        equal(IncLpTo0Amount, targetTo0Amount, `Lp amount changes wrong`, false);
        
        // - Principals
        let [r0, r1] = await getR0R1(tokens[0], tokens[1]);
        let targetPrincipal = [0, 0];
        if (beforeStates.goblin.principals[0].toNumber() == 0 && 
            beforeStates.goblin.principals[1].toNumber() == 0) {
            // Create position
            if (aMulB(depositAmounts[0], r1) > aMulB(depositAmounts[1], r0)) {
                targetPrincipal[0] = await swapToTarget(tokens, depositAmounts, 0);
            } else {
                targetPrincipal[1] = await swapToTarget(tokens, depositAmounts, 1);
            }
        } else {
            if (beforeStates.goblin.principals[0].toNumber() > 0) {
                targetPrincipal[0] = await swapToTarget(tokens, depositAmounts, 0);
            } else {
                targetPrincipal[1] = await swapToTarget(tokens, depositAmounts, 1);
            } 
        }
        
        for (i = 0; i < 2; ++i) {
            let principal = aSubB(afterStates.goblin.principals[i], beforeStates.goblin.principals[i]);
            if (targetPrincipal[i] < 0) {
                // It's a withdraw operation
                if(BigNumber(-targetPrincipal[i]).isGreaterThan(beforeStates.goblin.principals[i])) {
                    targetPrincipal[i] = BigNumber(-beforeStates.goblin.principals[i])
                }
            }
            equal(principal, targetPrincipal[i], `Principal[${i}] amounts changes wrong`, false); 
        }
            

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
            if (afterStates.allPosId[i] == afterStates.posInfo.posId, false) {
                equal(afterStates.allPosHealth[i], 10000, 'Health wrong');
                break;
            }
        }
    }
})
