# digiasset-lookup
Serverless way to lookup digiasset and digibyte data.  Below are instructions on how to get your access keys.

## Installation
``` bash
npm install digiasset-lookup
```


## IPFS(Needed for getVote):
1. Follow instructions at https://docs.ipfs.io/install/ipfs-desktop/
2. Forward port 4001 to this machine
3. If planning to run this all the time you may want to set IPFS to run on boot.  In linux I did that by running ```crontab -e``` and adding ```@reboot /usr/local/bin/ipfs daemon```


## AWS S3 API Key(Needed for all commands):
1. Create an account at https://aws.amazon.com/
2. Services->IAM
3. In left column: Policies
4. Blue Create policy button
5. JSON

```JSON
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "s3:GetObjectAcl",
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::*/*",
                "arn:aws:s3:::chaindata-digibyte"
            ]
        }
    ]
}
```

6. Blue Review policy button
7. name: digiassetX_data
8. Blue Create policy
9. In left Column: Groups
10. Blue Create Group Button
11. Group Name: digiassetX_data
12. Type digi into search then select digiassetX_data
13. Blue Next Step Button
14. Blue Create Group Button
15. On left panel select Users
16. Blue add user button
17. user name: digiassetX_data
18. Select: Programmatic access
19. Blue Next: Permissions button
20. select: digiassetX_data
21. Blue Next: Tags button
22. Blue Next: Review button
23. Blue Create user button
24. Copy Access key ID and Secret access key into config/config.js
25. click Close(make sure you have copied keys there will not be a second chance.

## Usage
```javascript
//initialize
const lookup=require('digiasset-lookup');
lookup.initS3({
    accessKeyId:    'Your AWS S3 API Access Key',
    secretAccessKey:'Your AWS S3 API Secret Access Key'
});

//get an addresses data
let addressData=await lookup.getAddress('dgb1qunxh378eltj2jrwza5sj9grvu5xud43vqvudwh');
console.log(addressData);

//get if an address is KYC verified
let kycData=await lookup.getKYC('DSXnZTQABeBrJEU5b2vpnysoGiiZwjKKDY');
console.log(kycData);

//gets an assets rules
let rules=await lookup.getRules('Ua9hJ3q7zKnaRZS9E5frb3Ukon6aBNNgxLX3i5');
console.log(rules);

//get an exchange rate
let numberOfDGBsatsToEqual1DolarCanadian=await lookup.getExchangeRate({
    address: "dgb1qunxh378eltj2jrwza5sj9grvu5xud43vqvudwh",
    index:   0,
    name:    "CAD"
});
console.log(numberOfDGBsatsToEqual1DolarCanadian);
```