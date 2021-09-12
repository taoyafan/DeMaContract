const fs = require('fs')

function getAbi(name) {
    jsonString = fs.readFileSync(`bin/contracts/${name}.abi`, 'utf8')
    try {
        const abi = JSON.parse(jsonString)
        return abi;
    } catch(err) {
        console.log('Error parsing JSON string:', err)
    }
}

module.exports = getAbi;