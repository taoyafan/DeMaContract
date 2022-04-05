const {saveToJson, readAddressJson} = require('../js_utils/jsonRW');
const addressJson = readAddressJson('bsctest');

decode()

function decode() {
    let names = addressToName();

    let str = `[0]:  0000000000000000000000000000000000000000000000000000000000000000
    [1]:  0000000000000000000000000000000000000000000000000000000000000001
    [2]:  00000000000000000000000000000000000000000000000000d9256f5ffe5038
    [3]:  0000000000000000000000000000000000000000000000000000000000000000
    [4]:  00000000000000000000000000000000000000000000000000000000000000a0
    [5]:  0000000000000000000000000000000000000000000000000000000000000120
    [6]:  00000000000000000000000020ede055f13cb1175d6215e4adf9134ed2754ab4
    [7]:  0000000000000000000000000000000000000000000000000000000000000040
    [8]:  00000000000000000000000000000000000000000000000000000000000000c0
    [9]:  0000000000000000000000000000000000000000000000000000000000000000
    [10]: 0000000000000000000000002f09a0b05f1e20a7487ec3a4d09656011e91de41
    [11]: 0000000000000000000000000000000000000000000000000000000000000000
    [12]: 00000000000000000000000000000000000000000000032d26d12e980b600000
    [13]: 0000000000000000000000000000000000000000000000000000000000000000
    [14]: 0000000000000000000000000000000000000000000000000000000000000000`

    let start = 6;
    let params = [];

    let i = 0;
    while (start < str.length) {
        params[i] = "0x" + str.slice(start, start + 64);
        // console.log(params[i]);

        start += 64 + 11;
        i += 1;
    }

    let tokenName0 = names['0x' + params[9].slice(26)];
    let tokenName1 = names['0x' + params[10].slice(26)];

    console.log(`Token 0 is ${tokenName0}`)
    console.log(`Token 1 is ${tokenName1}`)

    console.log(`Strategy is ${names['0x' + params[6].slice(26)]}`)

    if (params.length == 13) {
        console.log(`It is withdraw operation`)
        console.log(`Withdraw rate is ${+params[11] / 100} %`)
        
        let withdrawOpt = {0: tokenName0, 1: tokenName1, 2: "Optimal", 3: "Repay"};
        console.log(`Withdraw option is ${withdrawOpt[+params[12]]}`);
    } else {
        console.log(`It is add operation`)
        console.log(`${tokenName0} deposit amount is ${+params[11] / 1e18}`);
        console.log(`${tokenName1} deposit amount is ${+params[12] / 1e18}`);
        console.log(`Min lp amount is ${+params[13]}`);
        console.log(+params[14] ? `Auto swap` : `Not swap`);
    }

    console.log(`Pos id is ${+params[0]}`);
    console.log(`Prod id is ${+params[1]}`);
    console.log(`${tokenName0} borrow amount is ${+params[2] / 1e18}`);
    console.log(`${tokenName1} borrow amount is ${+params[3] / 1e18}`);
}

function addressToName() {
    let names = {};
    addressJson["Bnb"] = "0x0000000000000000000000000000000000000000"
    for (let key in addressJson) {
        let value = addressJson[key];
        
        if (typeof(value)=='string') {
            value = value.toLowerCase();
        }
        
        names[value] = key;
    }
    return names
}