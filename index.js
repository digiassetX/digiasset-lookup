require('digiassetx-digibyte-stream-types');


const AWS=require('aws-sdk');
const IPFS=require('ipfs-simple');
const Bucket="chaindata-digibyte";
let s3;






/**
 * Converts a stream to a string
 * @param stream
 * @return {Promise<string>}
 */
const streamToString=async (stream)=>{
    //console.log("file_35");
    return new Promise(resolve => {
        const chunks = [];

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
 * Gets the users KYC state.  Returns undefined if no KYC error if no address
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
 * @param assetId
 * @return {Promise<AssetRules>}
 */
module.exports.getRules=async(assetId)=>{
    if (s3===undefined) throw "Loader not initialize";
    try {
        //load from s3
        let stream = (await s3.getObject({Bucket,Key:assetId})).createReadStream();
        return (JSON.parse(await streamToString(stream))).rules;
    } catch (e) {
        throw "Asset Does Not Exist: "+assetId;
    }
}


/**
 * Returns a list of votes associated with a DigiAsset cid
 * This data is human readable only so if not findable can be ignored for compliance checking
 * @param {string}  cid
 * @return {Promise<Object<string>>}
 */
module.exports.getVotes=async(cid)=>{
    try {
        // noinspection JSUnresolvedVariable
        return (await IPFS.catJSON(cid)).votes||{};
    } catch (e) {
        return {};
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
        return (JSON.parse(await streamToString(stream))).vout[vout];
    } catch (e) {
        throw "UTXO does not exist: "+txid+":"+vout;
    }
}