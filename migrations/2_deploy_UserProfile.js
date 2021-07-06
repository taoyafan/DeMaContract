let UserProfile = artifacts.require("./UserProfile.sol");
let PlgUserIntroduction = artifacts.require("./PlgUserIntroduction.sol");
let saveToJson = require('./save_address_to_json.js')

module.exports = async function(deployer, network) {
  await deployer.deploy(UserProfile);
  if (network == 'bscmain') {
    saveToJson("bscmain_UserProfile", (await UserProfile.deployed()).address);
  } else if (network == 'matic') { 
    saveToJson("matic_UserProfile", (await UserProfile.deployed()).address);
  } else { 
    saveToJson("UserProfile", (await UserProfile.deployed()).address);
  }
  
  if (network == 'development') {
    await deployer.deploy(PlgUserIntroduction);
    saveToJson("PlgUserIntroduction", (await PlgUserIntroduction.deployed()).address);
  }

  // let UserProfile = await UserProfile.deployed();
  // console.log(UserProfile.address);
  // let PlgUserIntroduction = await PlgUserIntroduction.deployed();
  // console.log(PlgUserIntroduction.address);
};
