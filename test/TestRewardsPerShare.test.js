const MdxToken = artifacts.require('MdxToken');
const BoardRoom = artifacts.require("BoardRoomMDX");
const MdxReinvestment = artifacts.require("MdxReinvestment");

const BigNumber = require("bignumber.js");

const MaxUint256 = BigNumber("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");


contract("TestReinvestment", (accounts) => {
    let mdxToken;
    let boardRoom;
    let reinvestment;
    let poolLengthBeforeAdd;
    let poolLength;
    let mdexBoardRoomPid;
    let depositAmount = BigNumber(1000);

    let rewardsPerCycle = BigNumber(1000);
    let cycles = 50;

    let owner = accounts[0];
    let user = accounts[1];

    before("Init board room", async () => {

        // initiate
        mdxToken = await MdxToken.deployed();
        mdxToken.transfer(user, depositAmount);
        boardRoom = await BoardRoom.deployed();
        await boardRoom.setCycle(cycles);
        reinvestment = await MdxReinvestment.deployed();
        poolLengthBeforeAdd = await boardRoom.poolLength();
    
        poolLength = parseInt(await boardRoom.poolLength(), 10);
        mdexBoardRoomPid = parseInt(await reinvestment.boardRoomPid(), 10);

        // add mdex to boardRoom pool, mdexBoardRoomPid is equal to reinvestment.boradRoomPid
        if(mdexBoardRoomPid > poolLength) {
            let testAddress = `0xD7ACd2a9FD159E69Bb102A1ca21C9a3e3A5F771B`;
            for(;poolLength < mdexBoardRoomPid;) {         
                await boardRoom.add(1000, testAddress, 0);
                poolLength = parseInt(await boardRoom.poolLength(), 10);
            }
        }
        await boardRoom.add(1000, mdxToken.address, 0);
        poolLength = parseInt(await boardRoom.poolLength(), 10);

        let blockNum = await web3.eth.getBlockNumber();
        console.log(`Block number Before new reward ${blockNum}`);
        await mdxToken.approve(boardRoom.address, MaxUint256);
        await boardRoom.newReward(rewardsPerCycle.multipliedBy(cycles), rewardsPerCycle, parseInt(blockNum, 10)+1);
        // Don't need update pool because it will update automaticly when deposit
        // await boardRoom.updatePool(mdexBoardRoomPid);    

        let boardRoomStartBlock = await boardRoom.startBlock();
        let boardRoomEndBlock = await boardRoom.endBlock();
        console.log(`boardRoomStartBlock :${boardRoomStartBlock}`);
        console.log(`boardRoomEndBlock :${boardRoomEndBlock}`);
    })

    it("Deposit and Reinvest", async () => {

        let totalRewardsBefore = await reinvestment.totalRewards();
        let globalInfoBefore = await reinvestment.globalInfo();
        let userInfoBefore = await reinvestment.userInfo(user);

        console.log(`totalRewards: ${totalRewardsBefore}`);
        logObj(globalInfoBefore, 'globalInfoBefore');
        logObj(userInfoBefore, 'userInfoBefore');

        // Deposit to reinvestment
        await mdxToken.approve(reinvestment.address, MaxUint256, {from: user});
        await reinvestment.deposit(depositAmount, {from: user});

        // Reinvest
        await reinvestment.reinvest();
        let blockNum = await web3.eth.getBlockNumber();
        console.log(`Block number when reinvest ${blockNum}`);
        // await mdxToken.approve(boardRoom.address, MaxUint256, {from: user});
        // await boardRoom.deposit(mdexBoardRoomPid,depositAmount, {from: user});

        let boardRoomMdexAmount = await mdxToken.balanceOf(boardRoom.address);
        let boardMdexPerBlock = await boardRoom.mdxPerBlock();
        let boardPendingResult = await boardRoom.pending(mdexBoardRoomPid, reinvestment.address);
        let boardPoolInfo = await boardRoom.poolInfo(mdexBoardRoomPid);
        let boardUserInfo = await boardRoom.userInfo(mdexBoardRoomPid, reinvestment.address);

        console.log(`boardRoomMdexAmount :${boardRoomMdexAmount}`);
        console.log(`boardMdexPerBlock :${boardMdexPerBlock}`);
        console.log(`boardPendingResult :${boardPendingResult}`);
        logObj(boardPoolInfo, 'boardPoolInfo');
        logObj(boardUserInfo, 'boardUserInfo');

        // let boardRoomMdexAmountAfterUpdatePool = await mdxToken.balanceOf(boardRoom.address);
        // let boardMdexPerBlockAfterUpdatePool = await boardRoom.mdxPerBlock();
        // let boardPendingResultAfterUpdatePool = await boardRoom.pending(mdexBoardRoomPid, reinvestment.address);
        // let boardPoolInfoAfterUpdatePool = await boardRoom.poolInfo(mdexBoardRoomPid);
        // let boardUserInfoAfterUpdatePool = await boardRoom.userInfo(mdexBoardRoomPid, reinvestment.address);

        // console.log(`boardRoomMdexAmountAfterUpdatePool :${boardRoomMdexAmountAfterUpdatePool}`);
        // console.log(`boardMdexPerBlockAfterUpdatePool :${boardMdexPerBlockAfterUpdatePool}`);
        // console.log(`boardPendingResultAfterUpdatePool :${boardPendingResultAfterUpdatePool}`);
        // console.log(`boardPoolInfoAfterUpdatePool :${JSON.stringify(boardPoolInfoAfterUpdatePool)}`);
        // console.log(`boardUserInfoAfterUpdatePool :${JSON.stringify(boardUserInfoAfterUpdatePool)}`);

        let totalRewardsAfterUpdatePool = await reinvestment.totalRewards();
        let userRewardsAfterUpdatePool = await reinvestment.userAmount(user);
        let ownerRewardsAfterUpdatePool = await reinvestment.userAmount(owner);

        console.log(`totalRewardsAfterUpdatePool: ${totalRewardsAfterUpdatePool}`);
        console.log(`userRewardsAfterUpdatePool: ${userRewardsAfterUpdatePool}`);
        console.log(`ownerRewardsAfterUpdatePool: ${ownerRewardsAfterUpdatePool}`);
        
        let blockNumWhenGetRewards = await web3.eth.getBlockNumber();
        console.log(`Block number when get total rewards ${blockNumWhenGetRewards}`);

        // let globalInfoAfterUpdatePool = await reinvestment.globalInfo();
        // let userInfoAfterUpdatePool = await reinvestment.userInfo(accounts[0]);
        // console.log(`globalInfoAfterUpdatePool: ${JSON.stringify(globalInfoAfterUpdatePool)}`);
        // console.log(`userInfoAfterUpdatePool: ${JSON.stringify(userInfoAfterUpdatePool)}`);

    });

    it("rewardsPerShare", async () => {
        let rewardsPerShareAmount = await reinvestment.rewardsPerShare();
        assert.equal(rewardsPerShareAmount.toNumber(), 0);
    });
})

function toWei(ether) {
    return web3.utils.toWei(BigNumber(ether).toString())
}

function fromWei(wei) {
    return web3.utils.fromWei(BigNumber(wei).toString())
}

function logObj(obj, name) {
    console.log(` ------------------ ${name}: ------------------ `)
    for (let key in obj) {
        // Not log number
        if (parseFloat(key).toString() == "NaN") {
            console.log(key + ": " + obj[key].toString());
        }
    }
    console.log()
}
