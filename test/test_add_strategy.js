const AddStrategy = artifacts.require("MdxStrategyAddTwoSidesOptimal");
const MdexRouter = artifacts.require("MdexRouter");     // Require migrate mdx first.

contract("TestAddStrategy", (accounts) => {

    before(async () => {
        this.addStrategy = new AddStrategy(MdexRouter.address, )
    });

    // Test plan:
    // (1)
    // token0, token1,      r0,     r1
    //  BNB     USDT       1000   200,000
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
    // target, calculate the return LP amount.
    //
    // (2)
    // token0, token1,      r0,     r1
    //  BUSD     USDT    200,000  200,000
})
