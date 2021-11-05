/* ****************************************************************
 * test/config.js is left out for security reasons.  It should be in the form
 * where REDACTED is replaced by you AWS keys
module.exports={
  s3: {
      accessKeyId: 'REDACTED',
      secretAccessKey: 'REDACTED'
  }
}
**************************************************************** */
const lookup=require('../index');
let configMissing=false;
let config= {
    s3: {
        accessKeyId: 'REDACTED',
        secretAccessKey: 'REDACTED'
    }
}
try {
    config=require('./config');
    lookup.initS3(config.s3);
} catch (e) {
    //config missing
    configMissing=true;
}

const expect    = require("chai").expect;


describe("getExchangeRate", function() {
    this.timeout(20000);
    it("checks we can get the exchange rate at a specific height", async function() {
        let a=await lookup.getExchangeRate({
            address: "dgb1qunxh378eltj2jrwza5sj9grvu5xud43vqvudwh",
            index:   0,
            name:    "CAD"
        },12648500);
        expect(a).to.equal(1203718348.00104);
    });
});

describe("getRules", function() {
    this.timeout(20000);
    it("checks we can get the exchange rate at a specific height", async function() {
        let a=await lookup.getRules("La5fMQh1m8tbaBNDmyvh8Ug3f2Bd85nVbcrDvb");
        expect(a[0].rewritable).to.equal(false);
        expect(a[0].royalties["DSXnZTQABeBrJEU5b2vpnysoGiiZwjKKDY"]).to.equal(500000000n);
        expect(a[0].effective).to.equal(12626881);
    });
});

describe("getAsset",function () {
    this.timeout(20000);
    it("check invalid assetId format throws error", async function() {
        try {
            let a = await lookup.getAsset("La5fMQh1m8tbaBNDmyvh8Ug3f2Bd85nVbcrDv");
            expect(true).to.equal(false);   //line should not run
        } catch (e) {
            expect(e.toString()).to.equal("Invalid Asset Id");
        }
    });
    it("check retrieves existing asset", async function() {
        let a = await lookup.getAsset("La5fMQh1m8tbaBNDmyvh8Ug3f2Bd85nVbcrDvb");
        expect(a.issuer).to.equal("SMMyDUnFBnkuAbYDYBBekuRhQMD343xuCP");
    });
    it("check non existent assets throw error", async function() {
        try {
            let a = await lookup.getAsset("La5fMQh1m8tbaBNDmyvh8Ug3f2Bd85nVbcrDvc");
            expect(true).to.equal(false);   //line should not run
        } catch (e) {
            expect(e.toString()).to.equal("Asset Does Not Exist: La5fMQh1m8tbaBNDmyvh8Ug3f2Bd85nVbcrDvc");
        }
    });

});

describe("getHeight", function() {
    this.timeout(20000);
    it("checks we can get the exchange rate at a specific height", async function() {
        let a=await lookup.getHeight();
        expect(a).to.greaterThan(0);
    });
});

/*
//test passes but will cause all others to fail so commented out
describe("custom lookup",function () {
    this.timeout(20000);
    lookup.initS3((Key)=>{
        return {fake:"test results come from function"};
    });
    it("check custom function is used", async function() {
        let a = await lookup.getAddress("La5fMQh1m8tbaBNDmyvh8Ug3f2Bd85nVbcrDv");
        expect(a.fake).to.equal("test results come from function");
    });
});
 */