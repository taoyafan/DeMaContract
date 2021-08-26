const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 30 })
const Bank = artifacts.require("Bank");

const {
    bnbAddress,
    addressJson,
    name2Address,
    equal,
    swapAllLpToToken0,
    approve,
    swapToTarget,
    getR0R1,
    fromWei,
    aSubB,
    aAddB,
    aMulB,
    aDivB,
} = require("./utils");

async function createPosition(tokensName, userAddress, amounts, borrows, minDebt) {
    bank = await Bank.at(addressJson.Bank);
    await _addLp(0, userAddress, tokensName, amounts, borrows, minDebt)
    return (await bank.currentPos() - 1);
}

async function replenishment(posId, tokensName, userAddress, amounts, borrows, minDebt) {
    await _addLp(posId, userAddress, tokensName, amounts, borrows, minDebt)
}

async function repay(posId, tokensName, userAddress, withdrawRate) {
    await withdraw(posId, tokensName, userAddress, withdrawRate, 3);
}

async function withdraw(posId, tokensName, userAddress, withdrawRate, whichWantBack) {
    bank = await Bank.at(addressJson.Bank);
    let token0Address = name2Address[tokensName[0]];
    let token1Address = name2Address[tokensName[1]];

    let withdrawStrategyAddress = addressJson.MdxStrategyWithdrawMinimizeTrading;

    let strategyDate = web3.eth.abi.encodeParameters(
        ["address", "address", "uint256", "uint256"],
        [token0Address, token1Address, withdrawRate, whichWantBack]);
        
    let data = web3.eth.abi.encodeParameters(
        ["address", "bytes" ],
        [withdrawStrategyAddress, strategyDate]);

    await bank.opPosition(posId, 0, [0, 0], data, {from: userAddress});
}

async function _addLp(posId, userAddress, tokensName, amounts, borrows, minDebt) {
    bank = await Bank.at(addressJson.Bank);
    let token0Address = name2Address[tokensName[0]];
    let token1Address = name2Address[tokensName[1]];

    let bnbValue = 0;
    if (token0Address == bnbAddress) {
        bnbValue = amounts[0];
    } else if (token1Address == bnbAddress) {
        bnbValue = amounts[1];
    }

    let pid = addressJson[`Mdx${tokensName[0]}${tokensName[1]}ProdId`]
    let addStrategyAddress = addressJson.MdxStrategyAddTwoSidesOptimal;

    let strategyDate = web3.eth.abi.encodeParameters(
        ["address", "address", "uint256", "uint256", "uint256"],
        [token0Address, token1Address, amounts[0], amounts[1], minDebt]);

    let data = web3.eth.abi.encodeParameters(
        ["address", "bytes" ],
        [addStrategyAddress, strategyDate]);

    await approve(token0Address, addStrategyAddress, amounts[0], userAddress);
    await approve(token1Address, addStrategyAddress, amounts[1], userAddress);

    console.log(`opPosition, posId: ${posId}, pid: ${pid}`);
    await bank.opPosition(posId, pid, borrows, data, {from: userAddress, value: bnbValue});
}

async function convertWithdrawFormat(beforeStates, withdrawRate, whichWantBack) {
    const tokensAmountInLp = beforeStates.goblin.userInfo.tokensAmountInLp;
    let toUser = [0, 0], toBank = [0, 0];
    const debts = beforeStates.posInfo.debts;

    let ns = [aDivB(aMulB(tokensAmountInLp[0], withdrawRate), 10000),
              aDivB(aMulB(tokensAmountInLp[1], withdrawRate), 10000)];

    // If repay
    if (whichWantBack == 3) {
        let rs = await getR0R1(beforeStates.tokensAddress[0], beforeStates.tokensAddress[1])

        // Swap the token as the depts ratio. return the first token amount after swaping.
        function repayFirstAmount(ds, ns, rs) {
            if (ds[0].isGreaterThan(0) || ds[1].isGreaterThan(0)) {
                return ds[0].multipliedBy(aMulB(rs[1], ns[0]).plus(aMulB(rs[0], ns[1]))).dividedToIntegerBy(
                    aMulB(ds[0], rs[1]).plus(aMulB(ds[1], rs[0])));
            } else {
                return ns[0];
            }
        }

        toBank[0] = repayFirstAmount(debts, ns, rs);
        toBank[1] = repayFirstAmount([debts[1], debts[0]], [ns[1], ns[0]], [rs[1], rs[0]]);

        for (i = 0; i < 2; ++i) {
            if (toBank[i].isGreaterThan(debts[i])) {
                // We can repay all debts

                if (ns[i].isGreaterThan(debts[i])) {
                    // Don't need to swap

                    if (ns[i].isLessThan(toBank[i])) {
                        // But swap to this from another, Then recover.
                        let redundant = aSubB(toBank[i], ns[i]);
                        toUser[i] = aSubB(ns[i], debts[i]);
                        toUser[1-i] = aAddB(toUser[1-i], redundant.multipliedBy(rs[1-i]).dividedToIntegerBy(rs[i]));
                    } else {
                        // Swap some token to another
                        let leftAmount = aSubB(toBank[i], debts[i]);
                        toUser[i] = aAddB(toUser[i], leftAmount);
                    }

                } else {
                    // Need to swap from another token, but swap a lot
                    let redundant = aSubB(toBank[i], debts[i]);
                    toUser[1-i] = aAddB(toUser[1-i], redundant.multipliedBy(rs[1-i]).dividedToIntegerBy(rs[i]));
                    toUser[i] = 0;
                }

                toBank[i] = debts[i];
            } else {
                // All token used to repay, There are no left to user
            }
        }
        console.log(`After repay, to bank: ${fromWei(toBank[0])}, ${fromWei(toBank[1])}, to user: ${
            [fromWei(toUser[0]), fromWei(toUser[1])]}`);
    } else {
        toBank[0] = aDivB(aMulB(debts[0], withdrawRate), 10000);
        toBank[1] = aDivB(aMulB(debts[1], withdrawRate), 10000);

        toUser[0] = aSubB(ns[0], toBank[0]);
        toUser[1] = aSubB(ns[1], toBank[1]);

        console.log(`After withdraw, before swap to target, to bank: ${
            fromWei(toBank[0])}, ${fromWei(toBank[1])}, to user: ${
            [fromWei(toUser[0]), fromWei(toUser[1])]}`);
    }

    if (whichWantBack == 0) {
        toUser[0] = await swapToTarget(beforeStates.tokensAddress, toUser, 0);
        toUser[1] = 0;
    } else if (whichWantBack == 1) {
        toUser[1] = await swapToTarget(beforeStates.tokensAddress, toUser, 1);
        toUser[0] = 0;
    } else {
        // Don't swap
    }

    let depositAmounts = [-toUser[0], -toUser[1]];
    let borrowAmounts = [-toBank[0], -toBank[1]];

    return [depositAmounts, borrowAmounts];
}

// Assuming there is no time elapse
async function checkPosResult(beforeStates, afterStates, depositAmounts, borrowAmounts) {
    const tokens = afterStates.tokensAddress;

    for (i = 0; i < 2; ++i) {
        // Check user balance
        let userIncBalance = aSubB(afterStates.userBalance[i], beforeStates.userBalance[i]);
        if (tokens[i] == addressJson.MdxToken && afterStates.mdxPoolLpAmount.toNumber() == 0) {
            userIncBalance = aSubB(userIncBalance,
                aAddB(beforeStates.goblin.userInfo.earnedMdxStored,
                    aDivB(
                        aMulB(beforeStates.mdxPoolLpAmount,
                            aSubB(afterStates.goblin.userInfo.accMdxPerLpStored,
                                beforeStates.goblin.userInfo.accMdxPerLpStored)
                        ), 1e18
                    )
                )
            );
        }
        equal(userIncBalance, -depositAmounts[i], `User balance[${i}] changes wrong`, false, tokens[i])

        // Check bank balance
        let bankIncBalance = aSubB(afterStates.bankBalance[i], beforeStates.bankBalance[i]);
        equal(bankIncBalance, -borrowAmounts[i], `Bank balance[${i}] changes wrong`, false, tokens[i])

        // Check bank total val
        let bankIncVal = aSubB(afterStates.banksInfo[i].totalVal, beforeStates.banksInfo[i].totalVal);
        equal(bankIncVal, bankIncBalance, `Bank val[${i}] changes wrong`, true, tokens[i])

        // Check bank total debt
        let bankIncDebt = aSubB(afterStates.banksInfo[i].totalDebt, beforeStates.banksInfo[i].totalDebt);
        equal(bankIncDebt, -bankIncBalance, `Bank debt[${i}] changes wrong`, false, tokens[i])

        // Pos debt share
        let userPosIncDebt = aSubB(afterStates.posInfo.debts[i], beforeStates.posInfo.debts[i])
        equal(userPosIncDebt, -bankIncBalance, `Pos debtShare[${i}] changes wrong`, false, tokens[i])
    }

    // Check goblin states
    // - Lp amount
    let IncLpAmount = aSubB(afterStates.goblin.lpAmount, beforeStates.goblin.lpAmount);
    let IncLpTo0Amount = await swapAllLpToToken0(tokens[0], tokens[1], IncLpAmount);
    let targetTo0Amount = await swapToTarget(tokens, [aAddB(depositAmounts[0], borrowAmounts[0]),
                                                    aAddB(depositAmounts[1], borrowAmounts[1])]);

    equal(IncLpTo0Amount, targetTo0Amount, `Lp amount changes wrong`, false);

    // - Principals
    let [r0, r1] = await getR0R1(tokens[0], tokens[1]);
    let targetPrincipal = [0, 0];
    if (beforeStates.goblin.principals[0].toNumber() == 0 &&
        beforeStates.goblin.principals[1].toNumber() == 0) {
        // Create position
        if (aMulB(depositAmounts[0], r1).isGreaterThan(aMulB(depositAmounts[1], r0))) {
            targetPrincipal[0] = await swapToTarget(tokens, depositAmounts, 0);
        } else {
            targetPrincipal[1] = await swapToTarget(tokens, depositAmounts, 1);
        }
    } else {
        if (beforeStates.goblin.principals[0].toNumber() > 0) {
            targetPrincipal[0] = await swapToTarget(tokens, depositAmounts, 0);
        } else {
            targetPrincipal[1] = await swapToTarget(tokens, depositAmounts, 1);
        }
    }

    for (i = 0; i < 2; ++i) {
        let principal = aSubB(afterStates.goblin.principals[i], beforeStates.goblin.principals[i]);
        if (targetPrincipal[i] < 0) {
            // It's a withdraw operation
            if(BigNumber(-targetPrincipal[i]).isGreaterThan(beforeStates.goblin.principals[i]) || 
               afterStates.goblin.lpAmount.toNumber() == 0) 
            {
                targetPrincipal[i] = BigNumber(-beforeStates.goblin.principals[i])
            }
        }

        equal(principal, targetPrincipal[i], `Principal[${i}] amounts changes wrong`, false);
    }


    // Check global totalLp and user totalLp
    let userIncTotalLp = aSubB(afterStates.goblin.globalInfo.totalLp, beforeStates.goblin.globalInfo.totalLp);
    let globalIncTotalLp = aSubB(afterStates.goblin.userInfo.totalLp, beforeStates.goblin.userInfo.totalLp);

    equal(userIncTotalLp, IncLpAmount, `Global LP amounts changes wrong`, true, 1); //1 means not bnb
    equal(globalIncTotalLp, IncLpAmount, `User Lp amount changes wrong`, true, 1); //1 means not bnb

    // Check mdx pool lp amount
    let mdxPoolIncLp = aSubB(afterStates.mdxPoolLpAmount, beforeStates.mdxPoolLpAmount);
    equal(mdxPoolIncLp, IncLpAmount, `Mdx pool amounts changes wrong`, true, 1); //1 means not bnb
}

module.exports = {
    createPosition,
    replenishment,
    repay,
    withdraw,
    convertWithdrawFormat,
    checkPosResult,
}