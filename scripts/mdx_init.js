'use strict'

const MdexFactory = artifacts.require("MdexFactory");
const WBNB = artifacts.require("WBNB");
const BUSD = artifacts.require("ERC20Token");
const MdexRouter = artifacts.require("MdexRouter");
const MdexPair = artifacts.require("MdexPair");
const MdxToken = artifacts.require("MdxToken");

function mdxInit(callback) {

    async function fun() {

        let factory = await MdexFactory.deployed();
        let wbnb = await WBNB.deployed();
        let busd = await BUSD.deployed();
        let router = await MdexRouter.deployed();
        let mdx = await MdxToken.deployed();

        await factory.createPair(wbnb.address, busd.address);
        await factory.createPair(mdx.address, busd.address);

        // Get pair
        let lpAddresss = await factory.getPair(wbnb.address, busd.address);
        let wbnb_busd_lp = await MdexPair.at(lpAddresss);
        
        lpAddresss = await factory.getPair(wbnb.address, busd.address);
        let mdx_busd_lp = await MdexPair.at(lpAddresss);

        if(callback) {
            callback();
        }

        return [factory, wbnb, busd, router, wbnb_busd_lp, mdx, mdx_busd_lp];
    };

    return fun();
}

module.exports = mdxInit;