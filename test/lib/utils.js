const erc20ABI = require('./abi.js');
const BigNumber = require("bignumber.js");
const fs = require('fs')
const path = require('path');

// Return a BigNumber of balance that has divided decimals
async function erc20TokenGetBalance(tokenAddress, accountAddress) {
    let contract = new web3.eth.Contract(erc20ABI, tokenAddress);
    let balance = BigNumber(await contract.methods.balanceOf(accountAddress).call());
    let decimals = await contract.methods.decimals().call();

    // divided by decimals
    balance = balance.div(10**decimals)
    return balance;
}

function initFile(file) {
    const fileDir = path.resolve(file, '..');
    
    if(!fs.existsSync(fileDir)) {
        console.log(`Not exist ${fileDir}`);
        fs.mkdirSync(fileDir, {recursive:true});
        console.log(`Make ${fileDir} success!`);
    }

    fs.writeFileSync(file, '',{ flag:'w'});
}

function saveLogToFile(file, name, data = null) {
    fs.appendFileSync(file, name);
    fs.appendFileSync(file, '\n');

    if (data) {
        data = JSON.stringify(data, null, 2);
        fs.appendFileSync(file, data);
        fs.appendFileSync(file, '\n\n\n');
    }
}

module.exports = {
    erc20TokenGetBalance,
    saveLogToFile,
    initFile,
}
