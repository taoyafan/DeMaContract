const fs = require('fs')
const path = require('path');

function _getFile(network) {
    if (network == 'development') {
        fileName = 'address.json'
    } else if (network == 'matic') {
        fileName = 'addressMatic.json'
    } else if (network == 'bsctest') {
        fileName = 'addressBscTest.json'
    } else if (network == 'bscmain') {
        fileName = 'addressBscMain.json'
    } else {
        throw new Error('Network not support');
    }

    const uplevelDir = path.resolve(__dirname, '..');
    const file = path.join(uplevelDir, `bin/contracts/${fileName}`);

    return file
}

function saveToJson(name, date, network='development') {
    let json;

    const file = _getFile(network);
    const fileDir = path.resolve(file, '..');
    
    if(!fs.existsSync(fileDir)) {
        console.log(`Not exist ${fileDir}`);
        fs.mkdirSync(fileDir, {recursive:true});
        console.log(`Make ${fileDir} success!`);
    }

    try {
        const jsonStringFromRead = fs.readFileSync(file);
        json = JSON.parse(jsonStringFromRead);
    } catch(err) {
        console.log(err)
        json = {}
    }

    json[name] = date;

    const jsonStringToWrite = JSON.stringify(json, null, 2);
    fs.writeFileSync(file, jsonStringToWrite,{ flag:'w'});
}

function readAddressJson(network) {
    const jsonString = fs.readFileSync(_getFile(network))
    const addressJson = JSON.parse(jsonString)
    return addressJson
}

module.exports = {
    saveToJson,
    readAddressJson
};