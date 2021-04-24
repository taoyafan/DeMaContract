'use strict'

const BigNumber = require("bignumber.js");
const erc20TokenGetBalance = require("./lib/utils");
const bankInit = require("../scripts/bank_init.js");

contract("TestBank", (accounts) => {
    // Each contract instance
    let interestModel;
    let bankConfig;
    let bank;
    let usdt;

    // parameters
    let setReserveBps; 
    let setLiquidateBps;
    let ETHAddress;
    let USDTAddress;

    before(async () => {
        [interestModel, bankConfig, bank, usdt, setReserveBps, 
            setLiquidateBps, ETHAddress, USDTAddress] = await bankInit();
    });

    describe("Check config's params", async () => {

        it("Get params in config correctly", async () => {
            const getReserveBps = await bankConfig.getReserveBps();
            const getLiquidateBps = await bankConfig.getLiquidateBps();
            const getinterestModel = await bankConfig.interestModel();

            assert.equal(getReserveBps, setReserveBps, "getReserveBps should equal to setReserveBps.");
            assert.equal(getLiquidateBps, setLiquidateBps, "getLiquidateBps should equal to setLiquidateBps.");
            assert.equal(getinterestModel, interestModel.address, "interestModel should equal to model.address.");
        });

        it("Get interest rate correctly", async () => {
            let ratePerUtilization = [
                // utilization, interest rate
                [0,     BigNumber(10e16).dividedToIntegerBy(31536000)],     // 365 * 24 *60 * 60
                [0.25,  BigNumber(10e16).dividedToIntegerBy(31536000)],     // 10%
                [0.75,  BigNumber(1375e14).dividedToIntegerBy(31536000)],   // 13.75%
                [0.97,  BigNumber(415e15).dividedToIntegerBy(31536000)],    // 41.5%
                [1,     BigNumber(100e16).dividedToIntegerBy(31536000)],    // 100%
            ]
            let Utlz;
            let targetRate;
            for ([Utlz, targetRate] of ratePerUtilization) {
                // getInterestRate(uint256 debt, uint256 floating), utilization = debt / (debt + floating)
                let getRate = await bankConfig.getInterestRate(100*Utlz, (100 - 100*Utlz)); 
                // getRate = BigNumber(getRate.toString());
                assert.equal(getRate.toNumber(), targetRate.toNumber(), `getRate is ${getRate} should equal to ${targetRate}`);  
            }
        });

    });

    describe("Check config and banks in bank", async () => {

        it("Get config corrected", async () => {
            let setConfig = await bank.config();
            assert.equal(setConfig, bankConfig.address, 'setConfig should equal to bankConfig.address');
        })

        it("Get banks[ETH] correctly", async () => {
            let getTokenBank = await bank.banks(ETHAddress);
            assert.equal(getTokenBank.tokenAddr, ETHAddress, `Token address should be ${ETHAddress}`);
            assert.equal(getTokenBank.isOpen, true, 'Token 0 should be opend');
            assert.equal(getTokenBank.canDeposit, true, 'Token 0 should can be Deposited'); 
        })

        it("Get banks[USDT] correctly", async () => {
            let getTokenBank = await bank.banks(USDTAddress);
            assert.equal(getTokenBank.tokenAddr, USDTAddress, `Token address should be ${ETHAddress}`);
            assert.equal(getTokenBank.isOpen, true, 'Token 0 should be opend');
            assert.equal(getTokenBank.canDeposit, true, 'Token 0 should can be Deposited'); 
        })
    })

    describe("Deposit and withdraw ETH", async () => {
        // ETH Amount of send and receive
        let targetSendETH;
        let targetSendETHWei;       // BigNumber
        let actualSendETHWei;       // BigNumber   
        let actualReceivedETHWei;   // BigNumber   

        // related Address
        let oTokenAddress;
        let walletAddress;

        before("Set amount and address", async () => {
            targetSendETH = 100;
            targetSendETHWei = BigNumber(web3.utils.toWei(String(targetSendETH)));

            let getTokenBank = await bank.banks(ETHAddress);
            oTokenAddress = getTokenBank.pTokenAddr;
            walletAddress = accounts[0];
        })

        describe("Check deposit result", async () => {

            before("Deposit 100 eth", async () => {
                let amountBefore = BigNumber(await web3.eth.getBalance(accounts[0]));
                
                await bank.sendTransaction({value: targetSendETHWei});
                
                let amountAfter = BigNumber(await web3.eth.getBalance(accounts[0]));
                actualSendETHWei = amountBefore.minus(amountAfter);
            })

            it("Account balance decreased by 100 ETH", async () => {
                assert.equal(actualSendETHWei.toString(), targetSendETHWei.toString(),
                 'Account balance should be decreased by 100 ETH')
            })

            it("Received 100 oETH", async () => {
                let amountOETH = await erc20TokenGetBalance(oTokenAddress, walletAddress);
                assert.equal(amountOETH.toNumber(), targetSendETH, "Should receive 100 oETH");
            })
        })

        describe("Check withdraw result", async () => {

            before("withdraw 100 eth", async () => {
                let amountBefore = BigNumber(await web3.eth.getBalance(accounts[0]));
                
                await bank.withdraw(ETHAddress, targetSendETHWei);
                
                let amountAfter = BigNumber(await web3.eth.getBalance(accounts[0]));
                actualReceivedETHWei = amountAfter.minus(amountBefore);
            })
            
            it("Account balance increased by 100 ETH", async () => {
                assert.equal(actualReceivedETHWei.toString(), targetSendETHWei.toString(), 
                    "Account balance should increased by 100 ETH ")
            })
            
            it("Burned 100 oETH", async () => {
                let amountOETH = await erc20TokenGetBalance(oTokenAddress, walletAddress);
                assert.equal(amountOETH.toNumber(), 0, "Should Burned 100 oETH");
            })
        })
    })

    describe("Deposit and withdraw USDT", async () => {
        // USDT Amount of send and receive
        let targetSendUSDT;
        let targetSendUSDTWei;
        let actualSendUSDT;       // BigNumber   
        let actualReceivedUSDT;   // BigNumber   

        // related Address
        let oTokenAddress;
        let walletAddress;

        before("Set amount and address", async () => {
            targetSendUSDT = 100;
            targetSendUSDTWei = BigNumber(web3.utils.toWei(String(targetSendUSDT)));

            let getTokenBank = await bank.banks(USDTAddress);
            oTokenAddress = getTokenBank.pTokenAddr;
            walletAddress = accounts[0];
        })

        describe("Check deposit result", async () => {

            before("Deposit 100 USDT", async () => {
                let amountBefore = await erc20TokenGetBalance(USDTAddress, walletAddress);
                // contract.methods.approve(contractAddress, web3.utils.toWei('79228162514', "ether")).send({ from: address })
                await usdt.approve(bank.address, web3.utils.toWei('79228162514'));
                await bank.deposit(USDTAddress, targetSendUSDTWei);
                
                let amountAfter = await erc20TokenGetBalance(USDTAddress, walletAddress);
                actualSendUSDT = amountBefore.minus(amountAfter);
            })

            it("Account balance decreased by 100 USDT", async () => {
                assert.equal(actualSendUSDT.toString(), targetSendUSDT.toString(),
                 'Account balance should be decreased by 100 USDT')
            })

            it("Received 100 oUSDT", async () => {
                let amountOUSDT = await erc20TokenGetBalance(oTokenAddress, walletAddress);
                assert.equal(amountOUSDT.toNumber(), targetSendUSDT, "Should receive 100 oUSDT");
            })
        })

        describe("Check withdraw result", async () => {

            before("withdraw 100 USDT", async () => {
                let amountBefore = await erc20TokenGetBalance(USDTAddress, walletAddress);
                
                await bank.withdraw(usdt.address, targetSendUSDTWei);
                
                let amountAfter = await erc20TokenGetBalance(USDTAddress, walletAddress);
                actualReceivedUSDT = amountAfter.minus(amountBefore);
            })
            
            it("Account balance increased by 100 USDT", async () => {
                assert.equal(actualReceivedUSDT.toString(), targetSendUSDT.toString(), 
                    "Account balance should increased by 100 USDT ")
            })
            
            it("Burned 100 oUSDT", async () => {
                let amountOETH = await erc20TokenGetBalance(oTokenAddress, walletAddress);
                assert.equal(amountOETH.toNumber(), 0, "Should Burned 100 oUSDT");
            })
        })
    })
});
