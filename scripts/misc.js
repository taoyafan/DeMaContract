global.artifacts = artifacts
const Bank = artifacts.require("Bank");

const BigNumber = require("bignumber.js");
const { assert } = require('console');
let {
    bnbAddress,
    fromWei,
    setDex,
    setNetwork,
    getBalance,
    transfer,
    removeAllLiquidity,
    getContractInstance,
} = require('../js_utils/utils.js');

let {getBanksInfo} = require('../js_utils/config.js');

async function reinvest(dex, network) {
    setDex(dex);
    const {addressJson} = setNetwork(network, web3);
    const reinvestment = await getContractInstance("Reinvestment");
    
    const beforeBalance = await getBalance(addressJson[dex], reinvestment.address);
    console.log(`Before amount: ${fromWei(beforeBalance)}`)
    
    await reinvestment.reinvest();

    const afterBalance = await getBalance(addressJson[dex], reinvestment.address);
    console.log(`After amount: ${fromWei(afterBalance)}`)
}

async function  getBankRewards(network, from) {
    const {addressJson} = setNetwork(network, web3)
    let bankConfig = getBanksInfo(network);
    
    const bank = await Bank.at(addressJson.Bank);
    
    for (const configPerToken of bankConfig) {
        const tokenName = configPerToken.token;
        const tokenAddress = addressJson[tokenName];
        console.log(`Start to get reward of ${tokenName}, address: ${tokenAddress}`);

        const info =  await bank.banks(tokenAddress); 
        const totalReserve = BigNumber(info.totalReserve);
        console.log(`Total reserve is ${fromWei(totalReserve)}`);

        // Get rewards
        if (totalReserve > 0) {
            const beforeBalance = await getBalance(tokenAddress, from);
            await bank.withdrawReserve(tokenAddress, from, totalReserve);
            const afterBalance = await getBalance(tokenAddress, from);
            const reveivedBalance = afterBalance.minus(beforeBalance);
            console.log(`Reserved successd with amount is ${fromWei(reveivedBalance)}`);
        }

        console.log('\n')
    }
}

async function getDexRewards(dex, from) {
    setDex(dex);
    const reinvestment = await getContractInstance("Reinvestment");
    const balance = await reinvestment.userAmount(from);
    console.log(`User balance of ${dex}: ${fromWei(balance)}`);

    if (balance > 0){
        await reinvestment.withdraw(balance);
        
        const afterBalance = await reinvestment.userAmount(from);
        console.log(`After withdrawn, user balance of ${dex}: ${fromWei(afterBalance)}`);
    }
}

async function transferToTestAccount(from) {
    const testAccounts = [
        "0xBd3Befc7e3859CFfc6E3b85b5773F620780E2419",   // m
        "0xD56936ED720550AC0e0008e6b928884B7a3d82CD",   // k
        "0xdF385C23be07789a6115Ff371D68Cf056589B485",
        "0x271e565C662c174aDFBe876D4c5d5Cb55a12427B",    
        "0x47f0a028B5B3eF557ffEe65f88ffb3C52305e040",    // xie
    ];

    for (testAccount of testAccounts) {
        console.log(`Start send token to ${testAccount}`)

        await transfer(addressJson.BTC, testAccount, BigNumber(100e18), from);
        console.log(`Send BTC succeed`);
        await transfer(addressJson.ETH, testAccount, BigNumber(100e18), from);
        console.log(`Send ETH succeed`);
        await transfer(addressJson.USDT, testAccount, BigNumber(1e26), from);
        console.log(`Send USDT succeed`);
        await transfer(addressJson.BUSD, testAccount, BigNumber(1e26), from);
        console.log(`Send BUSD succeed`);
        await transfer(addressJson.DEMA, testAccount, BigNumber(1e24), from);
        console.log(`Send DEMA succeed`);
        await transfer(addressJson.Cake, testAccount, BigNumber(1e24), from);
        console.log(`Send Cake succeed`);
    }
}

function main(callback) {

    async function fun() {
        try {
            const networkId = await web3.eth.net.getId();
            
            if (networkId == 97) {
                const network = 'bsctest';
                const {addressJson} = setNetwork(network, web3)
                const accounts = await web3.eth.getAccounts();
                // await transferToTestAccount(accounts[0]);
                
                // await getBankRewards(network, accounts[0])
                
                setDex("Cake");
                await removeAllLiquidity(addressJson.Cake, addressJson.USDT, accounts[0]);
                // await removeAllLiquidity(bnbAddress, addressJson.USDT, accounts[0]);
                
                // await getDexRewards('Mdx', accounts[0]);
                // await getDexRewards('Cake', accounts[0]);
                
                // await reinvest('Mdx', network)
                // await reinvest('Cake', network)
            }
            
        } catch(err) {
            console.error(err)
        }
    }

    fun().then(callback);
}

module.exports = main;