const MdxToken = artifacts.require('MdxToken');
const BoardRoom = artifacts.require("BoardRoomMDX");
const Reinvestment = artifacts.require("Reinvestment");

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

    before("before", async () => {

        // initiate
        mdxToken = await MdxToken.deployed();
        boardRoom = await BoardRoom.deployed();
        reinvestment = await Reinvestment.deployed();
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

        await mdxToken.approve(reinvestment.address, MaxUint256);
        await reinvestment.deposit(depositAmount);
        let totalRewardsBefore = await reinvestment.totalRewards();
        console.log(`totalRewards: ${totalRewardsBefore}`);
        let globalInfoBefore = await reinvestment.globalInfo();
        console.log(`globalInfoBefore: ${JSON.stringify(globalInfoBefore)}`);
        let userInfoBefore = await reinvestment.userInfo(accounts[0]);
        console.log(`userInfoBefore: ${JSON.stringify(userInfoBefore)}`);

        await mdxToken.approve(boardRoom.address, MaxUint256);
        await boardRoom.deposit(mdexBoardRoomPid,depositAmount);
        let boardRoomMdexAmount = await mdxToken.balanceOf(boardRoom.address);
        let boardMdexPerBlock = await boardRoom.mdxPerBlock();
        let boardPendingResult = await boardRoom.pending(mdexBoardRoomPid, reinvestment.address);
        let boardPoolInfo = await boardRoom.poolInfo(mdexBoardRoomPid);
        let boardUserInfo = await boardRoom.userInfo(mdexBoardRoomPid, reinvestment.address);
        console.log(`boardRoomMdexAmount :${boardRoomMdexAmount}`);
        console.log(`boardMdexPerBlock :${boardMdexPerBlock}`);
        console.log(`boardPendingResult :${boardPendingResult}`);
        console.log(`boardPoolInfo :${JSON.stringify(boardPoolInfo)}`);
        console.log(`boardUserInfo :${JSON.stringify(boardUserInfo)}`);
        let boardRoomStartBlock = await boardRoom.startBlock();
        let boardRoomEndBlock = await boardRoom.endBlock();
        await boardRoom.newReward(depositAmount, 50, parseInt(boardRoomEndBlock, 10)+1);
        await boardRoom.updatePool(mdexBoardRoomPid);
        let boardRoomMdexAmountAfterUpdatePool = await mdxToken.balanceOf(boardRoom.address);
        let boardMdexPerBlockAfterUpdatePool = await boardRoom.mdxPerBlock();
        let boardPendingResultAfterUpdatePool = await boardRoom.pending(mdexBoardRoomPid, reinvestment.address);
        let boardPoolInfoAfterUpdatePool = await boardRoom.poolInfo(mdexBoardRoomPid);
        let boardUserInfoAfterUpdatePool = await boardRoom.userInfo(mdexBoardRoomPid, reinvestment.address);
        console.log(`boardRoomMdexAmountAfterUpdatePool :${boardRoomMdexAmountAfterUpdatePool}`);
        console.log(`boardMdexPerBlockAfterUpdatePool :${boardMdexPerBlockAfterUpdatePool}`);
        console.log(`boardPendingResultAfterUpdatePool :${boardPendingResultAfterUpdatePool}`);
        console.log(`boardPoolInfoAfterUpdatePool :${JSON.stringify(boardPoolInfoAfterUpdatePool)}`);
        console.log(`boardUserInfoAfterUpdatePool :${JSON.stringify(boardUserInfoAfterUpdatePool)}`);

        let totalRewardsAfterUpdatePool = await reinvestment.totalRewards();
        console.log(`totalRewardsAfterUpdatePool: ${totalRewardsAfterUpdatePool}`);
        let globalInfoAfterUpdatePool = await reinvestment.globalInfo();
        console.log(`globalInfoAfterUpdatePool: ${JSON.stringify(globalInfoAfterUpdatePool)}`);
        let userInfoAfterUpdatePool = await reinvestment.userInfo(accounts[0]);
        console.log(`userInfoAfterUpdatePool: ${JSON.stringify(userInfoAfterUpdatePool)}`);

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
