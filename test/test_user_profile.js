'use strict'

let UserProfile = artifacts.require("./UserProfile.sol");
let PlgUserIntroduction = artifacts.require("./PlgUserIntroduction.sol");

let userProfileAddress;
let plgAddress;

let userProfile;

contract("Test User Profile", (accounts) => {

    before(async () => {
        userProfile = await UserProfile.deployed();
        let abi = userProfile.abi;
        userProfileAddress = userProfile.address;
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
            setName = "Morty";
            setId = 620;
            let inviter = await userProfile.methods.inviter(newUser).call();
            assert.strictEqual(inviter, "0x0000000000000000000000000000000000000000");
            let bytes = new TextEncoder().encode(setName);
            console.log(`Bytes name is : ${bytes}`)

            let sendHex = web3.utils.bytesToHex(bytes);
            console.log(`Send hex is : ${sendHex}`)

            await userProfile.methods.register(sendHex, setId, 0).send({from: newUser, gas:3000000});
        });

        it("Name check", async () => {
            let getName = await userProfile.methods.name(newUser).call();
            if (getName) {
                let getBytes = web3.utils.hexToBytes(getName);
                getName = new TextDecoder().decode(new Uint8Array(getBytes));
            } else {
                getName = '';
            }

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

        // ------------------- invitees test -------------------

        it("invitees num check", async () => {
            let inviteeNums = await userProfile.methods.getUserInviteesNum(accounts[0]).call();
            // inviteeNums is string
            assert.strictEqual(+inviteeNums, 2);
        });

        it("invitees check", async () => {
            let getInvitees = await userProfile.methods.getUserInvitee(accounts[0], 1).call();
            assert.strictEqual(getInvitees, newUser);
        });

        it("all invitees check", async () => {
            let getAllInvitees = await userProfile.methods.getUserAllInvitees(accounts[0]).call();
            assert.strictEqual(getAllInvitees.length, 2);
            assert.strictEqual(getAllInvitees[0], accounts[0]);
            assert.strictEqual(getAllInvitees[1], newUser);
        });

        // ------------------- user test -------------------

        it("Users num check", async () => {
            let usersNums = await userProfile.methods.getUsersNum().call();
            // usersNums is string
            assert.strictEqual(+usersNums, 2);
        });

        it("User check", async () => {
            let user0 = await userProfile.methods.getUser(0).call();
            assert.strictEqual(user0, accounts[0]);
            let user1 = await userProfile.methods.getUser(1).call();
            assert.strictEqual(user1, newUser);
        });

        it("All Users check", async () => {
            let users = await userProfile.methods.getAllUsers().call();
            assert.strictEqual(users.length, 2);
            assert.strictEqual(users[0], accounts[0]);
            assert.strictEqual(users[1], newUser);
        });
    });

    describe("Plugins test", async () => {
        let contents = "This";

        before("Set plugins ok", async () => {
            plgAddress = (await PlgUserIntroduction.deployed()).address
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
