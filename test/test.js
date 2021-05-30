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