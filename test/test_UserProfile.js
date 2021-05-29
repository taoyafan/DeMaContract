'use strict'

let assert = require('assert');
const Web3 = require('web3');
const getAbi = require('../scripts/get_abi_address')

let web3 = new Web3('http://localhost:8545')
const BigNumber = require("bignumber.js");

const userProfileAddress = '0xd24B989F37cff03870B6C3D403304DA2498367d4';
const plgAddress = '0xa320b71Bd6ef867f1cD421aC73E2784aeF4CA1aB';

let userProfile;    // Web3 contract object
let accounts;

describe("User profile test", async () => {

    before(async () => {
        // userProfile = await UserProfile.deployed();
        accounts = await web3.eth.getAccounts();
        let abi = getAbi("UserProfile");
        userProfile = new web3.eth.Contract(abi, userProfileAddress);
    });

    describe("Name test", async () => {

        it("Check initial name", async () => {
            let name = await userProfile.methods.name(accounts[0]).call();
            let getBytes = web3.utils.hexToBytes(name);
            name = new TextDecoder().decode(new Uint8Array(getBytes));

            assert.strictEqual(name, "Creator");
        });

        it("Change name and check", async () => {
            let setName = "_a❤爱16trfgf123456";
            let bytes = new TextEncoder().encode(setName);
            let sendHex = web3.utils.bytesToHex(bytes);
            // console.log(sendHex);

            await userProfile.methods.changeName(sendHex).send({from: accounts[0]});

            let getName = await userProfile.methods.name(accounts[0]).call();
            let getBytes = web3.utils.hexToBytes(getName);
            getName = new TextDecoder().decode(new Uint8Array(getBytes));

            assert.strictEqual(getName, setName);
        });

    });

    describe("New user test", async () => {

        let newUser;
        let setName;
        let setId;

        before("Inviter should be 0", async () => {
            newUser = accounts[3];  // password test
            setName = "Hi";
            setId = 620;
            let inviter = await userProfile.methods.inviter(newUser).call();
            assert.strictEqual(inviter, "0x0000000000000000000000000000000000000000");
            let bytes = new TextEncoder().encode(setName);
            await userProfile.methods.register(bytes, setId, 0).send({from: newUser});
        });

        it("Name check", async () => {
            let getName = await userProfile.methods.name(newUser).call();
            let getBytes = web3.utils.hexToBytes(getName);
            getName = new TextDecoder().decode(new Uint8Array(getBytes));

            assert.strictEqual(getName, setName);
        });

        it("Id check", async () => {
            let getId = await userProfile.methods.userId(newUser).call();
            // getId is string
            assert.strictEqual(+getId, setId);
        });

        it("Inviter check", async () => {
            let getInviter = await userProfile.methods.inviter(newUser).call();
            assert.strictEqual(getInviter, accounts[0]);
        });

        it("invitees num check", async () => {
            let inviteeNums = await userProfile.methods.getUserInviteesNum(accounts[0]).call();
            // inviteeNums is string
            assert.strictEqual(+inviteeNums, 2);
        });

        it("invitees check", async () => {
            let getInvitees = await userProfile.methods.getUserInvitee(accounts[0], 1).call();
            assert.strictEqual(getInvitees, newUser);
        });
    });

    describe("Plugins test", async () => {
        let contents = "This";

        before("Set plugins ok", async () => {
            await userProfile.methods.setPluginsOk([plgAddress], true).send({from: accounts[0]});
        })

        it("Plunge write, read test", async () => {
            let contentsBytes = new TextEncoder().encode(contents);
            let hexToPlg = web3.eth.abi.encodeParameters(
                ["address", "bytes"], 
                [accounts[0], contentsBytes]);
                
            // console.log("hexToPlg:");
            // console.log(hexToPlg);

            let sendHex = web3.eth.abi.encodeParameters(
                ["address", "bytes" ], 
                [plgAddress, hexToPlg]);
                
            // console.log("sendHex:");
            // console.log(sendHex);

            await userProfile.methods.extendWrite(sendHex).send({from: accounts[0]});

            // console.log("Write success");

            // Read
            hexToPlg = web3.eth.abi.encodeParameters(
                ["address"], 
                [accounts[0]]);
                
            // console.log("hexToPlg:");
            // console.log(hexToPlg);

            sendHex = web3.eth.abi.encodeParameters(
                ["address", "bytes" ], 
                [plgAddress, hexToPlg]);
                
            // console.log("sendHex:");
            // console.log(sendHex);
    

            let getContentHex = await userProfile.methods.extendRead(sendHex).call();
                
            // console.log("getContentHex:");
            // console.log(getContentHex);
            
            let getContentBytes = web3.utils.hexToBytes(getContentHex);
            let getContent = new TextDecoder().decode(new Uint8Array(getContentBytes));

            assert.strictEqual(getContent, contents);
        })
    });
})
