// noinspection JSUnfilteredForInLoop

require('digiassetx-digibyte-stream-types');
const priceDecoder=require('digibyte-price-decoder');
const ExpectedError=require('./lib/ExpectedError');

const AWS=require('aws-sdk');
const ipfs=require('ipfs-simple');
const Bucket="chaindata-digibyte";
const got=require('got');
let s3;
const overlap=240;




/**
 * Converts Strings to BigInts
 * @param {UTXO[]}    utxos
 * @return {UTXO[]}
 */
const convertUtxoStrings=(utxos)=>{
    for (let utxo of utxos) {
        utxo.value=BigInt(utxo.value);
        if (utxo.assets===undefined) continue;
        for (let asset of utxo.assets) asset.amount=BigInt(asset.amount);
    }
    return utxos;
}



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
 * Gets a stream from digiassetX
 * @param {string}  Key
 * @return {Promise<ReadStream|stream.Readable>}
 */
const getStream=async(Key)=>(await s3.getObject({Bucket,Key,RequestPayer:"requester"})).createReadStream();

/**
 * Gets data from S3
 * @param {string}  Key
 * @return {Promise<any>}
 */
let getS3Data=async(Key)=>{   //let because it is replaceable
    let stream = await getStream(Key);
    return JSON.parse(await streamToString(stream));
}











/**
 * Initializes S3 connection.
 * Must
 * @param {{
 *    accessKeyId:     string?,
 *    secretAccessKey: string?
 * }|function} config
 */
module.exports.initS3=(config)=>{
    if (typeof config==="function") {
        getS3Data=config;
        s3=true;
    } else {
        s3 = new AWS.S3(config);
    }
}


/**
 * IPFS desktop interface by default uses:
 *      http://127.0.0.1:5001/api/v0/
 *
 * no need to run unless needs to change
 * @param {string|IPFS} config
 */
module.exports.initIPFS=(config)=>{
    ipfs.init(config);
}




/**
 * Gets an addresses data
 * @param {string}  address
 * @return {Promise<AddressData>}
 */
module.exports.getAddress=async(address)=>{
    if (s3===undefined) throw new ExpectedError("Loader not initialize");
    try {
        //load from s3
        return await getS3Data(address);
    } catch (e) {
        throw new ExpectedError("Address Does Not Exist: "+address);
    }
}

/**
 * Function to get DigiByte's current block height
 * @param {?int} height  - if provided just returns the value provided(provided as simple standard in case you are not
 *                         sure if you know.  If undefined looks up actual value)
 * @returns {Promise<int>}
 */
module.exports.getHeight=async(height)=>{
    //see if was provided
    if (height!==undefined) return height;

    //try to get public block height
    try {
        let response=await got.get('https://chainz.cryptoid.info/dgb/api.dws?q=getblockcount');
        return  parseInt(response.body);
    } catch (e) {}

    //backup get height s3 is at
    if (s3===undefined) throw new ExpectedError("Loader not initialize");
    return await getS3Data("height");
}

/**
 * Gets an assets data
 * @param {string}  assetId
 * @return {Promise<AssetData>}
 */
module.exports.getAsset=async(assetId)=>{
    if (!/^[LU][ahd][1-9A-HJ-NP-Za-km-z]{36}$/.test(assetId)) throw new ExpectedError("Invalid Asset Id");
    if (s3===undefined) throw new ExpectedError("Loader not initialize");
    try {
        //load from s3
        return await getS3Data(assetId);
    } catch (e) {
        throw new ExpectedError("Asset Does Not Exist: "+assetId);
    }
}

/**
 * Gets the users KYC state.
 * Returns undefined if no KYC, error if no address
 * @param {string}  address
 * @return {Promise<KycState>}
 */
module.exports.getKYC=async(address)=>{
    if (s3===undefined) throw new ExpectedError("Loader not initialize");
    try {
        //load from s3
        return (await getS3Data(address)).kyc;
    } catch (e) {
        throw new ExpectedError("Address Does Not Exist: "+address);
    }
}

/**
 * Cleans stream data and converts BigInts from string
 * @param {AssetRules[]} rules
 * @return {AssetRules[]}
 */
const cleanRules=(rules)=>{
    for (let rule of rules) {
        //convert royalties to BigInt
        if (rule.royalties!==undefined) {
            for (let i in rule.royalties) rule.royalties[i]=BigInt(rule.royalties[i]);
        }

        //convert deflate to BigInt
        if (rule.deflate!==undefined) rule.deflate=BigInt(rule.deflate);
    }
    return rules;
}

/**
 * Gets the assets rules.  Returns undefined if no rules error if asset doesn't exist
 * @param {String}  assetId
 * @param {int}     height
 * @return {Promise<AssetRules[]>}
 */
module.exports.getRules=async(assetId,height=0)=>{
    if (s3===undefined) throw new ExpectedError("Loader not initialize");
    try {
        //load from s3
        /** @type {AssetRules[]}*/let rules=(await getS3Data(assetId)).rules;

        //handle simple cases
        if (rules===undefined) return undefined;                //undefined if no rules
        if (height===0) return cleanRules([rules.pop()]);  //only last state wanted
        if (rules.length===1) return cleanRules(rules);         //only 1 rule found so it must be valid

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
        return cleanRules(valid);
    } catch (e) {
        throw new ExpectedError("Asset Does Not Exist: "+assetId);
    }
}


/**
 * Returns a list of votes associated with a DigiAsset cid
 * This data is human readable only so if not findable can be ignored for compliance checking
 * @param {string}  cid
 * @param {int} timeout - max amount of time to look for vote data
 * @return {Promise<{address:string,label:string}[]>}
 */
module.exports.getVotes=async(cid,timeout=600000)=>{
    try {
        // noinspection JSUnresolvedVariable
        return (await ipfs.catJSON(cid,timeout)).votes||[];
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
    if (s3===undefined) throw new ExpectedError("Loader not initialize");
    try {
        //load from s3
        let utxo=(await getS3Data(txid)).vout[vout];
        utxo.txid=txid;
        utxo.vout=vout;
        return convertUtxoStrings([utxo])[0];
    } catch (e) {
        throw new ExpectedError("UTXO does not exist: "+txid+":"+vout);
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
    let hex=(await getS3Data(txid)).vout[0].scriptPubKey.hex.substr(6);
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
    if (s3===undefined) throw new ExpectedError("Loader not initialize");
    try {
        //load from s3
        /** @type {AddressTxRecord[]}*/let txs=(await getS3Data(exchangeType.address)).txs;

        //remove any txs that aren't exchange rate data
        txs=txs.filter(data=>(data.change==="-1000"));

        //handle easy case
        if (height===0) {
            let value=NaN;
            while (isNaN(value)) value=await getExchangeRate(txs.pop().txid,exchangeType);  //occasionally values can't be sourced, and they are stored as NaN so keep moving backwards until we find a valid value
            return value;
        }

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

        //remove any values that are NaN
        exchangeRates=exchangeRates.filter(data=>(!isNaN(data)));

        //return results if found
        if (exchangeRates.length>0) return Math.min(...exchangeRates);                      //return minimum value because this is the cheapest legal price

        //none in range where valid so find most recent value before range
        for (let i=first-1;i>=0;i--) {
            let value=await getExchangeRate(txs[i].txid,exchangeType);
            if (!isNaN(value)) return value;
        }
        throw new ExpectedError("No valid exchange rates found on "+exchangeType.address);

    } catch (e) {
        throw new ExpectedError("Error finding exchange rate on "+exchangeType.address);
    }
}

/**
 * Gives the last 10 conversion rates.
 * First number in each array is newest.
 * Values are the number of DGB sats needed to purchase one of that currency
 * @return {Promise<{
 *     BRL: Number[],
 *     BTC: Number[],
 *     CNY: Number[],
 *     ETH: Number[],
 *     LTC: Number[],
 *     NXS: Number[],
 *     TRY: Number[],
 *     CAD: Number[],
 *     CHF: Number[],
 *     EUR: Number[],
 *     ZIL: Number[],
 *     XVG: Number[],
 *     JPY: Number[],
 *     RVN: Number[],
 *     AUD: Number[],
 *     USD: Number[],
 *     DCR: Number[],
 *     RDD: Number[],
 *     GBP: Number[],
 *     POT: Number[],
 *     time: Number[],
 *     block:Number[]
 * }>}
 */
module.exports.getLatestExchangeRates=async()=>getS3Data("rates");