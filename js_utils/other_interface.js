const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 30 })

const {
    getContractInstance,
    getConfig,
} = require("./utils");

const { addressJson, name2Address } = getConfig();

async function reinvest() {
    let reinvestment = await getContractInstance("Reinvestment");
    await reinvestment.reinvest();
}


module.exports = {
    reinvest,
}