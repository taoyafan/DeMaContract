let UserProfile = artifacts.require("./UserProfile.sol");

module.exports = function(deployer) {
  deployer.deploy(UserProfile);
};
