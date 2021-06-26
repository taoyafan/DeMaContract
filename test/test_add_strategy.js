const AddStrategy = artifacts.require("MdxStrategyAddTwoSidesOptimal");
const mdxInit = require("../scripts/mdx_init.js");
const ERC20 = artifacts.require("ERC20Token");
const bnbAddress = "0x0000000000000000000000000000000000000000";
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

    let goblin = accouts[0];
    let user = accounts[1]

    before(async () => {
        [factory, wbnb, busd, router, /* wbnb_busd_lp */, mdx, /* mdx_busd_lp */] = await mdxInit();
        addStrategy = new AddStrategy(router.address, goblin);
    });

    async function test(token0Address, token1Address, reverse) {

        describe(`Test with ${reverse ? token1Address : token0Address}
            and ${reverse ? token0Address : token1Address}`, async () => {

            let r0 = 1000;
            let r1 = 200000;
            let token0Amount = [0, 100, 0, 100, 10];
            let token1Amount = [0, 0, 100, 100, 4000];
            let borrow0 = [0, 100, 0, 100];
            let borrow1 = [0, 0, 100, 100];

            if (reverse) {
                [token0Address, token1Address] = [token1Address, token0Address];
                [r0, r1] = [r1, r0];
                [token0Amount, token1Amount] = [token1Amount, token0Amount];
                [borrow0, borrow1] = [borrow1, borrow0];
            }

            async function singalTest(amount0, amount1, borrow0, borrow1, r0, r1, token0, token1) {

                amount0 = BigNumber(web3.utils.toWei(amount0));
                amount1 = BigNumber(web3.utils.toWei(amount1));
                borrow0 = BigNumber(web3.utils.toWei(borrow0));
                borrow1 = BigNumber(web3.utils.toWei(borrow1));
                r0 = BigNumber(web3.utils.toWei(r0));
                r1 = BigNumber(web3.utils.toWei(r1));

                function approve(tokenAddress, to, amount, from) {
                    if (tokenAddress == bnbAddress)
                        return

                    let token = await ERC20.at(tokenAddress);
                    await token.approve(to, amount, {from: from});
                }

                it(`Check received DEMA`, async () => {
                    let data = web3.eth.abi.encodeParameters(
                        ["address", "address", "uint256", "uint256", "uint256"],
                        [token0, token1, amount0, amount1, 0]);

                    let value = 0;
                    if (token0 == bnbAddress) {
                        value = amount0.add(borrow0)
                    } else if (token1 == bnbAddress) {
                        value = amount1.add(borrow1)
                    }

                    approve(token0, addStrategy.address, borrow0, goblin);
                    approve(token1, addStrategy.address, borrow1, goblin);

                    approve(token0, addStrategy.address, amount0, user);
                    approve(token1, addStrategy.address, amount1, user);

                    addStrategy.execute(user, [token0, token1], [borrow0, borrow1], [borrow0, borrow1], data, {value: value})
                })
            }
        })
    }

    it("Check info", async () => {
        console.log(`busd amount is: ${web3.utils.fromWei(await busd.balanceOf(accounts[0]))}`)
        console.log(`mdx amount is: ${web3.utils.fromWei(await mdx.balanceOf(accounts[0]))}`)
    })
})
