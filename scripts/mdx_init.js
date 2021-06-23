'use strict'


function mdxInit(callback) {

    async function fun() {


        if(callback) {
            callback();
        }

        return [];
    };

    return fun();
}

module.exports = mdxInit;