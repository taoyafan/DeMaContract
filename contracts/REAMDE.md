# Interfaces details

## The whole structure

The most important contract is `Bank.sol`. Users can deposit, withdraw, open position, close position, etc. through the bank interface.

Each production relate to a goblin in contract `MdxGoblin.sol` (We will add an CakeGoblin in future). Users can query informaction of each position here.

There is only one farm in contract `Farm.sol` which used to give the extra DeMa token reward. Users can check DeMa rewards here.

Contract `UserProfile.sol` allow users register and save the users information. 

The other contracts are transparent to user. They are only used in another contract.

## Bank

### Write functions

Noted that in front end we need wrapper the contract write(send) method call into a promise and do different action on different path.
For example, you can found the `_register` function in `/src/features/web3/user/register.js` in front end code repository.

``` javascript
const _register = ({contract, address, dispatch,
    /* contract input: */ utf8name, id, inviterId}) => {

  return new Promise((resolve, reject) => {
    contract.methods.register(utf8name, id, inviterId).send({ from: address }).on('transactionHash', function(hash) {
      console.log(hash)
      dispatch(enqueueSnackbar({
        message: hash,
        options: {
        key: new Date().getTime() + Math.random(),
        variant: 'success'
        },
        hash
      }));
    })
    .on('receipt', function(receipt){
      console.log(receipt);
      resolve()
    })
    .on('error', function(error) {
      console.log(error)
      reject(error)
    })
    .catch((error) => {
      console.log(error)
      reject(error)
    })
  })
}
```

I'm going omit that in following description for convenience but it cannot omit in front end code.

1. Deposit each token to bank

function definition: `deposit(address token, uint256 amount) payable`

javascript calling example:

``` javascript
function BankDeposit(token, amount, accout) {
    // token should be address string
    // amount should be BigNumber
    // account should be address string

    const bank = new web3.eth.Contract(bankAbi, bankAddress);

    let bnbValue = BigNumber(0);
    if (token == '0x0000000000000000000000000000000000000000') {
        // We use this zero address to represent bnb token.
        bnbValue = amount;
    }

    bank.methods.deposit(token, amount).send({from: account, value: bnbValue});
}
```
2. Withdraw each token which has been deposited

function definition: `withdraw(address token, uint256 withdrawShares)`

javascript calling example:

``` javascript
// Need to make sure user has enough shares and there are enough token in bank before calling.
function BankWithdraw(token, shares, account) {
    // token should be address string
    // shares should be BigNumber
    // account should be address string

    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    bank.methods.withdraw(token, share).send({from: account});
}
```

3. Position realted operation

Include create position, replenishment, withdraw, repay(deleted).

function definition: `function opPosition(uint256 posId, uint256 pid, uint256[2] calldata borrow, bytes calldata data) payable`

javascript calling example:

``` javascript
function BankPosCreate(pid, tokens, depositAmount, borrowAmount, minLPAmount, account) {
    // pid is the production id should be number
    // tokens should be array of two address string
    // depositAmount should be array of deposit amount(BigNumber) of [token0, token1]
    // borrowAmount should be array of borrow amount(BigNumber) of [token0, token1]
    // minLPAmount is min lp amount after create position should be BigNumber

    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    
    let bnbValue = BigNumber(0);
    if (tokens[0] == '0x0000000000000000000000000000000000000000') {
        // We use this zero address to represent bnb token.
        bnbValue = depositAmount[0];
    } else if (tokens[1] == '0x0000000000000000000000000000000000000000') {
        bnbValue = depositAmount[1];
    }

    let strategyDate = web3.eth.abi.encodeParameters(
        ["address", "address", "uint256", "uint256", "uint256"],
        [tokens[0], tokens[1], depositAmount[0], depositAmount[0], minLPAmount]);
    let data = web3.eth.abi.encodeParameters(
        ["address", "bytes" ], 
        [addStrategyAddress, strategyDate]);
        
    bank.methods.opPosition(0, pid, borrowAmount, data).send({from: account, value: bnbValue});
}

function BankPosReplenishment(posId, pid, tokens, depositAmount, borrowAmount, minLPAmount, account) {
    // posId is the position id should be number
    // pid is the production id should be number
    // tokens should be array of two address string
    // depositAmount should be array of deposit amount(BigNumber) of [token0, token1]
    // borrowAmount should be array of borrow amount(BigNumber) of [token0, token1]
    // minLPAmount is min lp amount after create position should be BigNumber

    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    
    let bnbValue = BigNumber(0);
    if (tokens[0] == '0x0000000000000000000000000000000000000000') {
        // We use this zero address to represent bnb token.
        bnbValue = depositAmount[0];
    } else if (tokens[1] == '0x0000000000000000000000000000000000000000') {
        bnbValue = depositAmount[1];
    }

    let strategyDate = web3.eth.abi.encodeParameters(
        ["address", "address", "uint256", "uint256", "uint256"],
        [tokens[0], tokens[1], depositAmount[0], depositAmount[0], minLPAmount]);
    let data = web3.eth.abi.encodeParameters(
        ["address", "bytes" ], 
        [addStrategyAddress, strategyDate]);
        
    bank.methods.opPosition(posId, pid, borrowAmount, data).send({from: account, value: bnbValue});
}

function BankPosWithdraw(posId, pid, tokens, withdrawRate, whichWantBack, account) {
    // posId is the position id should be number
    // pid is the production id should be number
    // tokens should be array of two address string
    // withdrawRate will divide by 10000, 5000 means withdraw 50%, 10000 means withdraw all, should less than 10000
    // whichWantBack can be 0(token0), 1(token1), 2(token what surplus).

    const bank = new web3.eth.Contract(bankAbi, bankAddress);

    let strategyDate = web3.eth.abi.encodeParameters(
        ["address", "address", "uint256", "uint256"],
        [tokens[0], tokens[1], withdrawRate, depositAmount[0], minLPAmount]);
    let data = web3.eth.abi.encodeParameters(
        ["address", "bytes" ], 
        [withdrawStrategyAddress, strategyDate]);
        
    bank.methods.opPosition(posId, pid, /*borrow amount:*/ [0, 0], data).send({from: account});
}
```
4. liquidate

function definition: `liquidate(uint256 posId)`

javascript calling example:

``` javascript
// Need to make sure the position's new health is less than liquidateFactor / 10000
function BankLiquidate(posId, account) {
    // posId is position, should be number
    // account should be address string

    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    bank.methods.liquidate(posId).send({from: account});
}
```

5. Get bank DEMA rewards

function definition: `getBankRewards()`, `getBankRewardsPerToken(address token)`

javascript calling example:

``` javascript
function BankGetRewardsPerUser(account) {
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    bank.methods.getBankRewards().send({from: account});
}

function BankGetRewardsPerToken(token, account) {
    // token should be address string, 0x0000000000000000000000000000000000000000 is bnb address.
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    bank.methods.getBankRewardsPerToken().send({from: account});
}
```

6. Get production MDX(Or cake) and DEMA rewards

function definition: `getRewardsAllProd()`, `getRewardsPerProd(uint256 prodId)`

javascript calling example:

``` javascript
function ProdGetRewardsPerUser(account) {
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    bank.methods.getRewardsAllProd().send({from: account});
}

function ProdGetRewardsPerProd(prodId, account) {
    // prodId is production id, should be number, need to check rewards is larger than 0.
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    bank.methods.getRewardsPerProd(prodId).send({from: account});
}
```

### Read functions

1. Get user's bank number

function definition: `userBanksNum(address account) returns (uint256)`

javascript calling example:

``` javascript
async function BankGetUserBanksNum(account) {
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    let banksNum = await bank.methods.userBanksNum(account).call({from: account});
    return banksNum;
}
```

2. Get user's each bank address(Same as deposited token address)

function definition: `userBankAddress(address account, uint256 index) returns (address)`

javascript calling example:

``` javascript
async function BankGetUserBankAddress(index, account) {
    // index is a number from 0 to banksNum-1
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    let bankAddress = await bank.methods.userBankAddress(account, index).call({from: account});
    return bankAddress;
}
```

3. Get user's shares per token in bank

function definition: `userSharesPerTokoen(address account, address token) returns (uint256)`

javascript calling example:

``` javascript
async function BankGetUserSharesPerToken(token, account) {
    // token is address string
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    let shares = await bank.methods.userSharesPerTokoen(account, token).call({from: account});
    return shares;
}
```

4. Get user's DEMA earn per token(bank)

function definition: `earnPertoken(address account, address token) returns (uint256)`

javascript calling example:

``` javascript
async function BankGetUserEarnPerToken(token, account) {
    // token is address string
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    let earn = await bank.methods.earnPertoken(account, token).call({from: account});
    return earn;
}
```

5. Get user's DEMA earn of all tokens

function definition: `earn(address account) returns (uint256)`

javascript calling example:

``` javascript
async function BankGetUserEarn(account) {
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    let earn = await bank.methods.earn(account).call({from: account});
    return earn;
}
```

6. Get total amount in bank for each token, not include reserved

function definition: `totalToken(address token) returns (uint256)`

javascript calling example:

``` javascript
async function BankGetTotalAmount(token, account) {
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    let totalAmount = await bank.methods.totalToken(token).call({from: account});
    return totalAmount;
}
```

7. Get bank info per token

function definition: 

``` javascript
    banks(address token) returns {
        address tokenAddr;
        bool isOpen;
        bool canDeposit;
        uint256 poolId;

        uint256 totalVal;           // Left balance, including reserved
        uint256 totalShares;        // Stake shares
        uint256 totalDebt;          // Debts balance
        uint256 totalDebtShares;    // Debts shares
        uint256 totalReserve;       // Reserved amount.
        uint256 lastInterestTime;
    }
```

javascript calling example:

``` javascript
async function BankGetInfoPerToken(token, account) {
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    let bankInfo = await bank.methods.banks(token).call({from: account});
    return bankInfo;
}
```

8. Get user position num and id.

function definition: 

`userPosNum(address account) returns (uint256)`

`userPosId(address account, uint256 index) returns (uint256)`

javascript calling example:

``` javascript
async function ProdGetUserPosNum(account) {
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    let posNum = await bank.methods.userPosNum(token).call({from: account});
    return posNum;
}

async function ProdGetUserPosId(index, account) {
    // index is a number from 0 to banksNum-1
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    let posId = await bank.methods.userPosId(token, index).call({from: account});
    return posId;
}
```

9. Get user production num and id.

function definition: 

`userPosNum(address account) returns (uint256)`

`userPosId(address account, uint256 index) returns (uint256)`

javascript calling example:

``` javascript
async function ProdGetUserPosNum(account) {
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    let posNum = await bank.methods.userPosNum(token).call({from: account});
    return posNum;
}

async function ProdGetUserPosId(index, account) {
    // index is a number from 0 to banksNum-1
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    let posId = await bank.methods.userPosId(token, index).call({from: account});
    return posId;
}
```

10. Get position information

function definition: 

``` javascript
    positionInfo(uint256 posId) returns (
        uint256,            // production id
        uint256,            // newHealth
        uint256[2] memory,  // health[2]
        uint256[2] memory,  // debts[2]
        address             // owner
    )
```

javascript calling example:

``` javascript
async function ProdGetPositionInfo(posId, account) {
    // posId is position id, is number
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    let [prodId, newHealth, health, debts, owner] = await bank.methods.positionInfo(posId).call({from: account});
    let risk = 0;
    if (debts[0]) {
        risk = debts[0] / health[0];
    } else if (debts[1] {
        risk = debts[1] / health[1];
    })
    return [prodId, newHealth, risk, debts, owner];
}
```

11. Get all position id and new health 

function definition: `allPosIdAndHealth() returns (uint256[] memory, uint256[] memory)`

javascript calling example:

``` javascript
async function ProdGetPositionInfo(account) {
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    let [posId, newHealth] = await bank.methods.allPosIdAndHealth().call({from: account});
    return [posId, newHealth];
}
```

12. Get production information

function definition: 

``` javascript
    positionInfo(uint256 posId) returns {
        address[2] borrowToken;
        bool isOpen;
        bool[2] canBorrow;

        IGoblin goblin;
        uint256[2] minDebt;
        uint256 openFactor;         // When open: (debts / total) should < (openFactor / 10000)
        uint256 liquidateFactor;    // When liquidate: new health should < (liquidateFactor / 10000)
    }
```

javascript calling example:

``` javascript
async function ProdGetProdInfo(prodId, account) {
    // prodId is production id is a number
    // account should be address string
    const bank = new web3.eth.Contract(bankAbi, bankAddress);
    let prodInfo = await bank.methods.productions(prodId).call({from: account});
    return prodInfo;
}
```

## Goblin

Goblin address can be found in bank through getting production information.

### Read functions

1. Get farm pool id

function definition: `poolId() returns (uint256)`

javascript calling example:

``` javascript
async function GoblinGetPoolId(account) {
    // account should be address string
    const goblin = new web3.eth.Contract(goblinAbi, goblinAddress);
    let poolId = await goblin.methods.poolId().call({from: account});
    return poolId;
}
```

2. Get user earned MDX(Cake) amount

function definition: `userEarnedAmount(address account) returns (uint256)`

javascript calling example:

``` javascript
async function GoblinGetUserEarned(account) {
    // account should be address string
    const goblin = new web3.eth.Contract(goblinAbi, goblinAddress);
    let earn = await goblin.methods.userEarnedAmount(account).call({from: account});
    return earn;
}
```

## Farm

Farm pool id for bank can be found in bank info.

Farm pool id for production can be found in each goblin.

### Read functions

