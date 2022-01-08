const WBNB = artifacts.require("WBNB");
const ERC20Token = artifacts.require("ERC20Token");
const Bank = artifacts.require("Bank");
const{ expectRevert  } = require('@openzeppelin/test-helpers');

const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 30 })

const file = `test/log/prod_liquidate.json`;
const dex = "Cake";

const {
    bnbAddress,
    getContractInstance,
    setDex,
    setNetwork,
    saveLogToFile,
    initFile,
    getStates,
    equal,
    transfer,
    swapExactTo,
    swapToExact,
    addLiquidate,
    removeAllLiquidity,
    swapToTarget,
    getR0R1,
    toWei,
    fromWei,
    toNum,
    aSubB,
    aAddB,
    aMulB,
    aDivB,
} = require("../js_utils/utils");

setDex(dex);
const {addressJson, name2Address} = setNetwork('development', web3)

const {
    createPosition,
    replenishment,
    repay,
    withdraw,
    convertWithdrawFormat,
    checkPosResult,
} = require("../js_utils/prod_interface");

const { assert } = require("console");

contract("TestProductionLiquidate", (accounts) => {

    let wbnb;
    let usdt;
    let busd;
    let dexToken;
    let bank;

    let tokenPairs = [['Bnb', 'Busd'], ['Usdt', 'Busd'], ['Usdt', 'Busd'], [dex, 'Busd']];
    let r = [[10000, 2000000], [2000000, 2000000], [2000000, 10000], [10000, 2000000]]

    before('Init', async () => {
        initFile(file);

        wbnb = await WBNB.at(addressJson.WBNB);
        usdt = await ERC20Token.at(addressJson.USDT);
        busd = await ERC20Token.at(addressJson.BUSD);
        bank = await Bank.at(addressJson.Bank);
        dexToken = await getContractInstance("DexToken");

        // Deposit token in bank.
        let amount = toWei(2000);
        await bank.deposit(bnbAddress, amount, {from: accounts[0], value: amount});

        await dexToken.approve(bank.address, amount, {from: accounts[0]});
        await bank.deposit(dexToken.address, amount, {from: accounts[0]});

        await usdt.approve(bank.address, amount, {from: accounts[0]});
        await bank.deposit(usdt.address, amount, {from: accounts[0]});

        await busd.approve(bank.address, amount, {from: accounts[0]});
        await bank.deposit(busd.address, amount, {from: accounts[0]});
    })

    describe('Positions usage test', async () => {

        // for (i = 0; i < 3; i++) {
        //     forEachTokenPair(tokenPairs[i], r[i]);
        // }

        forEachTokenPair(tokenPairs[0], r[0]);


        async function forEachTokenPair(tokensName, r) {
            let depositArray = [[2, 1], [1, 2], [2, 0], [0, 2]];
            let borrowsArray = [[0, 0], [0, 1], [1, 0], [2, 1], [1, 2]];

            depositArray.forEach((deposits) => {
                deposits.forEach((a, i, arr) => { arr[i] = r[i] / 10000 * a })
            })

            borrowsArray.forEach((borrows) => {
                borrows.forEach((a, i, arr) => { arr[i] = r[i] / 10000 * a })
            })

            for (deposits of depositArray) {
                for (borrows of borrowsArray) {
                    forEachBorrow(tokensName, deposits, borrows, r);
                }
                // break
            }

            // forEachBorrow(tokensName, depositArray[1], borrowsArray[0], r);
            // forEachBorrow(tokensName, depositArray[3], borrowsArray[4], r);

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

                    // 1. Check health and new health
                    describe(`\n\nTest create position`, async () => {

                        before(`Create position`, async () => {
                            beforeStates = await getStates(0, accounts[0], tokensName);
                            saveLogToFile(file, `Before create position`, beforeStates)

                            posId = await createPosition(tokensName, accounts[0], deposits, borrows, 0);

                            afterStates = await getStates(posId, accounts[0], tokensName);
                            saveLogToFile(file, `After create position`, afterStates)
                        })

                        it(`Check create position result`, async () => {
                            await checkHealth(afterStates);
                            await checkNewHealth(beforeStates, afterStates, [deposits[0], deposits[1]]);
                        })

                        it(`Liquidate should failed`, async () => {
                            await expectRevert(bank.liquidate(posId), `can't liquidate`);
                        })
                    })

                    // 2. Swap to make new health to 50%, check new health
                    describe(`\n\nTest new health after swap`, async () => {

                        before(`Swap to target newHealth equal to 50%`, async () => {
                            beforeStates = afterStates;
                            await swapToTargetNewHealth(beforeStates, 5000, accounts[0]);
                            afterStates = await getStates(posId, accounts[0], tokensName);
                            saveLogToFile(file, `After move new health to 50%`, afterStates);
                        })

                        it(`Check health and new health`, async () => {
                            await checkHealth(afterStates);
                            await checkNewHealth(beforeStates, afterStates, [0, 0]);
                            equal(toWei(afterStates.posInfo.newHealth), toWei(5000), `New health changes wrong`, false);
                        })
                    })

                    // 3. Replenishment same as init, new health should be around 75%
                    describe(`\n\nTest replenishment`, async () => {
                        before(`replenishment`, async () => {
                            beforeStates = afterStates;
                            await replenishment(posId, tokensName, accounts[0], [deposits[0], deposits[1]], borrows, 0);
                            afterStates = await getStates(posId, accounts[0], tokensName);
                            saveLogToFile(file, `After replenishment`, afterStates)
                        })

                        it(`Check replenishment result`, async () => {
                            await checkHealth(afterStates);
                            await checkNewHealth(beforeStates, afterStates, [deposits[0], deposits[1]]);
                        })
                    })

                    // 4. Withdraw 50%, new health should be 75%, check health
                    describe(`\n\nTest withdraw`, async () => {

                        let withdrawRate = 5000;
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
                            await checkHealth(afterStates);
                            let [deposits, borrows] = await convertWithdrawFormat(beforeStates, withdrawRate, whichWantBack);
                            await checkNewHealth(beforeStates, afterStates, [deposits[0], deposits[1]]);
                        })
                    })

                    // 5. Repay 10%， new health should be 75%, check health
                    describe(`\n\nTest repay`, async () => {

                        let withdrawRate = 1000;

                        before(`Before`, async () => {
                            beforeStates = afterStates;
                            await repay(posId, tokensName, accounts[0], withdrawRate);
                            afterStates = await getStates(posId, accounts[0], tokensName);
                            saveLogToFile(file, `After repay ${withdrawRate/100}%`, afterStates)
                        })

                        it(`Repay ${withdrawRate/100}%`, async () => {
                            await checkHealth(afterStates);
                            let [deposits, borrows] = await convertWithdrawFormat(beforeStates, withdrawRate, 3);
                            await checkNewHealth(beforeStates, afterStates, [deposits[0], deposits[1]]);
                        })
                    })

                    // 6. Swap to make new health to 50%, Liquidate
                    describe(`\n\nTest liquidate`, async () => {
                        let killer = accounts[1];
                        let killerbeforeStates;

                        before(`Swap to target newHealth equal to 50%`, async () => {
                            beforeStates = afterStates;
                            await swapToTargetNewHealth(beforeStates, 5000, accounts[0]);
                            afterStates = await getStates(posId, accounts[0], tokensName);
                            saveLogToFile(file, `After move new health to 50%`, afterStates);
                        })

                        it(`Check health and new health`, async () => {
                            await checkHealth(afterStates);
                            await checkNewHealth(beforeStates, afterStates, [0, 0]);
                        })

                        it(`Liquidate`, async () => {
                            beforeStates = afterStates;
                            killerbeforeStates = await getStates(posId, killer, tokensName);
                            // saveLogToFile(file, `Killer before liquidate`, killerbeforeStates);

                            await bank.liquidate(posId, {from: killer});
                            await bank.getRewardsAllProd();
                        })

                        it(`Check liquidate result`, async () => {
                            afterStates = await getStates(posId, accounts[0], tokensName);
                            saveLogToFile(file, `After liquidate`, afterStates);

                            let killerAfterStates = await getStates(posId, killer, tokensName);
                            // saveLogToFile(file, `Killer After liquidate`, killerAfterStates);
                            
                            let [deposits, borrows] = await convertWithdrawFormat(beforeStates, 10000, 2);
                            let killerRewards = [aSubB(killerAfterStates.userBalance[0], killerbeforeStates.userBalance[0]),
                                                 aSubB(killerAfterStates.userBalance[1], killerbeforeStates.userBalance[1])];
                            
                            console.log(`Killer rewards: ${[fromWei(killerRewards[0]), fromWei(killerRewards[1])]}`);
                            console.log(`Return to owner: ${[fromWei(-deposits[0]), fromWei(-deposits[1])]}`);
                            
                            equal(killerRewards[0], aDivB(-deposits[0], 10), "Killer reward[0] not correct", false, token0Address);
                            equal(killerRewards[1], aDivB(-deposits[1], 10), "Killer reward[1] not correct", false, token1Address);
                            
                            await transfer(afterStates.tokensAddress[0], accounts[0], killerRewards[0], killer);
                            await transfer(afterStates.tokensAddress[1], accounts[0], killerRewards[1], killer);
                            
                            afterStates = await getStates(posId, accounts[0], tokensName);
                            saveLogToFile(file, `After receive killer's reward`, afterStates);

                            await checkPosResult(beforeStates, afterStates, deposits, borrows);
                        })
                    })

                    after('Recover', async () => {
                        await removeAllLiquidity(token0Address, token1Address, accounts[0]);
                    })

                })
            }
        }
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
        let tokens = beforeStates.tokensAddress;
        let targetNewHealth = [0, 0];
        let targetPrincipals = 0;
        let principals = beforeStates.goblin.principals;
        let largerIdx;
    
        if (beforeStates.posInfo.posId == 0) {
            // Create position
            [largerIdx, value] = await swapToTarget(tokens, depositAmounts, 2);
            targetPrincipals = value;
            targetNewHealth[largerIdx] = 10000;
        } else {
            // Add, repay, withdraw, swap the other amounts to target
            // Calc target principals
            largerIdx = toNum(principals[0]) == 0 ? 1 : 0;
            let targetAmount = await swapToTarget(tokens, depositAmounts, largerIdx);
            targetPrincipals = aAddB(principals[largerIdx], targetAmount);
            
            // Calc target new health
            let amountsInLp = afterStates.goblin.userInfo.tokensAmountInLp;
            let debts = afterStates.posInfo.debts;
            let rs = await getR0R1(tokens[0], tokens[1]);
            targetNewHealth[largerIdx] = _newHealth(amountsInLp[largerIdx], amountsInLp[1-largerIdx], 
                debts[largerIdx], debts[1-largerIdx], rs[largerIdx], rs[1-largerIdx], targetPrincipals);
        }
    
        equal(afterStates.goblin.principals[largerIdx], targetPrincipals, `Principals changes wrong`, false);
        equal(toWei(afterStates.posInfo.newHealth), toWei(targetNewHealth[largerIdx]), `New health changes wrong`, false);
    }
    
    function _newHealth(na, nb, da, db, ra, rb, pa) {
        na = toNum(fromWei(na))
        nb = toNum(fromWei(nb))
        da = toNum(fromWei(da))
        db = toNum(fromWei(db))
        ra = toNum(fromWei(ra))
        rb = toNum(fromWei(rb))
        pa = toNum(fromWei(pa))
        
        console.log(`na: ${na}, nb: ${nb} da: ${da}, db: ${db}, ra: ${ra}, rb: ${rb}, pa: ${pa}`)
    
        let h = (na - da + (nb - db) * ra / rb) / pa;
        h = aDivB(aMulB(h, 10000), 1);
    
        console.log(`New health: ${h}`)
    
        return h
    }
    
    function _newRa(na, da, db, ra, rb, pa, h) {
        na = toNum(fromWei(na))
        da = toNum(fromWei(da))
        db = toNum(fromWei(db))
        ra = toNum(fromWei(ra))
        rb = toNum(fromWei(rb))
        pa = toNum(fromWei(pa))
    
        console.log(`na: ${na}, da: ${da}, db: ${db}, ra: ${ra}, rb: ${rb}, pa: ${pa}, h: ${h}`)
    
        k = ra * rb;
        eta = na / ra;
    
        a = db / k;
        b = -2 * eta;
        c = da + pa * h;
    
        let newRa;
    
        if (a == 0) {
            newRa = (da + pa * h) / (2 * eta);
        } else {
            newRa = (-b - (b*b - 4*a*c) ** 0.5) / (2*a);
        }
        
        console.log(`new ra: ${newRa}`)
        
        return toWei(newRa);
    }
    
    async function swapToTargetNewHealth(states, targetNewHealth, from) {
        assert(states.posInfo.posId != 0, "Pos id not exist");
        
        let tokens = states.tokensAddress;
    
        // Get the base idx
        let principals = states.goblin.principals;
        let base = principals[0] == 0 ? 1 : 0;
    
        // Calc target r[base]
        let amountsInLp = states.goblin.userInfo.tokensAmountInLp;
        let debts = states.posInfo.debts;
        let rs = await getR0R1(tokens[0], tokens[1]);
        let targetRBase = _newRa(amountsInLp[base], debts[base], debts[1-base], 
            rs[base], rs[1-base], principals[base], aDivB(targetNewHealth, 10000, false));
        
        // Swap to move r[base] equal target r[base]
        if (targetRBase) {
            let swapFromBaseAmount = aSubB(targetRBase, rs[base]);
            
            if (swapFromBaseAmount > 0) {
                await swapExactTo(tokens, base, swapFromBaseAmount, from);
            } else if (swapFromBaseAmount < 0) {
                await swapToExact(tokens, 1-base, aMulB(swapFromBaseAmount, -1), from);
            }
    
            return true
        } else {
            return false
        }
    }
})