const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 30 })
const Bank = artifacts.require("Bank");

const {
    bnbAddress,
    addressJson,
    name2Address,
    approve,
} = require("./utils");

async function createPosition(tokensName, userAddress, amounts, borrows, minDebt) {
    bank = await Bank.at(addressJson.Bank);
    await _addLp(0, userAddress, tokensName, amounts, borrows, minDebt)
    return (await bank.currentPos() - 1);
}

async function replenishment(posId, tokensName, userAddress, amounts, borrows, minDebt) {
    await _addLp(posId, userAddress, tokensName, amounts, borrows, minDebt)
}

async function repay(posId, tokensName, userAddress, withdrawRate) {
    await withdraw(posId, tokensName, userAddress, withdrawRate, 3);
}

async function withdraw(posId, tokensName, userAddress, withdrawRate, whichWantBack) {
    bank = await Bank.at(addressJson.Bank);
    let token0Address = name2Address[tokensName[0]];
    let token1Address = name2Address[tokensName[1]];

    let withdrawStrategyAddress = addressJson.MdxStrategyWithdrawMinimizeTrading;

    let strategyDate = web3.eth.abi.encodeParameters(
        ["address", "address", "uint256", "uint256"],
        [token0Address, token1Address, withdrawRate, whichWantBack]);
        
    let data = web3.eth.abi.encodeParameters(
        ["address", "bytes" ],
        [withdrawStrategyAddress, strategyDate]);

    await bank.opPosition(posId, 0, [0, 0], data, {from: userAddress});
}

async function _addLp(posId, userAddress, tokensName, amounts, borrows, minDebt) {
    bank = await Bank.at(addressJson.Bank);
    let token0Address = name2Address[tokensName[0]];
    let token1Address = name2Address[tokensName[1]];

    let bnbValue = 0;
    if (token0Address == bnbAddress) {
        bnbValue = amounts[0];
    } else if (token1Address == bnbAddress) {
        bnbValue = amounts[1];
    }

    let pid = addressJson[`Mdx${tokensName[0]}${tokensName[1]}ProdId`]
    let addStrategyAddress = addressJson.MdxStrategyAddTwoSidesOptimal;

    let strategyDate = web3.eth.abi.encodeParameters(
        ["address", "address", "uint256", "uint256", "uint256"],
        [token0Address, token1Address, amounts[0], amounts[1], minDebt]);

    let data = web3.eth.abi.encodeParameters(
        ["address", "bytes" ],
        [addStrategyAddress, strategyDate]);

    await approve(token0Address, addStrategyAddress, amounts[0], userAddress);
    await approve(token1Address, addStrategyAddress, amounts[1], userAddress);

    console.log(`opPosition, posId: ${posId}, pid: ${pid}`);
    await bank.opPosition(posId, pid, borrows, data, {from: userAddress, value: bnbValue});
}

module.exports = {
    createPosition,
    replenishment,
    repay,
    withdraw,
}