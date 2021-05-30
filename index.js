require('digiassetx-digibyte-stream-types');
const priceDecoder=require('digibyte-price-decoder');

const AWS=require('aws-sdk');
const IPFS=require('ipfs-simple');
const Bucket="chaindata-digibyte";
let s3;
const overlap=240;






/**
 * Converts a stream to a string
 * @param stream
 * @return {Promise<string>}
 */
const streamToString=async (stream)=>{
    //console.log("file_35");
    return new Promise((resolve,reject) => {
        const chunks = [];
        stream.on('error', (error)=>reject(error));
        stream.on("data", chunk => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks).toString()));
    });
}













/**
 * Initializes S3 connection
 * @param {{
 *    accessKeyId:     string,
 *    secretAccessKey: string
 * }} config
 */
module.exports.initS3=(config)=>{
    s3 = new AWS.S3(config);
}


/**
 * IPFS desktop interface by default uses:
 *      http://127.0.0.1:5001/api/v0/
 *
 * no need to run unless needs to change
 * @param {string} config
 */
module.exports.initIPFS=(config)=>{
    IPFS.path=config;
}


/**
 * Gets the users KYC state.
 * Returns undefined if no KYC, error if no address
 * @param {string}  address
 * @return {Promise<KycState>}
 */
module.exports.getKYC=async(address)=>{
    if (s3===undefined) throw "Loader not initialize";
    try {
        //load from s3
        let stream = (await s3.getObject({Bucket,Key:address})).createReadStream();
        return (JSON.parse(await streamToString(stream))).kyc;
    } catch (e) {
        throw "Address Does Not Exist: "+address;
    }
}

/**
 * Gets the assets rules.  Returns undefined if no rules error if asset doesn't exist
 * @param {String}  assetId
 * @param {int}     height
 * @return {Promise<AssetRules[]>}
 */
module.exports.getRules=async(assetId,height=0)=>{
    if (s3===undefined) throw "Loader not initialize";
    try {
        //load from s3
        let stream = (await s3.getObject({Bucket,Key:assetId})).createReadStream();
        /** @type {AssetRules[]}*/let rules=(JSON.parse(await streamToString(stream))).rules;

        //handle simple cases
        if (rules===undefined) return undefined;                //undefined if no rules
        if (height===0) return [rules.pop()];                   //only last state wanted
        if (rules.length===1) return rules;                     //only 1 rule found so it must be valid

        //find first rule that was valid at height
        let first=0;
        for (let i=1; i<rules.length;i++) {                     //start at 1 because when valid ends is next ones creation+overlap
            if (rules[i].effective+overlap>height) {            //check if (i-1) ended after height(not >= because that is the height it expires at)
                first=i-1;                                      //we found first so record its index
                break;                                          //found what we want so break
            }
        }

        //find last rule that is valid
        let valid=[];
        for (let i=first;i<rules.length;i++) {
            if (rules[i].effective>height) break;               //if effective above height then we have found all valid so stop
            valid.push(rules[i]);                               //include this rule because it is valid
        }

        //return results
        return valid;
    } catch (e) {
        throw "Asset Does Not Exist: "+assetId;
    }
}


/**
 * Returns a list of votes associated with a DigiAsset cid
 * This data is human readable only so if not findable can be ignored for compliance checking
 * @param {string}  cid
 * @return {Promise<{address:string,label:string}[]>}
 */
module.exports.getVotes=async(cid)=>{
    try {
        // noinspection JSUnresolvedVariable
        return (await IPFS.catJSON(cid)).votes||[];
    } catch (e) {
        return [];
    }
}


/**
 * Given a txid and vout looks up a UTXO and returns
 * @param {string}  txid
 * @param {int}     vout
 * @return {Promise<UTXO>}
 */
module.exports.getUTXO=async(txid,vout)=>{
    if (s3===undefined) throw "Loader not initialize";
    try {
        //load from s3
        let stream = (await s3.getObject({Bucket,Key:txid})).createReadStream();
        let utxo=(JSON.parse(await streamToString(stream))).vout[vout];
        utxo.txid=txid;
        utxo.vout=vout;
        return utxo;
    } catch (e) {
        throw "UTXO does not exist: "+txid+":"+vout;
    }
}

/**
 * Gets the exchange rate from a specific txid
 * @param {string}  txid
 * @param {{
 *         address: string,
 *         index:   int,
 *         name:    string
 *     }}   exchangeType
 * @return {Promise<double>}
 */
const getExchangeRate=async(txid,exchangeType)=> {
    let stream = (await s3.getObject({Bucket,Key:txid})).createReadStream();
    let hex=(JSON.parse(await streamToString(stream))).vout[0].scriptPubKey.hex.substr(6);
    let decoded=priceDecoder(["0","1","2","3","4","5","6","7","8","9"],hex);
    return decoded[exchangeType.index.toString()];
}


/**
 * Gets the lowest exchange rate valid at height.
 * If height is not defined returns the most recent published exchange rate
 * @param {{
 *         address: string,
 *         index:   int,
 *         name:    string
 *     }}  exchangeType
 * @param {int}     height
 * @return {Promise<double>}
 */
module.exports.getExchangeRate=async(exchangeType,height=0)=>{
    if (s3===undefined) throw "Loader not initialize";
    try {
        //load from s3
        let stream = (await s3.getObject({Bucket,Key:exchangeType.address})).createReadStream();
        /** @type {AddressTxRecord[]}*/let txs=(JSON.parse(await streamToString(stream))).txs;

        //remove any txs that arent exchange rate data
        txs=txs.filter(data=>(data.change==="-1000"));

        //handle easy case
        if (height===0) return getExchangeRate(txs.pop().txid,exchangeType);

        //find first rule that was valid at height
        let first=0;
        for (let i=1; i<txs.length;i++) {                       //start at 1 because when valid ends is next ones creation+overlap
            if (txs[i].height+overlap>height) {                 //check if (i-1) ended after height(not >= because that is the height it expires at)
                first=i-1;                                      //we found first so record its index
                break;                                          //found what we want so break
            }
        }

        //find last rule that is valid
        let valid=[];
        for (let i=first;i<txs.length;i++) {
            if (txs[i].height>height) break;                    //if effective above height then we have found all valid so stop
            valid.push(getExchangeRate(txs[i].txid,exchangeType));//include this rule because it is valid
        }
        /** @type {number[]} */let exchangeRates=await Promise.all(valid);//await for exchange rates to all finish

        //return results
        return Math.min(...exchangeRates);                      //return minimum value because this is cheapest legal price
    } catch (e) {
        throw "Error finding exchange rate on "+exchangeType.address;
    }
}