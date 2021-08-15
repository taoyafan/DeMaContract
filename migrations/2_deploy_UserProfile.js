let UserProfile = artifacts.require("./UserProfile.sol");
let PlgUserIntroduction = artifacts.require("./PlgUserIntroduction.sol");
let {saveToJson, readAddressJson} = require('../js_utils/jsonRW.js');

module.exports = async function(deployer, network) {
    await deployer.deploy(UserProfile);

    saveToJson("UserProfile", UserProfile.address, network);

    if (network == 'development') {
        await deployer.deploy(PlgUserIntroduction);
        saveToJson("PlgUserIntroduction", PlgUserIntroduction.address);
    }
};
