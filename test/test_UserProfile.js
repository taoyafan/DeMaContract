'use strict'

const BigNumber = require("bignumber.js");
let UserProfile = artifacts.require("./UserProfile.sol");

contract("TestUserProfile", (accounts) => {

    let userProfile;    // Web3 contract object

    before(async () => {
        userProfile = await UserProfile.deployed();
        // accounts = await web3.eth.getAccounts();
        userProfile = new web3.eth.Contract(userProfile.abi, userProfile.address);
    });

    describe("Name test", async () => {
        
        it("Check initial name", async () => {
            let name = await userProfile.methods.name(accounts[0]).call();
            let getBytes = web3.utils.hexToBytes(name);
            name = new TextDecoder().decode(new Uint8Array(getBytes));

            assert.equal(name, "Creator");
        });
        
        it("Set name and check", async () => {
            let setName = "_a❤爱16";
            let bytes = new TextEncoder().encode(setName);

            await userProfile.methods.changeName(bytes).send({from: accounts[0]});
            
            let getName = await userProfile.methods.name(accounts[0]).call();
            let getBytes = web3.utils.hexToBytes(getName);
            getName = new TextDecoder().decode(new Uint8Array(getBytes));

            assert.equal(getName, setName);
        });

    });

    describe("Register new one", async () => {
        
        let newUser;

        before(async () => {
            newUser = accounts[1];
            
        });
    });


})