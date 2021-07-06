
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
    // 2. Open position and borrow only token0; only token1; both token0 and token1



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