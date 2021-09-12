'use strict'

const BigNumber = require("bignumber.js");
const BN = web3.utils.BN;
const erc20TokenGetBalance = require("../js_utils/utils");
const bankInit = require("../scripts/bank_init.js");
const{ expectEvent, shouldFail, time } = require('@openzeppelin/test-helpers');

function logObj(obj, name) {
    console.log(` ------------------ ${name}: ------------------ `)
    for (let key in obj) {
        // Not log number
        if (parseFloat(key).toString() == "NaN") {
            console.log(key + ": " + obj[key].toString());
        }
    }
}

async function logFarmBonusInfo(farm, account, when) {
    console.log(` ------------------------------------ farm bonus info ${when} ------------------------------------ `)
    let num = await farm.bonusPoolsLength(account);
    for (let i = 0; i < num; ++i) {
        let id = await farm.bonusPoolsId(account, i);
        console.log(`Pool id is ${id}`);

        let poolInfo = await farm.poolInfo(id);
        logObj(poolInfo, "farm pool info before withdraw");
        let userInfo = await farm.bonus(id, account);
        logObj(userInfo, "farm pool user info before withdraw");

        console.log(`Earn of this pool is ${await farm.bonusEarnedPerPool(id, account)} `)
    }
}

function logFarmInviterBonusInfo(farm, account, when) {
    console.log(` ------------------------------------ farm inviter bonus info ${when} ------------------------------------ `)
}

contract("TestBank", (accounts) => {
    // Each contract instance
    let interestModel;
    let bankConfig;
    let bank;
    let usdt;
    let busd;
    let bankFarm;
    let dema;

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
            bankFarm, dema, setReserveBps, setLiquidateBps, bnbAddress] = await bankInit();
        console.log(`------------------ BNB pool id is ${bnbPoolId}, USDT pool id is ${usdtPoolId}`)
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
        let targetSendBNB = 1;
        let targetSendBNBWei = BigNumber(web3.utils.toWei(String(targetSendBNB)));       // BigNumber
        let actualSendBNBWei;       // BigNumber
        let actualReceivedBNBWei;   // BigNumber

        let bankBnbInfo;
        let depositTime;
        let withdrawTime;

        describe("Deposit test", async () => {

            before(`Deposit ${targetSendBNB} BNB`, async () => {
                let amountBefore = BigNumber(await web3.eth.getBalance(accounts[0]));

                // await bank.sendTransaction({value: targetSendBNBWei});
                await bank.deposit(bnbAddress, targetSendBNBWei, {value: targetSendBNBWei});
                depositTime = await time.latest();
                console.log("Deposit time: " + depositTime);

                let amountAfter = BigNumber(await web3.eth.getBalance(accounts[0]));
                actualSendBNBWei = amountBefore.minus(amountAfter);
                bankBnbInfo = await bank.banks(bnbAddress);
            })

            it(`Account balance decreased by ${targetSendBNB} BNB`, async () => {
                let actualSendBNB = actualSendBNBWei.dividedToIntegerBy(1e18);
                assert.equal(actualSendBNB.toString(), targetSendBNB.toString(),
                 `Account balance should be decreased by ${targetSendBNB} BNB`)
            })

            it(`Bank balance Increased by ${targetSendBNB} BNB`, async () => {
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

            it("Check user deposited amount", async () => {
                let userShares = await bank.userSharesPreTokoen(accounts[0], bnbAddress)
                assert.equal(userShares.toString(), targetSendBNBWei.toString());
            })

            // --------------------------- Check farm global and staked info ---------------------------

            it("Check farm total shares and rewardRate", async () => {
                let farmBnbPool = await bankFarm.poolInfo(bnbPoolId);
                let rewardRate = BigNumber(farmBnbPool.rewardsed).dividedToIntegerBy(farmBnbPool.periodDuration);

                logObj(farmBnbPool, "farm bnb pool info");

                // Include invited shares.
                assert.equal(farmBnbPool.totalShares.toString(), targetSendBNBWei.multipliedBy(1.1).toString());
                assert.equal(farmBnbPool.rewardRate.toString(), rewardRate.toString());
            })

            it("Check farm user staked shares", async () => {
                let userFarmBnbPool = await bankFarm.userStakeInfo(bnbPoolId, accounts[0]);
                logObj(userFarmBnbPool, "farm bnb pool user info");

                assert.equal(userFarmBnbPool.shares.toString(), targetSendBNBWei.toString());
            })

            // --------------------------- Check bonus ---------------------------

            it("Check farm user bonus pool length", async () => {
                let poolLen = await bankFarm.bonusPoolsLength(accounts[0]);
                assert.equal(poolLen.toString(), '1');
            })

            it("Check farm user bonus pool id", async () => {
                let poolId = await bankFarm.bonusPoolsId(accounts[0], 0);
                assert.equal(poolId.toNumber(), bnbPoolId);
            })

            it("Check farm user bonus shares", async () => {
                let bonusInfo = await bankFarm.bonus(bnbPoolId, accounts[0]);
                assert.equal(bonusInfo.shares.toString(), targetSendBNBWei.multipliedBy(0.05).toString());
            })

            // --------------------------- Check inviter shares ---------------------------

            it("Check farm inviter bonus pool length", async () => {
                let poolLen = await bankFarm.inviterBonusPoolsLength(accounts[0]);
                assert.equal(poolLen.toString(), '1');
            })

            it("Check farm inviter bonus pool id", async () => {
                let poolId = await bankFarm.inviterBonusPoolsId(accounts[0], 0);
                assert.equal(poolId.toNumber(), bnbPoolId);
            })

            it("Check farm inviter bonus shares", async () => {
                let userFarmBnbPool = await bankFarm.inviterBonus(bnbPoolId, accounts[0]);
                assert.equal(userFarmBnbPool.shares.toString(), targetSendBNBWei.multipliedBy(0.05).toString());
            })
        })

        describe("Check earn after 30 second", async () => {

            let deltaT;
            let bn1e18 = new BN(BigNumber(1e18).toString());

            before("After 30 second", async () => {
                await time.increaseTo(depositTime.add(time.duration.seconds(30)));
                await time.advanceBlock();
                withdrawTime = await time.latest();
                console.log("withdrawTime time is: " + withdrawTime);
                deltaT = withdrawTime.sub(depositTime);
                console.log("Delta time is: " + deltaT);
            })

            it("Check reward per token", async () => {
                let reward = await bankFarm.rewardPerToken(bnbPoolId);
                let farmBnbPool = await bankFarm.poolInfo(bnbPoolId);

                logObj(farmBnbPool, `farm bnb pool info after ${deltaT} seconds.`);

                let rewardRate = farmBnbPool.rewardRate;
                let shares = farmBnbPool.totalShares;

                console.log(`Reward per token is ${reward}`);
                assert.equal(reward.toString(), rewardRate.mul(deltaT).mul(bn1e18).div(shares).toString());
            })

            it("Check stake earn", async () => {
                await checkTotalEarn([bnbPoolId], accounts[0], 0);
            })

            it("Check bonus earn", async () => {
                await checkTotalEarn([bnbPoolId], accounts[0], 1);
            })

            it("Check inviter earn", async () => {
                await checkTotalEarn([bnbPoolId], accounts[0], 2);
            })
        })

        describe("Withdraw test", async () => {

            let earn;
            let demaBefore;
            let demaAfter;

            before(`withdraw ${targetSendBNB} BNB`, async () => {
                let amountBefore = BigNumber(await web3.eth.getBalance(accounts[0]));
                demaBefore = await dema.balanceOf(accounts[0]);

                // log info before withdraw
                // let farmBnbPool = await bankFarm.poolInfo(bnbPoolId);
                // logObj(farmBnbPool, "farm bnb pool info before withdraw");
                // let userFarmBnbPool = await bankFarm.userStakeInfo(bnbPoolId, accounts[0]);
                // logObj(userFarmBnbPool, "farm bnb pool user info before withdraw");

                await time.advanceBlock();
                earn = await bankFarm.stakeEarnedPerPool(bnbPoolId, accounts[0]);
                await bank.withdraw(bnbAddress, targetSendBNBWei);

                console.log(`Stake earn is ${web3.utils.fromWei(earn.toString())}`)

                // log info after withdraw
                // farmBnbPool = await bankFarm.poolInfo(bnbPoolId);
                // logObj(farmBnbPool, "farm bnb pool info after withdraw");
                // userFarmBnbPool = await bankFarm.userStakeInfo(bnbPoolId, accounts[0]);
                // logObj(userFarmBnbPool, "farm bnb pool user info after withdraw");

                demaAfter = await dema.balanceOf(accounts[0]);
                let amountAfter = BigNumber(await web3.eth.getBalance(accounts[0]));
                actualReceivedBNBWei = amountAfter.minus(amountBefore);
                console.log(`Received bnb amount is: ${web3.utils.fromWei(actualReceivedBNBWei.toString())}`)
            })

            it(`Check received DEMA`, async () => {

                // const { logs } = tx;
                // expectEvent.inLogs(logs, 'RewardPaid', {
                //     poolId: bnbPoolId,
                //     user: accounts[0],
                //     reward: earn.toString(),
                //   });

                assert.equal(demaAfter.sub(demaBefore).toString(), earn.toString())
            })

            it("Check user bank num", async () => {
                assert.equal(await bank.userBanksNum(accounts[0]), 0);
            })

            it("Check user shares", async () => {
                let userShares = await bank.userSharesPreTokoen(accounts[0], bnbAddress)
                assert.equal(userShares.toString(), '0');
            })
        })

        bonusTestAfterWithdraw(accounts[0]);

        inviterBonusTestAfterWithdraw(accounts[0]);

    })

    describe("Deposit and withdraw USDT after depositing BNB", async () => {
        // USDT Amount of send and receive
        let targetSendUSDT = 1;
        let targetSendUSDTWei = BigNumber(web3.utils.toWei(String(targetSendUSDT)));
        let sendBNBWei = targetSendUSDTWei;
        let actualSendUSDT;       // BigNumber
        let actualReceivedUSDT;   // BigNumber

        let walletAddress = accounts[0];

        // Farm test used
        let bnbDepositTime;
        let usdtDepositTime;

        before("Deposit BNB before", async () => {
            await time.advanceBlock();
            await bank.deposit(bnbAddress, sendBNBWei, {value: sendBNBWei});
            bnbDepositTime = await time.latest();
            console.log(`BNB deposit time is ${bnbDepositTime}`);
        })

        describe("Deposit test", async () => {

            before(`Deposit ${targetSendUSDT} USDT`, async () => {
                let amountBefore = await erc20TokenGetBalance(usdt.address, walletAddress);
                // contract.mBNBods.approve(contractAddress, web3.utils.toWei('79228162514', "BNBer")).send({ from: address })
                await time.advanceBlock();
                await usdt.approve(bank.address, web3.utils.toWei('79228162514'));
                await bank.deposit(usdt.address, targetSendUSDTWei);

                usdtDepositTime = await time.latest();
                console.log(`USDT deposit time is ${usdtDepositTime}`);

                let amountAfter = await erc20TokenGetBalance(usdt.address, walletAddress);
                actualSendUSDT = amountBefore.minus(amountAfter);
            })

            it(`Account balance decreased by ${targetSendUSDT} USDT`, async () => {
                assert.equal(actualSendUSDT.toString(), targetSendUSDT.toString())
            })

            it(`Bank balance Increased by ${targetSendUSDT} BNB`, async () => {
                let bankBalance = BigNumber(await usdt.balanceOf(bank.address));
                assert.equal(bankBalance.toString(), targetSendUSDTWei.toString())
            })

            it("Check user bank num", async () => {
                assert.equal(await bank.userBanksNum(accounts[0]), 2);
            })

            it("Check user deposited amount", async () => {
                let bankInfo = await bank.banks(usdt.address);
                let userShares = await bank.userSharesPreTokoen(accounts[0], usdt.address);
                let totalAmount = await bank.totalToken(usdt.address);
                let totalShares = await bankInfo.totalShares;

                let amout = userShares.mul(totalAmount).div(totalShares);
                assert.equal(amout.toString(), targetSendUSDTWei.toString());
            })

            it("Check farm bonus pool length", async () => {
                let poolLen = await bankFarm.bonusPoolsLength(accounts[0]);
                assert.equal(poolLen.toNumber(), 2);
            })

            it("Check farm bonus pool id", async () => {
                let poolId = await bankFarm.bonusPoolsId(accounts[0], 1);
                assert.equal(poolId.toNumber(), usdtPoolId);
            })

            it("Check farm inviter bonus pool length", async () => {
                let poolLen = await bankFarm.inviterBonusPoolsLength(accounts[0]);
                assert.equal(poolLen.toNumber(), 2);
            })

            it("Check farm bonus inviter pool id", async () => {
                let poolId = await bankFarm.inviterBonusPoolsId(accounts[0], 1);
                assert.equal(poolId.toNumber(), usdtPoolId);
            })
        })

        describe("Check earn after 30 second", async () => {

            before("After 30 second", async () => {
                await time.increaseTo(usdtDepositTime.add(time.duration.seconds(30)));
                await time.advanceBlock();
                let withdrawTime = await time.latest();
                console.log("withdrawTime time is: " + withdrawTime);
                let deltaT = withdrawTime.sub(usdtDepositTime);
                console.log("Delta time is: " + deltaT);
            })

            it("Check stake earn", async () => {
                await checkTotalEarn([bnbPoolId, usdtPoolId], accounts[0], 0);
            })

            it("Check bonus earn", async () => {
                await checkTotalEarn([bnbPoolId, usdtPoolId], accounts[0], 1);
            })

            it("Check inviter earn", async () => {
                await checkTotalEarn([bnbPoolId, usdtPoolId], accounts[0], 2);
            })
        })

        describe("Withdraw test", async () => {

            let earn;
            let demaBefore;
            let demaAfter;

            before(`withdraw all USDT`, async () => {
                let amountBefore = await erc20TokenGetBalance(usdt.address, walletAddress);
                demaBefore = await dema.balanceOf(accounts[0]);

                await time.advanceBlock();
                earn = await bank.earn(accounts[0]);

                await bank.withdraw(usdt.address, targetSendUSDTWei);

                let amountAfter = await erc20TokenGetBalance(usdt.address, walletAddress);
                demaAfter = await dema.balanceOf(accounts[0]);
                actualReceivedUSDT = amountAfter.minus(amountBefore);
            })

            it(`Account balance increased by ${targetSendUSDT} USDT`, async () => {
                assert.equal(actualReceivedUSDT.toString(), targetSendUSDT.toString());
            })

            it(`Received DEMA equal to total earn`, async () => {
                assert.equal(demaAfter.sub(demaBefore).toString(), earn.toString());
            })

            it("User bank num is 1", async () => {
                assert.equal((await bank.userBanksNum(accounts[0])).toNumber(), 1);
            })

            it("User shares in usdt pool is 0", async () => {
                let userShares = await bank.userSharesPreTokoen(accounts[0], usdt.address);
                assert.equal(userShares.toString(), '0');
            })
        })

        describe("Withdraw left BNB", async () => {

            before(`withdraw all USDT`, async () => {
                await bank.withdraw(bnbAddress, sendBNBWei);
            })

            it("User bank num is 0", async () => {
                assert.equal((await bank.userBanksNum(accounts[0])).toNumber(), 0);
            })

            it("User shares in bnb pool is 0", async () => {
                let userShares = await bank.userSharesPreTokoen(accounts[0], bnbAddress);
                assert.equal(userShares.toString(), '0');
            })
        })

        bonusTestAfterWithdraw(accounts[0]);

        inviterBonusTestAfterWithdraw(accounts[0]);
    })
    
    async function checkTotalEarn(poolsId, account, which) {

        let getEarn = BigNumber(0);  // Aquire from contract
        let targetEarn = BigNumber(0);    // Sum of earn of each pool

        let bn1e18 = new BN(BigNumber(1e18).toString());

        if (which == 0) {
            // Stake earn

            getEarn = await bank.earn(account);

            for (let id of poolsId) {
                let userFarmPool = await bankFarm.userStakeInfo(id, account);
                let shares = userFarmPool.shares;
                let rewardsPerShare = await bankFarm.rewardPerToken(id);
                targetEarn = targetEarn.plus(rewardsPerShare.sub(
                    userFarmPool.userRewardPerTokenPaid).mul(shares).div(bn1e18).toString());
            }

            console.log(`Stake earn is: ${getEarn}`);
            assert.equal(getEarn.toString(), targetEarn.toString());
        }
        else if (which == 1) {
            // Bonus earn

            getEarn = await bankFarm.bonusEarned(account);

            for (let id of poolsId) {
                let userFarmPool = await bankFarm.bonus(id, account);
                let shares = userFarmPool.shares;
                let rewardsPerShare = await bankFarm.rewardPerToken(id);
                targetEarn = targetEarn.plus(rewardsPerShare.sub(
                    userFarmPool.userRewardPerTokenPaid).mul(shares).div(bn1e18).toString());
            }

            console.log(`Bonus earn is: ${getEarn}`);
            assert.equal(getEarn.toString(), targetEarn.toString());
        }
        else if (which == 2) {
            // Inviter bonus earn

            getEarn = await bankFarm.inviterBonusEarned(account);

            for (let id of poolsId) {
                let userFarmPool = await bankFarm.inviterBonus(id, account);
                let shares = userFarmPool.shares;
                let rewardsPerShare = await bankFarm.rewardPerToken(id);
                targetEarn = targetEarn.plus(rewardsPerShare.sub(
                    userFarmPool.userRewardPerTokenPaid).mul(shares).div(bn1e18).toString());
            }

            console.log(`Inviter earn is: ${getEarn}`);
            assert.equal(getEarn.toString(), targetEarn.toString());
        }
    }
    
    async function bonusTestAfterWithdraw(account) {

        describe("Bonus test after withdraw all", async () => {

            let earn;
            let demaBefore;
            let demaAfter;

            before(`Get bonus`, async () => {
                demaBefore = await dema.balanceOf(account);

                await time.advanceBlock();
                earn = await bankFarm.bonusEarned(account);
                await bankFarm.getBonusRewards(account);

                console.log(`Bonus earn is ${web3.utils.fromWei(earn.toString())}`)
                demaAfter = await dema.balanceOf(account);
            })

            it(`Check received DEMA`, async () => {
                assert.equal(demaAfter.sub(demaBefore).toString(), earn.toString())
            })

            it("Check bonus pool num", async () => {
                let poolNum = await bankFarm.bonusPoolsLength(account);
                assert.equal(poolNum.toNumber(), 0);
            })
        })
    }
    
    async function inviterBonusTestAfterWithdraw(account) {

        describe("Inviter bonus test after withdraw all", async () => {

            let earn;
            let demaBefore;
            let demaAfter;

            before(`Get inviter bonus`, async () => {
                demaBefore = await dema.balanceOf(account);
                await time.advanceBlock();

                earn = await bankFarm.inviterBonusEarned(account);
                await bankFarm.getInviterRewards(account);

                console.log(`Inviter bonus earn is ${web3.utils.fromWei(earn.toString())}`)

                demaAfter = await dema.balanceOf(account);
            })

            it(`Check received DEMA`, async () => {
                assert.equal(demaAfter.sub(demaBefore).toString(), earn.toString())
            })

            it("Check inviter bonus pool num", async () => {
                let poolNum = await bankFarm.inviterBonusPoolsLength(account);
                assert.equal(poolNum.toNumber(), 0);
            })
        })
    }
});
