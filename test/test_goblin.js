
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
    // 1. For 3 Token pairs
    // 2. Open position and borrow only token0; only token1; both token0 and token1, r0: 1000   r1: 200,000, price 200



// Test plans:
    // 1. Production token can borrow
        // (1) Only allow borrow one token.
            // Unit 1
                // Token0 can borrow
                    // Unit 2, Expect: (success, fail, fail)
                // Token1 can borrow
                    // Unit 2, Expect: (fail, success, fail)
        // (2) Can borrow two tokens.
            // Unit 1
                // Unit 2, Expect: (success, success, success)

    // 2. Positions usage
        // Unit 1
            // Unit 2
                // Create
                // Replenishment
                // Repay
                // Withdraw

    // 3. Health and liquidate
        // Deposit 1000 USDT, borrow 9000 USDT, should failed.
        // Deposit 400 USDT, borrow 2 BNB, health should be 4, new health should be 100%
            // Liquidate should failed.
            // Swap 200,000 USDT to 500 BNB, then r0 is 500, r1 is 400,000, BNB price is 800, then USDT in LP is 800(equal to 1 BNB), BNB in LP is 1
                // health should be 2, new health should be 0.
                // Liquidate should success.

        // Deposit 300 USDT, borrow 2 BNB, borrow 200 USDT, USDT in LP should be 300, BNB in LP should be 3
            // health should be [533, 5.33], new health should be 100%
            // Liquidate should failed.
            // Swap 200,000 USDT to 500 BNB, then r0 is 500, r1 is 400,000, BNB price is 800, then USDT in LP is 600, BNB in LP is 1.5
                // health should be [], new health should be .
                // Liquidate should success.





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