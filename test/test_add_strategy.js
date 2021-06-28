const AddStrategy = artifacts.require("MdxStrategyAddTwoSidesOptimal");
const mdxInit = require("../scripts/mdx_init.js");
const ERC20 = artifacts.require("ERC20Token");
const MdexPair = artifacts.require("MdexPair");
const bnbAddress = "0x0000000000000000000000000000000000000000";
const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 30 })

const MaxUint256 = BigNumber("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
// Test plan:
// (1)
// token0, token1,      r0,     r1
//  BNB     BUSD       1000   200,000       $200
//
// token0 amount, token1 amount
//       0              0
//      100             0
//       0             100
//      100            100
//      10             4000
//
// Borrow0 amount, Borrow1 amount,
//      0              0
//     100             0
//      0             100
//     100            100
//
// target: check the return LP amount and principal
//
// (2)
// token0, token1,
//  BUSD    BNB
//
// (3)
// token0, token1,
//  BUSD    MDX
//
// (4)
// token0, token1,
//  MDX     BUSD

contract("TestAddStrategy", (accounts) => {

    let factory;
    let wbnb;
    let busd;
    let router;
    let mdx;

    let addStrategy;

    let goblin = accounts[0];
    let user = accounts[1];

    before('Init', async () => {
        [factory, wbnb, busd, router, /* wbnb_busd_lp */, mdx, /* mdx_busd_lp */] = await mdxInit();
        addStrategy = await AddStrategy.new(router.address, goblin);
        await busd.transfer(user, BigNumber(5e24))
        await mdx.transfer(user, BigNumber(5e24))
    })

    test('bnb', 'busd', false)
    test('bnb', 'busd', true)
    test('mdx', 'busd', false)
    test('mdx', 'busd', true)

    async function test(token0Name, token1Name, reverse) {

        describe(`\n\nTest with ${reverse ? token1Name : token0Name} and ${reverse ? token0Name : token1Name}`, async () => {

            let r0 = 1000;
            let r1 = 200000;
            let token0Amount = [10, 0, 10, 1];
            let token1Amount = [0, 10, 10, 400];
            let borrow0 = [0, 10, 0, 10];
            let borrow1 = [0, 0, 10, 10];

            if (reverse) {
                [token0Name, token1Name] = [token1Name, token0Name];
                [r0, r1] = [r1, r0];
                [token0Amount, token1Amount] = [token1Amount, token0Amount];
                [borrow0, borrow1] = [borrow1, borrow0];
            }
            
            for (let i = 0; i < token0Amount.length; ++i) {
                for (let j = 0; j < borrow0.length; ++j) {
                    singalTest(token0Amount[i], token1Amount[i], borrow0[j], borrow1[j], r0, r1)
                }
            }

            async function singalTest(amount0, amount1, borrow0, borrow1, r0, r1) {

                amount0 = BigNumber(web3.utils.toWei(String(amount0)));
                amount1 = BigNumber(web3.utils.toWei(String(amount1)));
                borrow0 = BigNumber(web3.utils.toWei(String(borrow0)));
                borrow1 = BigNumber(web3.utils.toWei(String(borrow1)));
                r0 = BigNumber(web3.utils.toWei(String(r0)));
                r1 = BigNumber(web3.utils.toWei(String(r1)));

                describe(`\n\nCheck execute of amount: ${fromWei(amount0)}, ${fromWei(amount1)}, borrow: ${
                    fromWei(borrow0)}, ${fromWei(borrow1)}`, async () => {

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

                    let value;
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

                        value = 0
                        if (token0 == bnbAddress) {
                            lpAddress = await factory.getPair(wbnb.address, token1);
                            value = amount0.plus(borrow0)
                            web3.eth.sendTransaction({from: user, to: goblin, value: amount0})

                        } else if (token1 == bnbAddress) {
                            lpAddress = await factory.getPair(wbnb.address, token0);
                            value = amount1.plus(borrow1)
                            web3.eth.sendTransaction({from: user, to: goblin, value: amount1})

                        } else {
                            lpAddress = await factory.getPair(token0, token1);
                        }

                        beforeLpAmount = await getBalance(lpAddress, goblin);

                        // console.log(`beforeGoblinToken0Amount is: ${fromWei(beforeGoblinToken0Amount)}`)
                        // console.log(`beforeGoblinToken1Amount is: ${fromWei(beforeGoblinToken1Amount)}`)
                        // console.log(`beforeUserToken0Amount is: ${fromWei(beforeUserToken0Amount)}`)
                        // console.log(`beforeUserToken1Amount is: ${fromWei(beforeUserToken1Amount)}`)
                        // console.log(`beforeLpAmount is: ${fromWei(beforeLpAmount)}`)

                        // 3. Approve token
                        await approve(token0, addStrategy.address, borrow0, goblin);
                        await approve(token1, addStrategy.address, borrow1, goblin);

                        await approve(token0, addStrategy.address, amount0, user);
                        await approve(token1, addStrategy.address, amount1, user);

                    })  // before

                    it(`Call execute`, async () => {
                        let data = web3.eth.abi.encodeParameters(
                            ["address", "address", "uint256", "uint256", "uint256"],
                            [token0, token1, amount0, amount1, 0]);

                        await addStrategy.execute(user, [token0, token1], [borrow0, borrow1], 
                            [borrow0, borrow1], data, {from: goblin, value: value})

                        // 5. Get the after amount 
                        afterGoblinToken0Amount = await getBalance(token0, goblin);
                        afterGoblinToken1Amount = await getBalance(token1, goblin);
                        afterUserToken0Amount = await getBalance(token0, user);
                        afterUserToken1Amount = await getBalance(token1, user);
                        afterLpAmount = await getBalance(lpAddress, goblin);

                        // console.log(`afterGoblinToken0Amount is: ${fromWei(afterGoblinToken0Amount)}`)
                        // console.log(`afterGoblinToken1Amount is: ${fromWei(afterGoblinToken1Amount)}`)
                        // console.log(`afterUserToken0Amount is: ${fromWei(afterUserToken0Amount)}`)
                        // console.log(`afterUserToken1Amount is: ${fromWei(afterUserToken1Amount)}`)
                        // console.log(`afterLpAmount is: ${fromWei(afterLpAmount)}`)
                    })

                    it('Check user amount', async () => {
                        let decAmount0 = beforeUserToken0Amount.minus(afterUserToken0Amount)
                        let decAmount1 = beforeUserToken1Amount.minus(afterUserToken1Amount)
                        assert.equal(decAmount0.minus(amount0).dividedToIntegerBy(1e18).toNumber(), 0)
                        assert.equal(decAmount1.minus(amount1).dividedToIntegerBy(1e18).toNumber(), 0)
                    })

                    it('Check goblin amount', async () => {
                        let decAmount0 = beforeGoblinToken0Amount.minus(afterGoblinToken0Amount)
                        let decAmount1 = beforeGoblinToken1Amount.minus(afterGoblinToken1Amount)
                        assert.equal(decAmount0.minus(borrow0).dividedToIntegerBy(1e18).toNumber(), 0)
                        assert.equal(decAmount1.minus(borrow1).dividedToIntegerBy(1e18).toNumber(), 0)
                    })

                    it(`Check LP value`, async () => {
                        let incLp = afterLpAmount.minus(beforeLpAmount);
                        console.log(`Increased lp amount is: ${fromWei(incLp)}`);
                        
                        let _r0, _r1
                        [_r0, _r1] = await getR0R1(token0, token1)
                        
                        // Get the value of incLp
                        let lp = await MdexPair.at(lpAddress)
                        let totalLp = await lp.totalSupply();
                        console.log(`Total lp amount is: ${fromWei(totalLp)}`)

                        let token0AmountInLp = BigNumber(_r0).multipliedBy(incLp).dividedToIntegerBy(totalLp)
                        let token1AmountInLp = BigNumber(_r1).multipliedBy(incLp).dividedToIntegerBy(totalLp)
                        console.log(`token0AmountInLp is: ${fromWei(token0AmountInLp)}, token1AmountInLp is: ${
                            fromWei(token1AmountInLp)}`);
                        
                        let totalToken0Send = amount0.plus(borrow0)
                        let totalToken1Send = amount1.plus(borrow1)
                        console.log(`totalToken0Send is: ${fromWei(totalToken0Send)}, totalToken1Send is: ${
                            fromWei(totalToken1Send)}`)
                        
                        let targetAmount0 = await swapAllToA(totalToken0Send, totalToken1Send, _r0, _r1);
                        let getAmount0 = await swapAllToA(token0AmountInLp, token1AmountInLp, _r0, _r1);
                        console.log(`targetAmount0 is : ${fromWei(targetAmount0)}`)
                        console.log(`getAmount0 is : ${fromWei(getAmount0)}`)

                        delta = getAmount0.isGreaterThan(targetAmount0) ? getAmount0.minus(targetAmount0) :
                            targetAmount0.minus(getAmount0)
                        assert(delta.isLessThan(getAmount0.multipliedBy(4).dividedToIntegerBy(1000)))
                    })

                    it('Remove liquidate', async () => {
                        await removeAllLiquidity(token0, token1, goblin)

                        let wbnbAmount = await wbnb.balanceOf(goblin) 
                        if (wbnbAmount > 0) {
                            wbnb.withdraw(wbnbAmount)
                        }

                        let lpAmount = await getBalance(lpAddress, goblin);
                        assert.equal(lpAmount.toNumber(), 0, `lp amount should be 0`)
                        
                        wbnbAmount = await wbnb.balanceOf(goblin) 
                        assert.equal(wbnbAmount.toNumber(), 0, `wbnb amount should be 0`)
                        
                        transfer(token0, user, amount0, goblin)
                        transfer(token1, user, amount1, goblin)
                    })
                })  // describe
            }   // singalTest()

            // -------------- The following are helper function --------------

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

            // it(`Swap test`, async () => {
            //     await addLiquidate(bnbAddress, busd.address, toWei(r0), toWei(r1), goblin);

            //     let token0 = wbnb.address
            //     let token1 = busd.address

            //     await wbnb.deposit({ from: goblin, value: toWei(50) });       // Get wbnb
            //     await wbnb.approve(router.address, toWei(50));
            //     // await busd.approve(router.address, toWei(r1));

            //     let beforeGoblinToken0Amount = await getBalance(token0, goblin);
            //     let beforeGoblinToken1Amount = await getBalance(token1, goblin);

            //     console.log(`beforeGoblinToken0Amount : ${fromWei(beforeGoblinToken0Amount)
            //         }, beforeGoblinToken1Amount: ${fromWei(beforeGoblinToken1Amount)}`)

            //     router.swapExactTokensForTokens(toWei(50), 0, [token0, token1], goblin, MaxUint256, {from: goblin})

            //     let afterGoblinToken0Amount = await getBalance(token0, goblin);
            //     let afterGoblinToken1Amount = await getBalance(token1, goblin);

            //     console.log(`afterGoblinToken0Amount : ${fromWei(afterGoblinToken0Amount)
            //         }, afterGoblinToken1Amount: ${fromWei(afterGoblinToken1Amount)}`)

            //     await getR0R1(token0, token1)
            // })

        })  // describe
    }   // test()
})

function toWei(ether) {
    return web3.utils.toWei(BigNumber(ether).toString())
}

function fromWei(wei) {
    return web3.utils.fromWei(BigNumber(wei).toString())
}
