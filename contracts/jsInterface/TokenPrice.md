Get token price and lp price.

abi can be obtained from /bin/contracts.

addressJson can be obtained from /bin/contracts/address[BscMain/BscTest/Matic].json

JS sample:

``` javascript
async function getPrice(tokenAddr, USDTAddr) {
    if (tokenAddr == bnbAddress) {
        tokenAddr = addressJson.WBNB;
    }
    
    const mdexFactoryAbi = getAbi(`MdexFactory`);
    const mdexPairAbi = getAbi(`MdexPair`);

    const factory = new web3.eth.Contract(mdexFactoryAbi, addressJson.MdexFactory);
    const lpAddr = await factory.methods.getPair(tokenAddr, USDTAddr).call();
    assert(lpAddr != bnbAddress); // Lp must exist

    const lp = new web3.eth.Contract(mdexPairAbi, lpAddr);
    const token0 = await lp.methods.token0().call();

    const rs = await lp.methods.getReserves().call();
    let rToken = BigNumber(rs[0]);
    let rUSDT = BigNumber(rs[1]);

    if (token0 == USDTAddr) {
        [rToken, rUSDT] = [rUSDT, rToken];
    }
    const tokenPrice = rUSDT.dividedBy(rToken);

    // Calculate lp price:
    const lpAmounts = await lp.methods.totalSupply().call();
    const lpPrice = rUSDT.multipliedBy(2).dividedBy(lpAmounts);

    return [tokenPrice, lpPrice]
}
```