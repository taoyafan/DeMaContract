'use strict'

const BigNumber = require("bignumber.js");
const erc20TokenGetBalance = require("./lib/utils");
const bankInit = require("../scripts/bank_init.js");

function logObj(obj, name) {
    console.log(` ------------------ ${name}: ------------------ `)
    for (let key in obj) {
        // Not log number
        if (parseFloat(key).toString() == "NaN") {
            console.log(key + ": " + obj[key].toString());
        }
    }
} 

contract("TestBank", (accounts) => {
    // Each contract instance
    let interestModel;
    let bankConfig;
    let bank;
    let usdt;
    let busd;
    let bankFarm;

    // parameters
    let bnbPoolId;
    let bnbFarmTime;
    let usdtPoolId;
    let usdtFarmTime;

    let setReserveBps;
    let setLiquidateBps;
    let bnbAddress;

    before(async () => {
        [interestModel, bankConfig, bank, usdt, busd, bnbPoolId, bnbFarmTime, usdtPoolId, usdtFarmTime, 
            bankFarm, setReserveBps, setLiquidateBps, bnbAddress] = await bankInit();
    });

    describe("Check config's params", async () => {

        it("Get params in config correctly", async () => {
            const getReserveBps = await bankConfig.getReserveBps();
            const getLiquidateBps = await bankConfig.getLiquidateBps();
            const getinterestModel = await bankConfig.defaultModel();

            assert.equal(getReserveBps, setReserveBps, "getReserveBps should equal to setReserveBps.");
            assert.equal(getLiquidateBps, setLiquidateBps, "getLiquidateBps should equal to setLiquidateBps.");
            assert.equal(getinterestModel, interestModel.address, "interestModel should equal to model.address.");
        });

        async function checkInterestRate(utilization, setRate) {
            let getRate = await bankConfig.getInterestRate(10000*utilization, (10000 - 10000*utilization), bnbAddress);
            assert.equal(getRate.toNumber(), setRate.toNumber());
        }

        it("Check interest rate at 0", async () => {
            await checkInterestRate(0, BigNumber(0).dividedToIntegerBy(31536000));
        })

        it("Check interest rate at 22.5%", async () => {
            await checkInterestRate(0.225, BigNumber(5e16).dividedToIntegerBy(31536000));
        })

        it("Check interest rate at 45%", async () => {
            await checkInterestRate(0.45, BigNumber(10e16).dividedToIntegerBy(31536000));
        })

        it("Check interest rate at 65%", async () => {
            await checkInterestRate(0.65, BigNumber(50e16).dividedToIntegerBy(31536000));
        })

        it("Check interest rate at 90%", async () => {
            await checkInterestRate(0.90, BigNumber(100e16).dividedToIntegerBy(31536000));
        })

        it("Check interest rate at 95%", async () => {
            await checkInterestRate(0.95, BigNumber(200e16).dividedToIntegerBy(31536000));
        })

        it("Check interest rate at 100%", async () => {
            await checkInterestRate(1, BigNumber(300e16).dividedToIntegerBy(31536000));
        })

    });

    describe("Check config and banks in bank", async () => {

        it("Get config corrected", async () => {
            let setConfig = await bank.config();
            assert.equal(setConfig, bankConfig.address, 'setConfig should equal to bankConfig.address');
        })

        it("Get banks[BNB]] correctly", async () => {
            let getTokenBank = await bank.banks(bnbAddress);
            assert.equal(getTokenBank.tokenAddr, bnbAddress, `Token address should be ${bnbAddress}`);
            assert.equal(getTokenBank.isOpen, true, 'Token 0 should be opend');
            assert.equal(getTokenBank.canDeposit, true, 'Token 0 should can be Deposited');
        })

        it("Get banks[USDT] correctly", async () => {
            let getTokenBank = await bank.banks(usdt.address);
            assert.equal(getTokenBank.tokenAddr, usdt.address, `Token address should be ${bnbAddress}`);
            assert.equal(getTokenBank.isOpen, true, 'Token 0 should be opend');
            assert.equal(getTokenBank.canDeposit, true, 'Token 0 should can be Deposited');
        })
    })

    describe("Deposit and withdraw BNB", async () => {
        // BNB Amount of send and receive
        let targetSendBNB;
        let targetSendBNBWei;       // BigNumber
        let actualSendBNBWei;       // BigNumber
        let actualReceivedBNBWei;   // BigNumber

        let bankBnbInfo;

        // related Address
        let walletAddress;

        before("Set amount and address", async () => {
            targetSendBNB = 100;
            targetSendBNBWei = BigNumber(web3.utils.toWei(String(targetSendBNB)));

            walletAddress = accounts[0];
        })

        describe("Check deposit result", async () => {

            before("Deposit 100 BNB", async () => {
                let amountBefore = BigNumber(await web3.eth.getBalance(accounts[0]));

                await bank.sendTransaction({value: targetSendBNBWei});

                let amountAfter = BigNumber(await web3.eth.getBalance(accounts[0]));
                actualSendBNBWei = amountBefore.minus(amountAfter);
                bankBnbInfo = await bank.banks(bnbAddress);
            })

            it("Account balance decreased by 100 BNB", async () => {
                assert.equal(actualSendBNBWei.toString(), targetSendBNBWei.toString(),
                 'Account balance should be decreased by 100 BNB')
            })

            it("Bank balance Increased by 100 BNB", async () => {
                let bankBalance = BigNumber(await web3.eth.getBalance(bank.address));
                assert.equal(bankBalance.toString(), targetSendBNBWei.toString())
            })

            it("Check totalToken of bnb in bank", async () => {
                let val = await bank.totalToken(bnbAddress);
                assert.equal(val.toString(), targetSendBNBWei.toString());
            })

            
            it("Check Bank BNB balance", async () => {
                assert.equal(bankBnbInfo.totalVal.toString(), targetSendBNBWei.toString());
            })

            it("Check Bank BNB shares", async () => {
                assert.equal(bankBnbInfo.totalShares.toString(), targetSendBNBWei.toString());
            })

            it("Check user bank num", async () => {
                assert.equal(await bank.userBanksNum(accounts[0]), 1);
            })

            it("Check user first bank address", async () => {
                assert.equal(await bank.userBankAddress(accounts[0], 0), bnbAddress);
            })

            it("Check user shares", async () => {
                let userShares = await bank.userSharesPreTokoen(accounts[0], bnbAddress)
                assert.equal(userShares.toString(), targetSendBNBWei.toString());
            })

            it("Check farm total shares", async () => {
                let farmBnbPool = await bankFarm.poolInfo(bnbPoolId);
                logObj(farmBnbPool, "farm bnb pool info");

                // Include invited shares.
                assert.equal(farmBnbPool.totalShares.toString(), targetSendBNBWei.multipliedBy(1.1).toString());
            })

            it("Check farm user shares", async () => {
                let userFarmBnbPool = await bankFarm.userStakeInfo(bnbPoolId, accounts[0]);
                logObj(userFarmBnbPool, "farm bnb pool user info");

                assert.equal(userFarmBnbPool.shares.toString(), targetSendBNBWei.toString());
            })
        })

        // describe("Check withdraw result", async () => {

        //     before("withdraw 100 BNB", async () => {
        //         let amountBefore = BigNumber(await web3.eth.getBalance(accounts[0]));

        //         await bank.withdraw(bnbAddress, targetSendBNBWei);

        //         let amountAfter = BigNumber(await web3.eth.getBalance(accounts[0]));
        //         actualReceivedBNBWei = amountAfter.minus(amountBefore);
        //     })

        //     it("Account balance increased by 100 BNB", async () => {
        //         assert.equal(actualReceivedBNBWei.toString(), targetSendBNBWei.toString(),
        //             "Account balance should increased by 100 BNB ")
        //     })

        //     it("Burned 100 oBNB", async () => {
        //         let amountOBNB = await erc20TokenGetBalance(oTokenAddress, walletAddress);
        //         assert.equal(amountOBNB.toNumber(), 0, "Should Burned 100 oBNB");
        //     })
        // })
    })

    // describe("Deposit and withdraw USDT", async () => {
    //     // USDT Amount of send and receive
    //     let targetSendUSDT;
    //     let targetSendUSDTWei;
    //     let actualSendUSDT;       // BigNumber
    //     let actualReceivedUSDT;   // BigNumber

    //     // related Address
    //     let oTokenAddress;
    //     let walletAddress;

    //     before("Set amount and address", async () => {
    //         targetSendUSDT = 100;
    //         targetSendUSDTWei = BigNumber(web3.utils.toWei(String(targetSendUSDT)));

    //         let getTokenBank = await bank.banks(usdt.address);
    //         oTokenAddress = getTokenBank.pTokenAddr;
    //         walletAddress = accounts[0];
    //     })

    //     describe("Check deposit result", async () => {

    //         before("Deposit 100 USDT", async () => {
    //             let amountBefore = await erc20TokenGetBalance(usdt.address, walletAddress);
    //             // contract.mBNBods.approve(contractAddress, web3.utils.toWei('79228162514', "BNBer")).send({ from: address })
    //             await usdt.approve(bank.address, web3.utils.toWei('79228162514'));
    //             await bank.deposit(usdt.address, targetSendUSDTWei);

    //             let amountAfter = await erc20TokenGetBalance(usdt.address, walletAddress);
    //             actualSendUSDT = amountBefore.minus(amountAfter);
    //         })

    //         it("Account balance decreased by 100 USDT", async () => {
    //             assert.equal(actualSendUSDT.toString(), targetSendUSDT.toString(),
    //              'Account balance should be decreased by 100 USDT')
    //         })

    //         it("Received 100 oUSDT", async () => {
    //             let amountOUSDT = await erc20TokenGetBalance(oTokenAddress, walletAddress);
    //             assert.equal(amountOUSDT.toNumber(), targetSendUSDT, "Should receive 100 oUSDT");
    //         })
    //     })

    //     describe("Check withdraw result", async () => {

    //         before("withdraw 100 USDT", async () => {
    //             let amountBefore = await erc20TokenGetBalance(usdt.address, walletAddress);

    //             await bank.withdraw(usdt.address, targetSendUSDTWei);

    //             let amountAfter = await erc20TokenGetBalance(usdt.address, walletAddress);
    //             actualReceivedUSDT = amountAfter.minus(amountBefore);
    //         })

    //         it("Account balance increased by 100 USDT", async () => {
    //             assert.equal(actualReceivedUSDT.toString(), targetSendUSDT.toString(),
    //                 "Account balance should increased by 100 USDT ")
    //         })

    //         it("Burned 100 oUSDT", async () => {
    //             let amountOBNB = await erc20TokenGetBalance(oTokenAddress, walletAddress);
    //             assert.equal(amountOBNB.toNumber(), 0, "Should Burned 100 oUSDT");
    //         })
    //     })
    // })

    // async function lpTest(nameA, nameB, addressA, addressB) {

    //     describe("BNB-USDT-LP Production Test", async () => {

    //         before(`Deposit {nameA} and {nameB}`, async () => {

    //         });

    //         describe(`Borrow only {nameA}`, async () => {

    //             before(`Open production`, async () => {

    //             });

    //             it("Check left amount", async () => {

    //             });

    //             it()

    //         });

    //     });

    // }


    // describe("BUSD-USDT-LP Test", async () => {
    // });
});
