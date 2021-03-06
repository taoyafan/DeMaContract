const WBNB = artifacts.require("WBNB");
const ERC20Token = artifacts.require("ERC20Token");
const Bank = artifacts.require("Bank");

const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 30 })

const file = `test/log/prod_basic_usage.json`;
const dex = "Cake";

const {
    bnbAddress,
    getContractInstance,
    setDex,
    setNetwork,
    saveLogToFile,
    initFile,
    getStates,
    addLiquidate,
    removeAllLiquidity,
    toWei,
    fromWei,
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

const {
    reinvest,
} = require("../js_utils/other_interface");

contract("TestProduction", (accounts) => {

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
        let amount = toWei(20000);
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

        forEachTokenPair(tokenPairs[2], r[2]);


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
            }

            // forEachBorrow(tokensName, depositArray[2], borrowsArray[3], r);

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

                            posId = await createPosition(tokensName, accounts[0], deposits, borrows, 0);

                            afterStates = await getStates(posId, accounts[0], tokensName);
                            // logObj(afterStates, "afterStates");
                            saveLogToFile(file, `After create position`, afterStates)
                        })

                        it(`Check create position result`, async () => {
                            await checkPosResult(beforeStates, afterStates, [deposits[0], deposits[1]], borrows);
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
                            await checkPosResult(beforeStates, afterStates, [deposits[0], deposits[1]], borrows);
                        })
                    })

                    describe(`\n\nTest reinvest`, async () => {
                        it(`reinvest`, async () => {
                            beforeStates = afterStates;
                            await reinvest();
                            afterStates = await getStates(posId, accounts[0], tokensName);
                            saveLogToFile(file, `After reinvest`, afterStates)
                            assert.equal(afterStates.reinvest.DexTokenBalance, 0, 
                                "After reinvest, dex token balance of reinvestment should be 0");
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
                            let [deposits, borrows] = await convertWithdrawFormat(beforeStates, withdrawRate, 3);
                            await checkPosResult(beforeStates, afterStates, deposits, borrows, true)
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
                            let [deposits, borrows] = await convertWithdrawFormat(beforeStates, withdrawRate, whichWantBack);
                            await checkPosResult(beforeStates, afterStates, deposits, borrows)
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
                            let [deposits, borrows] = await convertWithdrawFormat(beforeStates, withdrawRate, whichWantBack);
                            await checkPosResult(beforeStates, afterStates, deposits, borrows)
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
