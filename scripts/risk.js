
function health0(ds, ns, rs) {
    if (ds[0] > (0) || ds[1] > (0)) {
        return (ds[0] * rs[1] * ns[0] + rs[0] * ns[1]) / (
            ds[0] * rs[1] + ds[1] * rs[0]);
    } else {
        return ns[0];
    }
}

// ds 为两种币的债务
// ns 为新投入的两种币的数量
// rs 为 lp getReserved 查询到的两种币的总量
// health 为当前仓位查询到的 health
function risk(ds, ns, rs, health) {
    let healthAdd = [
        health0(ds, ns, rs),
        health0([ds[1], ds[0]], [ns[1], ns[0]], [rs[1], rs[0]]),
    ]

    let healthTotal = [
        health[0] + healthAdd[0],
        health[1] + healthAdd[1],
    ]

    let risk
    if (healthTotal[0]) {
        risk = ds[0] / healthTotal[0]
    } else {
        risk = ds[1] / healthTotal[1]
    }

    return risk
}