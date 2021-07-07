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
    });

    it("totalRewards", async () => {
        let mdxBalance = await mdxToken.balanceOf(reinvestment.address);
        let totalRewardsFromReinvestment = await reinvestment.totalRewards();

        assert.equal(totalRewardsFromReinvestment.toNumber(), mdxBalance.toNumber());
    });

    it("rewardsPerShare", async () => {
        let rewardsPerShareAmount = await reinvestment.rewardsPerShare();
        assert.equal(rewardsPerShareAmount.toNumber(), 0);
    });

    it("userEarnedAmount", async ()=> {
        let accounts0EarnedAmount = await reinvestment.userEarnedAmount(accounts[0]);
        assert.equal(accounts0EarnedAmount.toNumber(), depositAmount);
        let accounts1EarnedAmount = await reinvestment.userEarnedAmount(accounts[1]);
        assert.equal(accounts1EarnedAmount.toNumber(), 0);
    });

    it("deposit", async () => {
        assert.equal(depositAmount.toNumber(), (await mdxToken.balanceOf(reinvestment.address)).toNumber());
    });

    it("withdraw", async () => {
        let tempAmount = BigNumber(1000);
        await reinvestment.deposit(tempAmount);
        let beforeWithdrawAmount = BigNumber((await mdxToken.balanceOf(reinvestment.address)).toNumber());
        await reinvestment.withdraw(tempAmount);
        let afterWithdrawAmount = BigNumber((await mdxToken.balanceOf(reinvestment.address)).toNumber());
        assert(beforeWithdrawAmount.minus(tempAmount), afterWithdrawAmount);
    })
})

function toWei(ether) {
    return web3.utils.toWei(BigNumber(ether).toString())
}

function fromWei(wei) {
    return web3.utils.fromWei(BigNumber(wei).toString())
}
