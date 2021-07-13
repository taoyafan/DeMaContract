
// Test flow:
    // MDX init
    // Add liquidity
    // Farm init
    // Bank init
    // Add token
    // Deposit toekn
    // opProduction
    // opPosition (Create position)
    // opPosition (Withdraw position)
    // Remove liquidity


// Functions

    // 1. Production token can borrow
        // Only allow borrow one token.
        // Can borrow two tokens.

    // 2. Positions usage
        // Create
        // Replenishment
        // Repay
        // Withdraw

    // 3. Health and liquidate
        // Open position health restrict
        // Health
        // New health
        // liquidate health

    // 4. Earn
        // MDX earn
        // Farm earn
        // Farm earn with inviation

    // 5. Global and user information
        // Productions number
        // Positions number
        // All positions
        // Users positions number
        // Users all positions


// Unit
    // 1. For 3 Token pairs， r0: 1000   r1: 200,000, price 200

    // 2.
        // token0 amount, token1 amount
        //      10              0
        //       0              10
        //      10              10
        //      10              400

    // 3.
        // Borrow0 amount, Borrow1 amount,
        //      0              0
        //     10              0
        //      0              10
        //     10              10


// Test plans:
    // 1. Production token can borrow
        // (1) Only allow borrow one token.
            // Unit 1
                // Token0 can borrow
                    // Deposit 10 token0, Unit 3, Expect: (success, fail, fail)
                // Token1 can borrow
                    // Deposit 10 token0, Unit 3, Expect: (fail, success, fail)
        // (2) Can borrow two tokens.
            // Unit 1
                // Deposit 10 token0, Unit 3, Expect: (success, success, success)

    // 2. Positions usage
        // Unit 1
            // Deposit 10 token0, Unit 3
                // Create
                // Replenishment
                // Repay
                // Withdraw

    // 3. Health and liquidate
        // Unit 1
            // Unit 2
                // Unit 3
                    // Check health and new health
                    // Swap to make new health to 50%, check new health
                    // Replenishment same as init, new health should be 75%
                    // Withdraw 50%, new health should be 75%, check health
                    // Repay 10%， new health should be 75%, check health
                    // Swap to make new health to 50%, Liquidate


    // 4. Earn




contract("TestBank", (accounts) => {

    // async function lpTest(nameA, nameB, addressA, addressB) {

    //     describe("BNB-USDT-LP Production Test", async () => {

    //         before(`Deposit {nameA} and {nameB}`, async () => {

    //         });

    //         describe(`Borrow only {nameA}`, async () => {

    //             before(`Open production`, async () => {

    //             });

    //             it("Check left amount", async () => {

    //             });

    //             it()

    //         });

    //     });

    // }


    // describe("BUSD-USDT-LP Test", async () => {
    // });
})