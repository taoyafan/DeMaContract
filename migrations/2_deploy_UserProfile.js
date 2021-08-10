let UserProfile = artifacts.require("./UserProfile.sol");
let PlgUserIntroduction = artifacts.require("./PlgUserIntroduction.sol");
let saveToJson = require('./save_address_to_json.js')

module.exports = async function(deployer, network) {
  await deployer.deploy(UserProfile);
  
  saveToJson("UserProfile", UserProfile.address, network);
  
  if (network == 'development') {
    await deployer.deploy(PlgUserIntroduction);
    saveToJson("PlgUserIntroduction", PlgUserIntroduction.address);
  }
};
