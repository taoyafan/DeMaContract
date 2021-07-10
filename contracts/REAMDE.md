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

### Read functions