
# Test flow:

    MDX init
    Add liquidity
    Farm init
    Bank init
    Add token
    Deposit toekn
    opProduction
    opPosition (Create position)
    opPosition (Withdraw position)
    Remove liquidity


# Functions

    1. Production token can borrow
        Only allow borrow one token.
        Can borrow two tokens.

    2. Positions usage
        Create
        Replenishment
        Repay
        Withdraw

    3. Health and liquidate
        Open position health restrict
        Health
        New health
        liquidate health

    4. Earn
        MDX earn
        Farm earn
        Farm earn with inviation(test_bank has tested it)

    5. Global and user information
        Productions number
        Positions number
        All positions
        Users positions number
        Users all positions

    6. Interest
        For deposit token
        For debts


# Unit

    1. For 3 Token pairs， r0: 1000   r1: 200,000, price 200 (getTokenPairAndInit(i))

    2.
        token0 amount, token1 amount
                10              0
                0              10
                10              10
                1              10

    3.
        Borrow0 amount, Borrow1 amount,
                0              0
                10              0
                0              10
                10              10


# Test plans:

    1. Production token can borrow

        (1) Only allow borrow one token.
            Unit 1
                Token0 can borrow
                    Deposit 10 token0, Unit 3, Expect: (success, fail, fail)
                Token1 can borrow
                    Deposit 10 token0, Unit 3, Expect: (fail, success, fail)
        (2) Can borrow two tokens.
            Unit 1
                Deposit 10 token0, Unit 3, Expect: (success, success, success)

    2. Positions usage

        Unit 1
            Deposit 10 token0, Unit 3
                Create
                Replenishment
                Repay
                Withdraw

    3. Health and liquidate

        Unit 1
            Unit 2
                Unit 3
                    Check health and new health
                    Swap to make new health to 50%, check new health
                    Replenishment same as init, new health should be 75%
                    Withdraw 50%, new health should be 75%, check health
                    Repay 10%， new health should be 75%, check health
                    Swap to make new health to 50%, Liquidate

    4. Earn

        Deposit 10 BNB for pool BNB-USDT
            Move time forward 30 second:
                Check MDX earn, should equal to the value calculate bsc pool, reinvestment and boardroom.
                Check Farm earn, Using stakeEarnedPerPool() in Farm.sol
                Withdraw 100%. Then received MDX and DEMA should euqal to the value in above two steps.

    5. Global and user information

        Create one BNB-USDT position and create two MDX-USDT position
        
            Productions number should be 2
            Get all productions id and check.
            Positions number should be 3
            All positions can aquire all 3 pos id
            Users positions number 3
            Users all positions should equal all positions id
            Users positions num of BNB-USDT should be 1
            Users positions num of MDX-USDT should be 2

        Withdraw one MDX-USDT position

            Productions number should be 2
            Get all productions id and check.
            Positions number should be 2
            All positions can aquire all 2 pos id
            Users positions number 2
            Users all positions should equal all positions id
            Users positions num of BNB-USDT should be 1
            Users positions num of MDX-USDT should be 1

        Withdraw one MDX-USDT position

            Productions number should be 1
            Get all productions id and check.
            Positions number should be 1
            All positions can aquire all 1 pos id
            Users positions number 1
            Users all positions should equal all positions id
            Users positions num of BNB-USDT should be 1
            Users positions num of MDX-USDT should be 0

        Withdraw one MDX-USDT position

            Productions number should be 0
            Get all productions id and check.
            Positions number should be 0
            All positions should be empty
            Users positions number 0
            Users positions num of BNB-USDT should be 0
            Users positions num of MDX-USDT should be 0