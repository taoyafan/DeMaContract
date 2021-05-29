let UserProfile = artifacts.require("./UserProfile.sol");
let PlgUserIntroduction = artifacts.require("./PlgUserIntroduction.sol");

module.exports = function(deployer) {
  deployer.deploy(UserProfile);
  deployer.deploy(PlgUserIntroduction);

  // let UserProfile = await UserProfile.deployed();
  // console.log(UserProfile.address);
  // let PlgUserIntroduction = await PlgUserIntroduction.deployed();
  // console.log(PlgUserIntroduction.address);
};
