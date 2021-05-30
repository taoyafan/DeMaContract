const fs = require('fs')

function saveToJson(name, date) {
    const file = "bin/contracts/address.json"
    let json;

    try {
        const jsonString = fs.readFileSync(file)
        json = JSON.parse(jsonString)
    } catch(err) {
        console.log(err)
        json = {}
    }

    json[name] = date;

    const jsonString = JSON.stringify(json, null, 2)
    fs.writeFileSync(file, jsonString)
}

module.exports = saveToJson;