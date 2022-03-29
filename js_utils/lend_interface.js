const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 30 })
const Bank = artifacts.require("Bank");

const {
    bnbAddress,
    getConfig,
    equal,
    swapAllLpToToken0,
    approve,
    swapToTarget,
    getR0R1,
    fromWei,
    aSubB,
    aAddB,
    aMulB,
    aDivB,
} = require("./utils");

const { addressJson, name2Address, web3 } = getConfig();

async function bankDeposit(tokenName, amount, user) {
    console.log(`-------------- Depositing ${fromWei(amount)} ${tokenName} --------------`)
    const bank = await Bank.at(addressJson.Bank);
    const token = name2Address[tokenName];

    let bnbValue = 0;
    if (token == bnbAddress) {
        bnbValue = amount;
    }

    await approve(token, bank.address, amount, user); 
    console.log(`Approve success`)
    await bank.deposit(token, amount, {value: bnbValue});
    console.log(`Deposit success`) 

    await logBankUserInfo(tokenName, user);
}

async function bankWithdraw(tokenName, shares) {
    const bank = await Bank.at(addressJson.Bank);
    const token = name2Address[tokenName];

    await bank.withdraw(token, shares);
}

async function logBankUserInfo(tokenName, user) {
    console.log(`--------------------------- ${tokenName} ---------------------------`);

    const bank = await Bank.at(addressJson.Bank);
    const token = name2Address[tokenName];
    
    let shares = BigNumber(await bank.userSharesPerTokoen(user, token));

    let bankInfo = await bank.banks(token);
    bankInfo = {
        tokenAddr:          bankInfo.tokenAddr,
        isOpen:             Boolean(bankInfo.isOpen),
        canDeposit:         Boolean(bankInfo.canDeposit),
        poolId:             +bankInfo.poolId,
        totalVal:           BigNumber(bankInfo.totalVal),
        totalShares:        BigNumber(bankInfo.totalShares),        
        totalDebt:          BigNumber(bankInfo.totalDebt),          
        totalDebtShares:    BigNumber(bankInfo.totalDebtShares),    
        totalReserve:       BigNumber(bankInfo.totalReserve), 
        lastInterestTime:   BigNumber(bankInfo.lastInterestTime),
    }
    console.log(`tokenAddr: ${bankInfo.tokenAddr}`);
    // console.log(`isOpen: ${bankInfo.isOpen}`);
    // console.log(`canDeposit: ${bankInfo.canDeposit}`);
    // console.log(`poolId: ${bankInfo.poolId}`);
    console.log(`totalVal: ${fromWei(bankInfo.totalVal)}`);
    console.log(`totalShares: ${fromWei(bankInfo.totalShares)}`);
    console.log(`totalDebt: ${fromWei(bankInfo.totalDebt)}`);
    console.log(`totalDebtShares: ${fromWei(bankInfo.totalDebtShares)}`);
    console.log(`totalReserve: ${fromWei(bankInfo.totalReserve)}`);
    // console.log(`lastInterestTime: ${bankInfo.lastInterestTime}`);
    
    let amounts = 0;
    if (bankInfo.totalShares > 0) {
        amounts = aMulB(shares, aSubB(bankInfo.totalVal, bankInfo.totalReserve)).dividedToIntegerBy(bankInfo.totalShares);
    }

    console.log(`User shares of token ${tokenName} is ${fromWei(shares)}, amounts is ${fromWei(amounts)}`);
}

module.exports = {
    bankDeposit,
    bankWithdraw,
    logBankUserInfo,
}