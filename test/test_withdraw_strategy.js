const WithdrawStrategy = artifacts.require("MdxStrategyWithdrawMinimizeTrading");
const mdxInit = require("../scripts/mdx_init.js");
const ERC20 = artifacts.require("ERC20Token");
const MdexPair = artifacts.require("MdexPair");
const bnbAddress = "0x0000000000000000000000000000000000000000";
const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 30 })

const MaxUint256 = BigNumber("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

// Test plan:
// paramters: r0, r1, borrow token, lp amount, debts, rate, which want back(0, 1, 2, 3 => t0, t1, surplus, don't back)
// (1)
// token0, token1,      r0,     r1
//  BNB     BUSD       1000   200,000       $200
//
//      lp amount,     debt 0,     debt 1
//      init * 0.01       5          1000
//                        5            0
//                        0          1000
//                        20         4000
//                        30           0
//                        0          6000
//
// rate: 10%, 60%, 100%
// which want back: 0, 1, 2, 3
//
// (2) BUSD, BNB
// (3) MDX, BUSD
// (4) BUSD, MDX


contract("TestWithdrawStrategy", (accounts) => {

    let factory;
    let wbnb;
    let busd;
    let router;
    let mdx;

    let withdrawStrategy;

    let goblin = accounts[0];
    let user = accounts[1];

    before('Init', async () => {
        [factory, wbnb, busd, router, /* wbnb_busd_lp */, mdx, /* mdx_busd_lp */] = await mdxInit();
        withdrawStrategy = await WithdrawStrategy.new(router.address, goblin);
        // await busd.transfer(user, BigNumber(5e24))
        // await mdx.transfer(user, BigNumber(5e24))
    })

    test('bnb', 'busd', false)
    // test('bnb', 'busd', true)
    // test('mdx', 'busd', false)
    // test('mdx', 'busd', true)

    async function test(token0Name, token1Name, reverse) {

        describe(`\n\nTest with ${reverse ? token1Name : token0Name} and ${reverse ? token0Name : token1Name}`, async () => {

            let r0 = 1000;
            let r1 = 200000;
            let debts0 = [5, 5, 0, 20, 30]
            let debts1 = [1000, 0, 1000, 4000, 0, 6000]
            let rate = [1000, 5000, 10000]
            let back = [0, 1, 2, 3]
            let lpSendRate = 0.01;

            if (reverse) {
                [token0Name, token1Name] = [token1Name, token0Name];
                [r0, r1] = [r1, r0];
                [debts0, debts1] = [debts1, debts0];
            }

            singalTest(debts0[0], debts1[0], rate[0], back[0], r0, r1)

            async function singalTest(debt0, debt1, rate, back, r0, r1) {

                debt0 = BigNumber(web3.utils.toWei(String(debt0)));
                debt1 = BigNumber(web3.utils.toWei(String(debt1)));
                r0 = BigNumber(web3.utils.toWei(String(r0)));
                r1 = BigNumber(web3.utils.toWei(String(r1)));

                describe(`\n\nCheck execute of debts: ${fromWei(debt0)}, ${fromWei(debt1)}, rate: ${
                    rate}, back: ${back}`, async () => {

                    let beforeGoblinToken0Amount;
                    let beforeGoblinToken1Amount;
                    let beforeUserToken0Amount;
                    let beforeUserToken1Amount;
                    let beforeLpAmount;

                    let afterGoblinToken0Amount;
                    let afterGoblinToken1Amount;
                    let afterUserToken0Amount;
                    let afterUserToken1Amount;
                    let afterLpAmount;
                    
                    let sendAmount0;
                    let sendAmount1;
                    let sendLp;

                    let token0;
                    let token1;
                    let lpAddress;

                    it(`Add liquidate`, async () => {

                        // 1. Get token address
                        if (token0Name == 'bnb') {
                            token0 = bnbAddress;
                        } else if (token0Name == 'busd') {
                            token0 = busd.address
                        } else if (token0Name == 'mdx') {
                            token0 = mdx.address
                        }

                        if (token1Name == 'bnb') {
                            token1 = bnbAddress;
                        } else if (token1Name == 'busd') {
                            token1 = busd.address
                        } else if (token1Name == 'mdx') {
                            token1 = mdx.address
                        }


                        // 2. Get before amount
                        await addLiquidate(token0, token1, r0, r1, goblin)

                        beforeGoblinToken0Amount = await getBalance(token0, goblin);
                        beforeGoblinToken1Amount = await getBalance(token1, goblin);
                        beforeUserToken0Amount = await getBalance(token0, user);
                        beforeUserToken1Amount = await getBalance(token1, user);

                        if (token0 == bnbAddress || token1 == bnbAddress) {
                            lpAddress = await factory.getPair(wbnb.address, token1);
                        } else {
                            lpAddress = await factory.getPair(token0, token1);
                        }

                        beforeLpAmount = await getBalance(lpAddress, goblin);

                        console.log(`beforeGoblinToken0Amount is: ${fromWei(beforeGoblinToken0Amount)}`)
                        console.log(`beforeGoblinToken1Amount is: ${fromWei(beforeGoblinToken1Amount)}`)
                        console.log(`beforeUserToken0Amount is: ${fromWei(beforeUserToken0Amount)}`)
                        console.log(`beforeUserToken1Amount is: ${fromWei(beforeUserToken1Amount)}`)
                        console.log(`beforeLpAmount is: ${fromWei(beforeLpAmount)}`)

                    })  // before

                    it(`Call execute`, async () => {
                        sendLp = beforeLpAmount.multipliedBy(lpSendRate).dividedToIntegerBy(1)
                        // let sendAmount0, sendAmount1
                        // let a, b
                        // console.log(`1 Send lp is : ${sendLp}`)
                        console.log(`1 Send lp is : ${sendLp}, send amount is : ${sendAmount0}, ${sendAmount1}`)
                        
                        let tmp = await getR0R1(token0, token1)
                        console.log(`tmp is : ${tmp}`)
                        
                        sendAmount0 = tmp[0]
                        sendAmount1 = tmp[1]
                        [sendAmount0, sendAmount1] = [1, 2];
                        // [sendAmount0, sendAmount1] = await getTokenAmountInLp(token0, token1, sendLp)

                        console.log(`Send lp is : ${sendLp}, send amount is : ${sendAmount0}; ${sendAmount1}`)
                        // console.log(`send amount is : ${sendAmount0}, ${sendAmount1}`)
                        // console.log(`a b is : ${a}, ${b}`)

                        // await transfer(lpAddress, withdrawStrategy, sendLp, goblin)

                        // let data = web3.eth.abi.encodeParameters(
                        //     ["address", "address", "uint256", "uint256"],
                        //     [token0, token1, rate, back]);

                        // await withdrawStrategy.execute(user, [token0, token1], [0, 0],
                        //     [debt0, debt1], data, {from: goblin})

                        // // 5. Get the after amount
                        // afterGoblinToken0Amount = await getBalance(token0, goblin);
                        // afterGoblinToken1Amount = await getBalance(token1, goblin);
                        // afterUserToken0Amount = await getBalance(token0, user);
                        // afterUserToken1Amount = await getBalance(token1, user);
                        // afterLpAmount = await getBalance(lpAddress, goblin);
                        

                        // console.log(`afterGoblinToken0Amount is: ${fromWei(afterGoblinToken0Amount)}`)
                        // console.log(`afterGoblinToken1Amount is: ${fromWei(afterGoblinToken1Amount)}`)
                        // console.log(`afterUserToken0Amount is: ${fromWei(afterUserToken0Amount)}`)
                        // console.log(`afterUserToken1Amount is: ${fromWei(afterUserToken1Amount)}`)
                        // console.log(`afterLpAmount is: ${fromWei(afterLpAmount)}`)
                    })

                    // it(`Check LP value`, async () => {
                    //     let targetSendLp = beforeLpAmount.minus(afterLpAmount);
                    //     assert.equal(targetSendLp, sendLp)
                    // })

                    // it('Check user amount', async () => {
                    //     let _r0, _r1
                    //     [_r0, _r1] = await getR0R1(token0, token1)

                    //     // Swap all deposit tokens to token0
                    //     let totalTo0Amount = await swapAllToA(sendAmount0, sendAmount1, _r0, _r1);
                    //     console.log(`Equivalent deposit token0: ${fromWei(totalTo0Amount)}`)

                    //     // Swap all debts to token0
                    //     let debtTo0 = await swapAllToA(debt0, debt1, _r0, _r1);
                    //     console.log(`Equivalent debts token0: ${fromWei(debtTo0)}`)

                    //     let getAmount0 = afterUserToken0Amount.minus(beforeUserToken0Amount)
                    //     let getAmount1 = afterUserToken1Amount.minus(beforeUserToken1Amount)

                    //     // Swap all return toekns to token0
                    //     let getTo0Amount = await swapAllToA(getAmount0, getAmount1, _r0, _r1);
                    //     console.log(`Equivalent return token0: ${fromWei(getTo0Amount)}`)

                    //     if (back == 3) {
                    //         // Repay first, if repay all then return left
                    //         if (totalTo0Amount.multipliedBy(rate.minus(400)).dividedToIntegerBy(10000).isGreaterThan(debtTo0)) {
                    //             let targetTo0Amount = totalTo0Amount.multipliedBy(rate).dividedToIntegerBy(10000).minus(debtTo0)
                    //             console.log(`Target equivalent return token0: ${fromWei(targetTo0Amount)}`)
                                
                    //             let delta = getTo0Amount.isGreaterThan(targetTo0Amount) ? getTo0Amount.minus(targetTo0Amount) :
                    //                 targetTo0Amount.minus(getTo0Amount)

                    //             assert(delta.isLessThan(getTo0Amount.multipliedBy(4).dividedToIntegerBy(1000)), 
                    //                 'Delta should be 0')
                    //         } else {
                    //             assert.equal(getTo0Amount.toNumber(), 0, "There should not return token")
                    //         }
                    //     } else {
                    //         // return amounts should equal to (all - debts) * rate
                    //         let targetTo0Amount = totalTo0Amount.minus(debtTo0).multipliedBy(rate).dividedToIntegerBy(10000)
                    //         console.log(`Target equivalent return token0: ${targetTo0Amount}`)
                                
                    //         let delta = getTo0Amount.isGreaterThan(targetTo0Amount) ? getTo0Amount.minus(targetTo0Amount) :
                    //             targetTo0Amount.minus(getTo0Amount)

                    //         assert(delta.isLessThan(getTo0Amount.multipliedBy(4).dividedToIntegerBy(1000)), 
                    //             'Delta should be 0')

                    //         if (back == 0) {
                    //             // Only return token0
                    //             assert.equal(getAmount1.toNumber(), 0, "Should return only token0")
                    //         } else if (back == 1) {
                    //             // Only return token1
                    //             assert.equal(getAmount0.toNumber(), 0, "Should return only token1")
                    //         }
                    //     }
                    // })

                    // it('Check goblin amount', async () => {
                    //     let _r0, _r1
                    //     [_r0, _r1] = await getR0R1(token0, token1)

                    //     // Swap all deposit tokens to token0
                    //     let totalTo0Amount = await swapAllToA(sendAmount0, sendAmount1, _r0, _r1);

                    //     // Swap all debts to token0
                    //     let debtTo0 = await swapAllToA(debt0, debt1, _r0, _r1);

                    //     let getAmount0 = afterGoblinToken0Amount.minus(beforeGoblinToken0Amount)
                    //     let getAmount1 = afterGoblinToken1Amount.minus(beforeGoblinToken1Amount)

                    //     // Swap all return toekns to token0
                    //     let getTo0Amount = await swapAllToA(getAmount0, getAmount1, _r0, _r1);
                    //     console.log(`Equivalent return token0: ${fromWei(getTo0Amount)}`)

                    //     if (back == 3) {
                    //         // Repay debts first, amount = total * rate
                    //         if (totalTo0Amount.multipliedBy(rate.minus(400)).dividedToIntegerBy(10000).isGreaterThan(debtTo0)) {
                    //             assert.equal(getAmount0, debt0, "All debt0 should be repayed")
                    //             assert.equal(getAmount1, debt1, "All debt1 should be repayed")
                    //         } else {
                    //             assert.equal(getAmount0, sendAmount0.multipliedBy(rate).dividedToIntegerBy(10000),
                    //                  "All debt0 should be repayed")
                    //             assert.equal(getAmount1, sendAmount1.multipliedBy(rate).dividedToIntegerBy(10000), 
                    //                 "All debt1 should be repayed")
                    //         }                            
                    //     } else {
                    //         // return amounts should equal to debts * rate
                    //         assert.equal(getAmount0, debt0.multipliedBy(rate).dividedToIntegerBy(10000),
                    //             "Debt0 repayed amount not correct")
                    //         assert.equal(getAmount1, debt1.multipliedBy(rate).dividedToIntegerBy(10000),
                    //             "Debt1 repayed amount not correct")
                    //     }
                        
                    // })

                    // it('Recover', async () => {
                    //     await removeAllLiquidity(token0, token1, goblin)

                    //     let wbnbAmount = await wbnb.balanceOf(goblin)
                    //     if (wbnbAmount > 0) {
                    //         wbnb.withdraw(wbnbAmount)
                    //     }

                    //     let lpAmount = await getBalance(lpAddress, goblin);
                    //     assert.equal(lpAmount.toNumber(), 0, `lp amount should be 0`)

                    //     wbnbAmount = await wbnb.balanceOf(goblin)
                    //     assert.equal(wbnbAmount.toNumber(), 0, `wbnb amount should be 0`)

                    //     let getAmount0 = afterUserToken0Amount.minus(beforeUserToken0Amount)
                    //     let getAmount1 = afterUserToken1Amount.minus(beforeUserToken1Amount)
                    //     transfer(token0, goblin, getAmount0, user)
                    //     transfer(token1, goblin, getAmount1, user)
                    // })
                })  // describe
            }   // singalTest()

            // -------------- The following are helper function --------------

            async function getTokenAmountInLp(token0, token1, lpAmount) {

                return (await getR0R1(token0, token1));

                if (token0 == bnbAddress) {
                    token0 = wbnb.address
                } else if (token1 == bnbAddress) {
                    token1 = wbnb.address
                }

                let _r0, _r1
                [_r0, _r1] = await getR0R1(token0, token1)

                // Get the value of incLp
                let lpAddress = await factory.getPair(token0, token1);
                let lp = await MdexPair.at(lpAddress)
                let totalLp = await lp.totalSupply();

                let token0AmountInLp = BigNumber(_r0).multipliedBy(lpAmount).dividedToIntegerBy(totalLp)
                let token1AmountInLp = BigNumber(_r1).multipliedBy(lpAmount).dividedToIntegerBy(totalLp)

                console.log(`lpAmount is : ${lpAmount}, amount in lp is : ${token0AmountInLp}, ${token1AmountInLp}`)
                
                return [token0AmountInLp, token1AmountInLp]
            }

            async function transfer(tokenAddress, to, amount, from) {
                if (tokenAddress == bnbAddress) {
                    await web3.eth.sendTransaction({from: from, to: to, value: amount})
                } else {
                    let token = await ERC20.at(tokenAddress);
                    await token.transfer(to, amount, {from: from});
                }
            }

            async function approve(tokenAddress, to, amount, from) {
                if (tokenAddress == bnbAddress)
                    return

                let token = await ERC20.at(tokenAddress);
                await token.approve(to, 0, {from: from});
                await token.approve(to, amount, {from: from});
            }

            async function getBalance(tokenAddress, account) {
                if (tokenAddress == bnbAddress) {
                    return BigNumber(await web3.eth.getBalance(account))
                } else {
                    let token = await ERC20.at(tokenAddress);
                    return BigNumber(await token.balanceOf(account));
                }
            }

            async function getR0R1(token0, token1) {
                if (token0 == bnbAddress) {
                    token0 = wbnb.address
                } else if (token1 == bnbAddress) {
                    token1 = wbnb.address
                }

                let lpAddress = await factory.getPair(token0, token1);
                let lp = await MdexPair.at(lpAddress)
                let token0InLp = await lp.token0()
                res = await lp.getReserves();
                let _r0, _r1
                if (token0 == token0InLp ||
                    (token0 == bnbAddress && token0InLp == wbnb.address))
                {
                    [_r0, _r1] = [res[0], res[1]]
                } else {
                    [_r0, _r1] = [res[1], res[0]]
                }
                console.log(`r0 is: ${fromWei(_r0)}, r1 is: ${fromWei(_r1)}`);
                return [_r0, _r1];
            }

            async function addLiquidate(token0, token1, r0, r1, from) {
                if (token0 == bnbAddress) {
                    token0 = wbnb.address
                    wbnb.deposit({from: from, value: r0})
                } else if (token1 == bnbAddress) {
                    token1 = wbnb.address
                    wbnb.deposit({from: from, value: r1})
                }

                await approve(token0, router.address, r0, from)
                await approve(token1, router.address, r1, from)

                await router.addLiquidity(token0, token1,
                    r0, r1, 0, 0, from, MaxUint256, {from: from});

                console.log(`After init add liquidity:`)
                await getR0R1(token0, token1);
            }

            async function removeAllLiquidity(token0, token1, from) {
                if (token0 == bnbAddress) {
                    token0 = wbnb.address
                } else if (token1 == bnbAddress) {
                    token1 = wbnb.address
                }

                let lpAddress = await factory.getPair(token0, token1);
                let lpAmount = await getBalance(lpAddress, from)

                await approve(lpAddress, router.address, lpAmount, from)
                await router.removeLiquidity(token0, token1,
                    lpAmount, 0, 0, from, MaxUint256, {from: from});

                console.log(`After remove all liquidity:`)
                await getR0R1(token0, token1);
            }

            async function swapAllToA(na, nb, ra, rb) {
                let deltaA = BigNumber(nb).multipliedBy(ra).dividedToIntegerBy(rb)
                return BigNumber(na).plus(deltaA)
            }

        })  // describe
    }   // test()
})

function toWei(ether) {
    return web3.utils.toWei(BigNumber(ether).toString())
}

function fromWei(wei) {
    return web3.utils.fromWei(BigNumber(wei).toString())
}

