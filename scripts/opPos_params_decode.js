const {saveToJson, readAddressJson} = require('../js_utils/jsonRW');
const addressJson = readAddressJson('bsctest');

decode()

function decode() {
    let names = addressToName();

    let str = `[0]:  0000000000000000000000000000000000000000000000000000000000000003
    [1]:  0000000000000000000000000000000000000000000000000000000000000002
    [2]:  0000000000000000000000000000000000000000000000000000000000000000
    [3]:  0000000000000000000000000000000000000000000000000000000000000000
    [4]:  00000000000000000000000000000000000000000000000000000000000000a0
    [5]:  0000000000000000000000000000000000000000000000000000000000000100
    [6]:  0000000000000000000000007ca7bc9dc1d35ee955e3b5b5bf7116678f7c4284
    [7]:  0000000000000000000000000000000000000000000000000000000000000040
    [8]:  00000000000000000000000000000000000000000000000000000000000000a0
    [9]:  000000000000000000000000d72f36cdfbdf4e79d58985210921c54afc3e098f
    [10]: 000000000000000000000000e4d32d863abd597f26d107ac4764bfa9e91796c9
    [11]: 0000000000000000000000000000000000000000000000000de0b6b3a7640000
    [12]: 0000000000000000000000000000000000000000000000008ac7230489e80000
    [13]: 0000000000000000000000000000000000000000000000000000000000000000`

    let start = 6;
    let params = [];

    let i = 0;
    while (start < str.length) {
        params[i] = "0x" + str.slice(start, start + 64);
        // console.log(params[i]);

        start += 64 + 11;
        i += 1;
    }

    console.log(`Pos id is ${+params[0]}`);
    console.log(`Prod id is ${+params[1]}`);

    let tokenName0 = names['0x' + params[9].slice(26)];
    let tokenName1 = names['0x' + params[10].slice(26)];

    console.log(`Token 0 is ${tokenName0}`)
    console.log(`Token 1 is ${tokenName1}`)
    console.log(`${tokenName0} borrow amount is ${+params[2] / 1e18}`);
    console.log(`${tokenName1} borrow amount is ${+params[3] / 1e18}`);
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
    }
}

function addressToName() {
    let names = {};
    for (let key in addressJson) {
        let value = addressJson[key];
        
        if (typeof(value)=='string') {
            value = value.toLowerCase();
        }
        
        names[value] = key;
    }
    return names
}