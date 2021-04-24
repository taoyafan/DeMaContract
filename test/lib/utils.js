const erc20ABI = require('./abi.js');
const BigNumber = require("bignumber.js");

// Return a BigNumber of balance that has divided decimals
async function erc20TokenGetBalance(tokenAddress, accountAddress) {
    let contract = new web3.eth.Contract(erc20ABI, tokenAddress);
    let balance = BigNumber(await contract.methods.balanceOf(accountAddress).call());
    let decimals = await contract.methods.decimals().call();

    // divided by decimals
    balance = balance.div(10**decimals)
    return balance;
}

module.exports = erc20TokenGetBalance;
