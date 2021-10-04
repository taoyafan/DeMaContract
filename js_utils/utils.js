const BigNumber = require("bignumber.js");
BigNumber.config({ EXPONENTIAL_AT: 30 })

const fs = require('fs')
const path = require('path');
const web3 = require('web3');

const MdxGoblin = artifacts.require("MdxGoblin");
const MdexFactory = artifacts.require("MdexFactory");
const WBNB = artifacts.require("WBNB");
const ERC20Token = artifacts.require("ERC20Token");
const MdexRouter = artifacts.require("MdexRouter");
const MdexPair = artifacts.require("MdexPair");
const Bank = artifacts.require("Bank");
const Reinvestment = artifacts.require("Reinvestment");

const bnbAddress = '0x0000000000000000000000000000000000000000'
const MaxUint256 = BigNumber("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

const jsonString = fs.readFileSync("../bin/contracts/address.json")

let {saveToJson, readAddressJson} = require('./jsonRW.js');

let addressJson = null;
let name2Address = null;

function setNetwork(network) {
    addressJson = readAddressJson(network);

    name2Address = {
        'Bnb': bnbAddress,
        'Wbnb': addressJson.WBNB,
        'Usdt': addressJson.USDT,
        'Busd': addressJson.BUSD,
        'Eth': addressJson.ETH,
        'Btc': addressJson.BTC,
        'Mdx': addressJson.MdxToken,
        'Dema': addressJson.DEMA,
    };

    return {addressJson, name2Address}
}

function getConfig() {
    if (!addressJson) {
        throw new Error('Haven\'t set network');
    }

    return {addressJson, name2Address}
}

// Return a BigNumber of balance that has divided decimals
async function erc20TokenGetBalance(tokenAddress, accountAddress) {
    let token = await ERC20Token.at(tokenAddress);
    let balance = BigNumber(await token.balanceOf(accountAddress).call());
    let decimals = await token.decimals().call();

    // divided by decimals
    balance = balance.div(10**decimals)
    return balance;
}

function initFile(file) {
    const fileDir = path.resolve(file, '..');
    
    if(!fs.existsSync(fileDir)) {
        console.log(`Not exist ${fileDir}`);
        fs.mkdirSync(fileDir, {recursive:true});
        console.log(`Make ${fileDir} success!`);
    }

    fs.writeFileSync(file, '',{ flag:'w'});
}

function saveLogToFile(file, name, data = null) {
    fs.appendFileSync(file, name);
    fs.appendFileSync(file, '\n');

    if (data) {
        data = JSON.stringify(data, null, 2);
        fs.appendFileSync(file, data);
        fs.appendFileSync(file, '\n\n\n');
    }
}

async function getStates(posId, userAddress, tokensName) {
    let tokensAddress = [name2Address[tokensName[0]], name2Address[tokensName[1]]];

    let states = {tokensAddress: tokensAddress};

    // user amount
    states.userBalance = [
        await getBalance(tokensAddress[0], userAddress), 
        await getBalance(tokensAddress[1], userAddress),
        await getBalance(addressJson['DEMA'], userAddress),
        await getBalance(addressJson['MdxToken'], userAddress),
    ];

    // bank amount
    let bank = await Bank.at(addressJson.Bank);
    states.bankBalance = [
        await getBalance(tokensAddress[0], bank.address), 
        await getBalance(tokensAddress[1], bank.address),
        await getBalance(addressJson.WBNB, userAddress)
    ];

    async function getBank(tokenAddress) {
        let info = await bank.banks(tokenAddress);
        let infoObj = {
            tokenAddr:          info.tokenAddr,
            isOpen:             Boolean(info.isOpen),
            canDeposit:         Boolean(info.canDeposit),
            poolId:             +info.poolId,
            totalVal:           BigNumber(info.totalVal),
            totalShares:        BigNumber(info.totalShares),        
            totalDebt:          BigNumber(info.totalDebt),          
            totalDebtShares:    BigNumber(info.totalDebtShares),    
            totalReserve:       BigNumber(info.totalReserve), 
            lastInterestTime:   BigNumber(info.lastInterestTime),
        }
        return infoObj
    }
    states.banksInfo = [
        await getBank(tokensAddress[0]),
        await getBank(tokensAddress[1])
    ];

    // position info, ids, health
    if (posId == 0) {
        // no pos
        states.posInfo = {debts: [BigNumber(0), BigNumber(0)]}
    } else {
        // pos.productionId,
        // lp amount,
        // newHealth,
        // health,
        // [debt0, debt1],
        // pos.owner
        let info = await bank.positionInfo(posId);
        states.posInfo = {
            prodId: info[0],
            lpAmount: BigNumber(info[1]),
            newHealth: BigNumber(info[2]),
            health: [BigNumber(info[3][0]), BigNumber(info[3][1])],
            debts: [BigNumber(info[4][0]),BigNumber(info[4][1])],
            owner: info[5]
        }
    }
    states.posInfo.posId = posId;
    let allPosIdAndHealth = await bank.allPosIdAndHealth();
    [states.allPosId, states.allPosHealth] = [allPosIdAndHealth[0], allPosIdAndHealth[1]];
    for (i = 0; i < states.allPosHealth.length; i++) {
        states.allPosHealth[i] = BigNumber(states.allPosHealth[i]);
    }

    // user position and production info
    states.userPosId = await bank.userAllPosId(userAddress);
    states.userProdId = await bank.userAllProdId(userAddress);

    // Goblin info
    let goblinAddress = addressJson[`Mdx${tokensName[0]}${tokensName[1]}Goblin`];
    let goblin = await MdxGoblin.at(goblinAddress);
    {
        states.goblin = {}

        // - goblin global info
        globalInfo = await goblin.globalInfo();
        states.goblin.globalInfo = {
            totalLp: BigNumber(globalInfo.totalLp),
            totalMdx: BigNumber(globalInfo.totalMdx),
            accMdxPerLp: BigNumber(globalInfo.accMdxPerLp),
            lastUpdateTime: BigNumber(globalInfo.lastUpdateTime),
        }

        // - goblin user info
        let userInfo = await goblin.userInfo(userAddress);
        states.goblin.userInfo = {
            totalLp: BigNumber(userInfo.totalLp),
            tokensAmountInLp: await getTokenAmountInLp(tokensAddress, userInfo.totalLp),
            earnedMdxStored: BigNumber(userInfo.earnedMdxStored),
            accMdxPerLpStored: BigNumber(userInfo.accMdxPerLpStored),
            lastUpdateTime: BigNumber(userInfo.lastUpdateTime),
        }

        // states.goblin.tokensAmountInLp = await getTokenAmountInLp(tokensAddress, states.goblin.lpAmount);

        states.goblin.principals = [BigNumber(await goblin.principal(posId, 0)), 
                                    BigNumber(await goblin.principal(posId, 1))];
                                    
    }

    // mdx pool lp amount
    {
        let _tokens = tokensFilter(tokensAddress[0], tokensAddress[1]);
        let factory = await MdexFactory.at(addressJson.MdexFactory);
        let lpAddress = await factory.getPair(_tokens[0], _tokens[1]);
        states.mdxPoolLpAmount = await getBalance(lpAddress, addressJson.BSCPool)
    }

    // Reinvestment info
    {
        states.reinvest = {};
        let reinvestment = await Reinvestment.at(addressJson.Reinvestment);

        // - global info
        let globalInfo = await reinvestment.globalInfo();
        states.reinvest.globalInfo = {
            totalShares: BigNumber(globalInfo.totalShares),
            totalMdx: BigNumber(globalInfo.totalMdx),
            accMdxPerShare: BigNumber(globalInfo.accMdxPerShare),
            lastUpdateTime: BigNumber(globalInfo.lastUpdateTime),
        }; 

        // - user info
        async function getUserInfo(userAddress) {
            let userInfo = await reinvestment.userInfo(userAddress);
            return {
                totalShares: BigNumber(userInfo.totalShares),
                earnedMdxStored: BigNumber(userInfo.earnedMdxStored),
                accMdxPerShareStored: BigNumber(userInfo.accMdxPerShareStored),
                lastUpdateTime: BigNumber(userInfo.lastUpdateTime),
            }; 
        }
        states.reinvest.userInfo = await getUserInfo(goblinAddress)
        states.reinvest.ownerInfo = await getUserInfo(userAddress)

        // - Mdx balance
        states.reinvest.mdxBalance = await getBalance(addressJson.MdxToken, reinvestment.address)
    }

    return states
}

function equal(amount0, amount1, info, strictEqual=true, token=1) {
    amount0 = BigNumber(amount0);
    amount1 = BigNumber(amount1);

    info = info + ` actual: ${fromWei(amount0)}, expect: ${fromWei(amount1)}`;
    
    amount0 = amount0 >= 0 ? amount0 : BigNumber(-amount0);
    amount1 = amount1 >= 0 ? amount1 : BigNumber(-amount1);

    let larger = amount0.isGreaterThan(amount1) ? amount0 : amount1
    let smaller =  amount0.isGreaterThan(amount1) ? amount1 : amount0

    if (strictEqual) {
        if (token == bnbAddress || token == addressJson.WBNB) {
            assert.equal(larger.minus(smaller)
                .dividedToIntegerBy(1e17).toNumber(), 0, info)
        } else {
            assert.equal(amount0.toString(), amount1.toString(), info)
        }
    } else {
        let delta = larger.minus(smaller)
        if (token == bnbAddress || token == addressJson.WBNB) {
            assert(delta.isLessThanOrEqualTo(larger.multipliedBy(7)
                .dividedToIntegerBy(1000).plus(1e17)), info)
        } else {
            assert(delta.isLessThanOrEqualTo(larger.multipliedBy(7)
                .dividedToIntegerBy(1000)), info)
        }
    }
}

async function swapAllLpToToken0(token0, token1, lpAmount) {
    [token0, token1] = tokensFilter(token0, token1);
    let _r0, _r1
    [_r0, _r1] = await getR0R1(token0, token1)

    // Get the value of incLp
    let factory = await MdexFactory.at(addressJson.MdexFactory);
    let lpAddress = await factory.getPair(token0, token1);
    let lp = await MdexPair.at(lpAddress)
    let totalLp = await lp.totalSupply();

    let token0AmountInLp = BigNumber(_r0).multipliedBy(lpAmount).dividedToIntegerBy(totalLp)
    let token1AmountInLp = BigNumber(_r1).multipliedBy(lpAmount).dividedToIntegerBy(totalLp)
    
    let to0Amount = _swapAllToA(token0AmountInLp, token1AmountInLp, _r0, _r1);

    return to0Amount
}

async function transfer(tokenAddress, to, amount, from) {
    if (amount < 0) {
        return
    }

    if (tokenAddress == bnbAddress) {
        await web3.eth.sendTransaction({from: from, to: to, value: amount})
    } else {
        let token = await ERC20Token.at(tokenAddress);
        await token.transfer(to, amount, {from: from});
    }
}

async function approve(tokenAddress, to, amount, from) {
    if (tokenAddress == bnbAddress)
        return

    let token = await ERC20Token.at(tokenAddress);

    let allowance = await token.allowance(from, to);
    if (allowance < amount) {
        await token.approve(to, amount, {from: from});
    }
}

async function getBalance(tokenAddress, account) {
    if (tokenAddress == bnbAddress) {
        return BigNumber(await web3.eth.getBalance(account))
    } else {
        let token = await ERC20Token.at(tokenAddress);
        return BigNumber(await token.balanceOf(account));
    }
}

async function swapExactTo(tokens, fromIdx, fromAmount, from) {
    let wbnb = await WBNB.at(addressJson.WBNB);
    if (tokens[fromIdx] == bnbAddress) {
        tokens[fromIdx] = addressJson.WBNB;
        await wbnb.deposit({from: from, value: fromAmount});
    } else if (tokens[1-fromIdx] == bnbAddress) {
        tokens[1-fromIdx] = addressJson.WBNB;
    }

    let router = await MdexRouter.at(addressJson.MdexRouter);
    await approve(tokens[fromIdx], router.address, 0, from);
    await approve(tokens[fromIdx], router.address, MaxUint256, from);

    console.log(`Swap ${fromWei(fromAmount)} token ${fromIdx} to token ${1-fromIdx}`);
    await router.swapExactTokensForTokens(fromAmount, 0, [tokens[fromIdx], tokens[1-fromIdx]], from, MaxUint256);

    if (tokens[1-fromIdx] == addressJson.WBNB) {
        let wbnbAmount = await wbnb.balanceOf(from)
        if (wbnbAmount > 0) {
            await wbnb.withdraw(wbnbAmount, {from: from});
        }
    }
}

async function swapToExact(tokens, fromIdx, toAmount, from) {
    let wbnb = await WBNB.at(addressJson.WBNB);
    let router = await MdexRouter.at(addressJson.MdexRouter);

    if (tokens[fromIdx] == bnbAddress) {
        tokens[fromIdx] = addressJson.WBNB;
        amounts = await router.getAmountsIn(toAmount, [tokens[fromIdx], tokens[1-fromIdx]]);
        await wbnb.deposit({from: from, value: amounts[0]});
    } else if (tokens[1-fromIdx] == bnbAddress) {
        tokens[1-fromIdx] = addressJson.WBNB;
    }

    await approve(tokens[fromIdx], router.address, 0, from)
    await approve(tokens[fromIdx], router.address, MaxUint256, from)

    console.log(`Swap token ${fromIdx} to ${fromWei(toAmount)} token ${1-fromIdx}`);
    await router.swapTokensForExactTokens(toAmount, MaxUint256, [tokens[fromIdx], tokens[1-fromIdx]], from, MaxUint256);

    let wbnbAmount = await wbnb.balanceOf(from);
    if (wbnbAmount > 0) {
        await wbnb.withdraw(wbnbAmount, {from: from});
    }
}

// Input token address
async function addLiquidate(token0, token1, r0, r1, from) {
    let wbnb = await WBNB.at(addressJson.WBNB);
    if (token0 == bnbAddress) {
        token0 = addressJson.WBNB
        await wbnb.deposit({from: from, value: r0})
    } else if (token1 == bnbAddress) {
        token1 = addressJson.WBNB
        await wbnb.deposit({from: from, value: r1})
    }

    let router = await MdexRouter.at(addressJson.MdexRouter);
    await approve(token0, router.address, r0, from)
    await approve(token1, router.address, r1, from)

    let factory = await MdexFactory.at(addressJson.MdexFactory);
    let lpAddress = await factory.getPair(token0, token1);
    let lp = await MdexPair.at(lpAddress)
    await transfer(token0, lpAddress, r0, from)
    await transfer(token1, lpAddress, r1, from)
    await lp.mint(from)

    console.log(`After init add liquidity:`)
    await getR0R1(token0, token1, true);
}

async function removeAllLiquidity(token0, token1, from) {
    [token0, token1] = tokensFilter(token0, token1);
    let factory = await MdexFactory.at(addressJson.MdexFactory);

    let lpAddress = await factory.getPair(token0, token1);
    let lpAmount = await getBalance(lpAddress, from);

    let router = await MdexRouter.at(addressJson.MdexRouter);
    await approve(lpAddress, router.address, lpAmount, from)
    await router.removeLiquidity(token0, token1,
        lpAmount, 0, 0, from, MaxUint256, {from: from});

    console.log(`After remove all liquidity:`)
    await getR0R1(token0, token1, true);

    let wbnb = await WBNB.at(addressJson.WBNB);
    let wbnbAmount = await wbnb.balanceOf(from)
    if (wbnbAmount > 0) {
        await wbnb.withdraw(wbnbAmount, {from: from});
    }
}

// which = 2 means swap to larger, 3 means to smaller
async function swapToTarget(tokens, amounts, which=0) {
    let r0, r1
    [r0, r1] = await getR0R1(tokens[0], tokens[1])
    
    let swapAllToOne = [
        _swapAllToA(amounts[0], amounts[1], r0, r1),
        _swapAllToA(amounts[1], amounts[0], r1, r0)
    ]

    if (which == 0) {
        return swapAllToOne[0];
    } else if (which == 1) {
        return swapAllToOne[1];
    } else {
        let larger = aMulB(amounts[0], r1) > aMulB(amounts[1], r0) ? 0 : 1;   
        let target = (which - 2) ^ larger;
        return [target, swapAllToOne[target]];
    }
}

function _swapAllToA(na, nb, ra, rb) {
    let deltaA = aMulB(nb, 0.997).multipliedBy(ra).dividedToIntegerBy(rb)
    return aAddB(na, deltaA)
}

// Input token address
async function getR0R1(token0, token1, log = false) {
    [token0, token1] = tokensFilter(token0, token1);

    let factory = await MdexFactory.at(addressJson.MdexFactory);
    let lpAddress = await factory.getPair(token0, token1);
    let lp = await MdexPair.at(lpAddress)

    let token0InLp = await lp.token0()
    res = await lp.getReserves();
    let _r0, _r1
    if (token0 == token0InLp ||
        (token0 == bnbAddress && token0InLp == addressJson.WBNB))
    {
        [_r0, _r1] = [res[0], res[1]]
    } else {
        [_r0, _r1] = [res[1], res[0]]
    }
    if (log) {
        console.log(`r0 is: ${fromWei(_r0)}, r1 is: ${fromWei(_r1)}`);
    }
    return [BigNumber(_r0), BigNumber(_r1)];
}

async function getTokenAmountInLp(tokens, lpAmount) {
    let [token0, token1] = tokensFilter(tokens[0], tokens[1]);
    let [_r0, _r1] = await getR0R1(token0, token1)

    // Get the value of incLp
    let factory = await MdexFactory.at(addressJson.MdexFactory);
    let lpAddress = await factory.getPair(token0, token1);
    let lp = await MdexPair.at(lpAddress)
    let totalLp = await lp.totalSupply();

    let token0AmountInLp = BigNumber(_r0).multipliedBy(lpAmount).dividedToIntegerBy(totalLp)
    let token1AmountInLp = BigNumber(_r1).multipliedBy(lpAmount).dividedToIntegerBy(totalLp)

    return [token0AmountInLp, token1AmountInLp]
}

function toWei(ether) {
    return BigNumber(web3.utils.toWei(BigNumber(ether).toString()))
}

function fromWei(wei) {
    return BigNumber(web3.utils.fromWei(BigNumber(wei).toString()))
}

function toNum(v) {
    return BigNumber(v).toNumber();
}

function aSubB(a, b) {
    return BigNumber(a).minus(BigNumber(b));
}

function aAddB(a, b) {
    return BigNumber(a).plus(BigNumber(b))
}

function aMulB(a, b) {
    return BigNumber(a).multipliedBy(BigNumber(b))
}

function aDivB(a, b, fix=true) {
    if (fix) {
        return BigNumber(a).dividedToIntegerBy(BigNumber(b))
    } else {
        return BigNumber(a).dividedBy(BigNumber(b))
    }
}

function tokensFilter(token0, token1) {
    if (token0 == bnbAddress) {
        token0 = addressJson.WBNB
    } else if (token1 == bnbAddress) {
        token1 = addressJson.WBNB
    }
    return [token0, token1]
}

function logObj(obj, name) {
    console.log(` ------------------ ${name}: ------------------ `)
    console.log(JSON.stringify(obj, null, 2))
}

module.exports = {
    bnbAddress,
    MaxUint256,
    setNetwork,
    getConfig,
    erc20TokenGetBalance,
    saveLogToFile,
    initFile,
    getStates,
    equal,
    swapAllLpToToken0,
    transfer,
    approve,
    getBalance,
    swapExactTo,
    swapToExact,
    addLiquidate,
    removeAllLiquidity,
    swapToTarget,
    getR0R1,
    getTokenAmountInLp,
    toWei,
    fromWei,
    toNum,
    aSubB,
    aAddB,
    aMulB,
    aDivB,
    tokensFilter,
    logObj,
}
