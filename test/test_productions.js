
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
        // Farm earn with inviation(test_bank has tested it)

    // 5. Global and user information
        // Productions number
        // Positions number
        // All positions
        // Users positions number
        // Users all positions
    
    // 6. Interest
        // For deposit token
        // For debts


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
        // Deposit 10 BNB for pool BNB-USDT
            // Move time forward 30 second: 
                // Check MDX earn, should equal to the value calculate bsc pool, reinvestment and boardroom.
                // Check Farm earn, Using stakeEarnedPerPool() in Farm.sol
                // Withdraw 100%. Then received MDX and DEMA should euqal to the value in above two steps.

    // 5. Global and user information
        // Create one BNB-USDT position and create two MDX-USDT position
            // Productions number should be 2 
            // Get all productions id and check.
            // Positions number should be 3
            // All positions can aquire all 3 pos id
            // Users positions number 3
            // Users all positions should equal all positions id
            // Users positions num of BNB-USDT should be 1
            // Users positions num of MDX-USDT should be 2

        // Withdraw one MDX-USDT position
            // Productions number should be 2 
            // Get all productions id and check.
            // Positions number should be 2
            // All positions can aquire all 2 pos id
            // Users positions number 2
            // Users all positions should equal all positions id
            // Users positions num of BNB-USDT should be 1
            // Users positions num of MDX-USDT should be 1

        // Withdraw one MDX-USDT position
            // Productions number should be 1
            // Get all productions id and check.
            // Positions number should be 1
            // All positions can aquire all 1 pos id
            // Users positions number 1
            // Users all positions should equal all positions id
            // Users positions num of BNB-USDT should be 1
            // Users positions num of MDX-USDT should be 0

        // Withdraw one MDX-USDT position
            // Productions number should be 0
            // Get all productions id and check.
            // Positions number should be 0
            // All positions should be empty
            // Users positions number 0
            // Users positions num of BNB-USDT should be 0
            // Users positions num of MDX-USDT should be 0


const MdxGoblin = artifacts.require("MdxGoblin");

const BigNumber = require("bignumber.js");
const { assert } = require("console");
const fs = require('fs')

contract("TestProduction", (accounts) => {
    
    const jsonString = fs.readFileSync("bin/contracts/address.json")
    const addressJson = JSON.parse(jsonString)

    let factory;
    let wbnb;
    let busd;
    let router;
    let mdx;

    let goblinBnbBusd;
    let goblinMdxBusd;

    const name2Address = {
        'Bnb': '0x0000000000000000000000000000000000000000',
        'Busd': addressJson.BUSD,
        'Mdx': addressJson.MdxToken,
    }

    before('Init', async () => {
        factory = await MdexFactory.deployed();
        wbnb = await WBNB.deployed();
        busd = await BUSD.deployed();
        router = await MdexRouter.deployed();
        mdx = await MdxToken.deployed();

        // TODO, deposit token in bank.
    })

    // 2. Positions usage
        // Unit 1
            // Deposit 10 token0, Unit 3
                // Create
                // Replenishment
                // Repay
                // Withdraw
    describe('Positions usage test', async () => {
        
        for (i = 0; i < 3; i++) {
            let [token0Address, token1Address, goblinAddress] = getTokenPairAndInit(i);
            InsideUnit1(token0Name, token1Name, goblinAddress);
            break;  // TODO debug only, need to remove.
        }

        async function InsideUnit1(token0Name, token1Name, goblinAddress) {

        }

    })

    async function getTokenPairAndInit(i) {
        assert(i == 0 || i == 1 || i == 2);

        let pair = [['Bnb', 'Busd'], ['Busd', 'Bnb'], ['Mdx', 'Busd']];
        let r0r1 = [[1000, 200000], [200000, 1000], [1000, 200000]];
        
        let token0Address = name2Address[pair[i][0]];
        let token1Address = name2Address[pair[i][1]];
        
        let r0 = r0r1[i][0];
        let r1 = r0r1[i][0];

        let goblinAddress = addressJson[`MdxGoblin${token0Address}${token1Address}`]

        await addLiquidate(token0Address, token1Address, r0, r1, goblinAddress);

        return [token0Address, token1Address, goblinAddress]
    }

    // Input token address
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
    
    // Input token address
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
    
})