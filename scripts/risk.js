function _swapAToBWithDebtsRatio(ra, rb, da, db, na, nb) {
    if (da == 0) {
        return na;
    }

    let part1 = na - nb * da / db;
    let part2 = ra * 1000 / 997;
    let part3 = da * rb / db;

    let b = part2 + part3 - part1;
    let nc = part1 * part2;

    // (-b + math.sqrt(b * b + 4 * nc)) / 2
    // Note that nc = - c
    return (Math.sqrt(b * b + nc * 4) - b) / 2;
}

function getMktSellAmount(aIn, rIn, rOut) {
    if (aIn == 0) return 0;

    let aInWithFee = aIn * 997;
    let numerator = aInWithFee * rOut;
    let denominator = rIn * 1000 + aInWithFee;
    return numerator / denominator;
}

// ds 为两种币的债务
// ns 为新投入的两种币的数量与原有数量的总和
// rs 为 lp getReserved 查询到的两种币的总量
// 注意币种的顺序应一致。
function risk(ds, ns, rs) {

    if (ns[0] * ds[1] > ns[1] * ds[0]) {
        let amount = _swapAToBWithDebtsRatio(rs[0], rs[1], ds[0], ds[1], ns[0], ns[1]);
        amount = amount > ns[0] ? ns[0] : amount;
        ns[0] = ns[0] - (amount);
        ns[1] = ns[1] + getMktSellAmount(amount, rs[0], rs[1]);
    }
    
    // ns[0]/ds[0] < ns[1]/ds[1], swap B to A
    else if (ns[0] * ds[1] < ns[1] * ds[0]) {
        let amount = _swapAToBWithDebtsRatio(rs[1], rs[0], ds[1], ds[0], ns[1], ns[0]);
        amount = amount > ns[1] ? ns[1] : amount;
        ns[0] = ns[0] + getMktSellAmount(amount, rs[1], rs[0]);
        ns[1] = ns[1] - (amount);
    }

    console.log(ns)

    let risk
    if (ns[0]) {
        risk = ds[0] / ns[0]
    } else {
        risk = ds[1] / ns[1]
    }

    return risk
}

function test() {
    let rs = [1000e18, 500000e18];    // 500 U
    let ns = [0, 1500e18];
    let ds = [1e18, 500e18];

    let _risk = risk(ds, ns, rs);

    console.log(_risk);
}

test()