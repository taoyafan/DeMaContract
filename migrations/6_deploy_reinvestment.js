const MdxToken = artifacts.require('MdxToken');
const BoardRoom = artifacts.require("BoardRoomMDX");
const Reinvestment = artifacts.require("Reinvestment");

const BigNumber = require("bignumber.js");

module.exports = async function (deployer, network, accounts) {
    // await deployer.deploy(MdxToken);
    // await deployer.deploy(BoardRoom, MdxToken.address, 1);
    // await deployer.deploy(Reinvestment, BoardRoom.address, 4, MdxToken.address, 1000);
};
