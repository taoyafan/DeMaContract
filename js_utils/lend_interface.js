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

function deposit(token, amount) {

}