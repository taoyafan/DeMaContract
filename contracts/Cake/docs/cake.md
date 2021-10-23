# cake

## constants
## pancake bsc official address
```
官方账户:0xDb6F5FB9311aE8885620Ee893887C3D85C8293d6
```

### main net
```
PancakeFactory: 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73
PancakeRouter: 0x10ED43C718714eb63d5aA57B78B54704E256024E
SyrupBar: 0x009cF7bC57584b7998236eff51b98A168DceA9B0
MasterChef: 0x73feaa1eE314F8c655E354234017bE2193C9E24E
WBNB: 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
CakeToken: 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82
WETH: 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
BUSD: 0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56
Cake-LP: token0:CakeToken token1: BUSD 
```

### test net
[test Dapp](https://pancake.kiemtienonline360.com/#/swap)
[github issue](https://github.com/pancakeswap/pancake-swap-interface-v1/issues/365)
[Pancakeswap GnosisSafe Transactions](https://app.unrekt.net/timelock/pancakeswap-gnosis2.html)
```
PancakeFactory: 0xfeef08e0486ed6ce2c4d3f8547d951b77851bb58 
PancakeRouter: 0x67A637E7bb250eb33BDf4407a51B58e8b479B498

DEMA: 0x5f3dfD911324C5478fA240c2E27B424F434b025E
UserProfile: 0x290c478Dd5058e2258eb95c46ddB6327C8482377
Farm: 0xD31f28C7C072F08bFB6625D9aE1503Be17d7D22a
Bank: 0x48423e2c3D80c2a4a0818C7d9f0437651fF256AF
```

### contracts address 
mainnet: chainid 56
testnet: chainid 97
```js
export default {
  masterChef: {
    97: '0x1d32c2945C8FDCBc7156c553B7cEa4325a17f4f9',
    56: '0x73feaa1eE314F8c655E354234017bE2193C9E24E',
  },
  sousChef: {
    97: '0xd3af5fe61dbaf8f73149bfcfa9fb653ff096029a',
    56: '0x6ab8463a4185b80905e05a9ff80a2d6b714b9e95',
  },
  lotteryV2: {
    97: '0x5790c3534F30437641541a0FA04C992799602998',
    56: '0x5aF6D33DE2ccEC94efb1bDF8f92Bd58085432d2c',
  },
  multiCall: {
    56: '0xfF6FD90A470Aaa0c1B8A54681746b07AcdFedc9B',
    97: '0x8F3273Fb89B075b1645095ABaC6ed17B2d4Bc576',
  },
  pancakeProfile: {
    56: '0xDf4dBf6536201370F95e06A0F8a7a70fE40E388a',
    97: '0x4B683C7E13B6d5D7fd1FeA9530F451954c1A7c8A',
  },
  pancakeRabbits: {
    56: '0xDf7952B35f24aCF7fC0487D01c8d5690a60DBa07',
    97: '0x60935F36e4631F73f0f407e68642144e07aC7f5E',
  },
  bunnyFactory: {
    56: '0xfa249Caa1D16f75fa159F7DFBAc0cC5EaB48CeFf',
    97: '0x707CBF373175fdB601D34eeBF2Cf665d08f01148',
  },
  claimRefund: {
    56: '0xE7e53A7e9E3Cf6b840f167eF69519175c497e149',
    97: '',
  },
  pointCenterIfo: {
    56: '0x3C6919b132462C1FEc572c6300E83191f4F0012a',
    97: '0xd2Ac1B1728Bb1C11ae02AB6e75B76Ae41A2997e3',
  },
  bunnySpecial: {
    56: '0xFee8A195570a18461146F401d6033f5ab3380849',
    97: '0x7b7b1583De1DeB32Ce6605F6deEbF24A0671c17C',
  },
  tradingCompetition: {
    56: '0xd718baa0B1F4f70dcC8458154042120FFE0DEFFA',
    97: '0xC787F45B833721ED3aC46E99b703B3E1E01abb97',
  },
  easterNft: {
    56: '0x23c41D28A239dDCAABd1bb1deF8d057189510066',
    97: '0x24ec6962dbe874F6B67B5C50857565667fA0854F',
  },
  cakeVault: {
    56: '0xa80240Eb5d7E05d3F250cF000eEc0891d00b51CC',
    97: '',
  },
  predictions: {
    56: '0x516ffd7D1e0Ca40b1879935B2De87cb20Fc1124b',
    97: '0x4f3140C74789F1D809420343ea83BcE52B7bbAA5',
  },
  chainlinkOracle: {
    56: '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE',
    97: '',
  },
  bunnySpecialCakeVault: {
    56: '0x5B4a770Abe7Eafb2601CA4dF9d73EA99363E60a4',
    97: '',
  },
  bunnySpecialPrediction: {
    56: '0x342c99e9aC24157657095eC69CB04b73257e7A9C',
    97: '',
  },
  farmAuction: {
    56: '0xb92Ab7c1edcb273AbA24b0656cEb3681654805D2',
    97: '0x3F9602593b4f7C67ab045DB51BbDEa94E40fA9Fe',
  },
}
```

## 合约说明
UserProfile.sol --- 用户资料
PlgUserIntroduction.sol --- 用户资料扩展
Bank.sol ---  用户资金管理
BankConfig.sol --- 用户资金管理配置
CakeStrategyAddTwoSidesOptimal.sol ---  交易策略
CakeStrategyWithdrawMinimizeTrading.sol --- 交易策略
CakeGoblin.sol ---  交易策略主要执行合约 需要配置userprofile bank strategy 