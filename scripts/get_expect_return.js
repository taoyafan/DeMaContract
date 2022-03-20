// Sell in amount
function getMktSellInAmount(aOut, rIn, rOut) {
    if (aOut == 0) return 0;

    let numerator = rIn * aOut * 1000;
    let denominator = (rOut - aOut) * 997;
    return numerator / denominator;
}

// Sell out amount
function getMktSellAmount(aIn, rIn, rOut) {
    if (aIn == 0) return 0;

    let aInWithFee = aIn * 997;
    let numerator = aInWithFee * rOut;
    let denominator = rIn * 1000 + aInWithFee;
    return numerator / denominator;
}

// ns 为仓位中两种币的数量
// ds 为两种币的债务
// rs 为 lp getReserved 查询到的两种币的总量
// rate 为赎回比例，1为最大值，赎回100%
// whichWantBack 为赎回方式：
//      0: 还贷后全部转换为 Token0
//      1: 还贷后全部转换为 Token1
//      2: 还贷后不再转换
function expectReturn(ns, ds, rs, rate, whichWantBack) {
    let leftDebts = [ds[0] * (1 - rate), ds[1] * (1 - rate)]
    let leftAmount = [ns[0] * (1 - rate), ns[1] * (1 - rate)]
  
    let repayAmount = [ds[0] * rate, ds[1] * rate]
    ns = [ns[0] * rate, ns[1] * rate]
    rs = [rs[0] - ns[0], rs[1] - ns[1]]
  
    let dr = [0, 0]
  
    // 1. 计算还贷后的剩余数量
    // {
    if (ns[0] >= repayAmount[0] && ns[1] >= repayAmount[1]) {
  
      // 无需交易，直接还贷
      ns[0] -= repayAmount[0]
      ns[1] -= repayAmount[1]
  
    } else if (ns[0] >= repayAmount[0] && getMktSellAmount(ns[0] - repayAmount[0], rs[0], rs[1]) > (repayAmount[1] - ns[1])) {
  
      // 无法直接还贷，将多余的 Token0 转换为 Token1 足以还贷
      dr = [getMktSellInAmount(repayAmount[1] - ns[1], rs[0], rs[1]), -(repayAmount[1] - ns[1])]
      ns[0] -= repayAmount[0] + getMktSellInAmount(repayAmount[1] - ns[1], rs[0], rs[1])
      ns[1] = 0
  
  
    } else if (ns[1] >= repayAmount[1] && getMktSellAmount(ns[1] - repayAmount[1], rs[1], rs[0]) > (repayAmount[0] - ns[0])) {
  
      // 无法直接还贷，将多余的 Token1 转换为 Token0 足以还贷
      dr = [-(repayAmount[0] - ns[0]), getMktSellInAmount(repayAmount[0] - ns[0], rs[1], rs[0])]
      ns[1] -= repayAmount[1] + getMktSellInAmount(repayAmount[0] - ns[0], rs[1], rs[0])
      ns[0] = 0
  
    } else {
  
      // 资金不足以还贷，无剩余本金
      ns[0] = 0
      ns[1] = 0
    }
    // }
  
    rs = [rs[0] + dr[0], rs[1] + dr[1]]
    // console.log(`Surplus amounts after repay is ${ns}`)
  
    // 2. 按照用户要求的返回方式进行交易
    if (whichWantBack === 0 && ns[1] > 0) {
      ns[0] += getMktSellAmount(ns[1], rs[1], rs[0])
      ns[1] = 0
  
    } else if (whichWantBack === 1 && ns[0] > 0) {
      ns[1] += getMktSellAmount(ns[0], rs[0], rs[1])
      ns[0] = 0
  
    } else {
      // 不再交易
    }
  
    console.log(`Return amount is ${ns}`)
    console.log(`Left amount is ${leftAmount}`)
    console.log(`Left debts is ${leftDebts}`)
  
    return ns
}

// 对于显示内容，精度要求不高，可以不用 BN 或 BigNumber
function test() {
    let rs = [100, 50000];    // 500U
    let ns = [1, 500];
    let ds = [1.25, 300];
    let rate = 0.5;
    let whichWantBack = 0;

    expectReturn(ns, ds, rs, rate, whichWantBack)
}

test();