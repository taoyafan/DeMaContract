const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 30 })

const {
    getContractInstance,
} = require("./utils");

async function reinvest() {
    let reinvestment = await getContractInstance("Reinvestment");
    await reinvestment.reinvest();
}


module.exports = {
    reinvest,
}