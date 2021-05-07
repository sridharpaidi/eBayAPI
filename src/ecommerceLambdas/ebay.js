const AWS = require('aws-sdk');
const EbayAuthToken = require('ebay-oauth-nodejs-client');
const axios = require('axios');

// TODO: Might need to retrieve the SSM params directly rather than through lambda variables
//  so that the lambda can retrieve new keys without being redeployed.
const { EBAY_TABLE, EBAY_APP_CLIENT_ID, EBAY_CERT_ID, EBAY_BUCKET_NAME } = process.env;
const ebayItemUrl = 'https://api.ebay.com/buy/browse/v1/item/';

module.exports.handler = async (event, context, callback) => {
  const dynamoDb = new AWS.DynamoDB.DocumentClient();
  const s3 = new AWS.S3();

  // read all txt files from the root of the Ebay bucket
  // Skip any object in a subdirectories, since completed
  //  files are placed in a /completed subdirectory
  console.log('Reading from S3..');
  const bucket = await s3.listObjectsV2({ Bucket: EBAY_BUCKET_NAME, Delimiter: '/' }).promise();

  const todoFiles = bucket.Contents.map((s3Obj) => s3Obj.Key);

  for (const todoFile of todoFiles) {
    const itemFileObject = await s3
      .getObject({ Bucket: EBAY_BUCKET_NAME, Key: todoFile })
      .promise();

    let itemList = itemFileObject.Body.toString();
    itemList = itemList.split('\n');

    // GET eBay API Key using clientId and certId
    const ebayAuthToken = new EbayAuthToken({
      clientId: EBAY_APP_CLIENT_ID,
      clientSecret: EBAY_CERT_ID,
    });

    // token lasts for 2 hours by default. Will need to implement a refresh for processes
    // taking longer than 2 hours
    const tokenResponse = await ebayAuthToken.getApplicationToken('PRODUCTION');
    const token = JSON.parse(tokenResponse).access_token;

    // throw error if API token cannot be retrieved
    if (!token) {
      throw new Error(
        'Error: eBay access token could not be retrieved! Check your API keys in SSM.'
      );
    }

    // Get response from eBay get and map it to the DB
    for (const itemId of itemList) {
      if (itemId === '') {
        // skip any blank lines
        continue;
      }

      // Check to make sure itemId does not already exist in DB before calling API
      const existingItem = await dynamoDb
        .get({
          TableName: EBAY_TABLE,
          Key: {
            itemId,
          },
          AttributesToGet: ['itemId'],
        })
        .promise();

      if (existingItem.Item) {
        // skip item if it already is stored in the DB
        continue;
      }

      // encode pipe (|)
      let encodedItemId = itemId.replace(/\|/g, '%7C');
      const itemUrl = new URL(encodedItemId, ebayItemUrl).href;

      let res;
      try {
        res = await axios.get(itemUrl, { headers: { Authorization: `Bearer ${token}` } });
      } catch (error) {
        console.log(error);
      }

      if (res && res.status === 200) {
        // map response to DB
        const parsedData = mapItemToDb(res.data);

        const tableParams = {
          TableName: EBAY_TABLE,
          Item: {
            itemId,
            ...parsedData,
          },
        };

        await dynamoDb.put(tableParams).promise();
      } else {
        console.log(`ERROR: `, res);
        // maybe write to an error file?
        continue;
      }
    }

    const currentDate = getCurrentDate();

    const completedFileKey = `completed/${currentDate}/${todoFile}`;
    console.log(`copying completed file to ${completedFileKey}..`);
    // Copy file to completed directory
    await s3
      .copyObject({
        Bucket: EBAY_BUCKET_NAME,
        CopySource: `${EBAY_BUCKET_NAME}/${todoFile}`,
        Key: completedFileKey,
      })
      .promise();

    console.log(`removing file ${todoFile}..`);
    // Remove old file
    await s3.deleteObject({ Bucket: EBAY_BUCKET_NAME, Key: todoFile }).promise();
  }
};

function mapItemToDb(ebayResponse) {
  return {
    title: ebayResponse.title,
    description: ebayResponse.shortDescription,
    categoryId: ebayResponse.categoryId,
    categoryDescription: ebayResponse.categoryPath,
    itemUrl: ebayResponse.itemWebUrl,
    mainImage: ebayResponse.image ? ebayResponse.image.imageUrl : undefined,
    additionalImages: ebayResponse.additionalImages,
    price: ebayResponse.price ? ebayResponse.price.value : undefined,
    currency: ebayResponse.price ? ebayResponse.price.currency : undefined,
    discount:
      ebayResponse.marketingResponse && ebayResponse.marketingResponse.discountAmount
        ? ebayResponse.marketingResponse.discountAmount.value
        : undefined,
    originalPrice:
      ebayResponse.marketingResponse && ebayResponse.marketingResponse.originalPrice
        ? ebayResponse.marketingResponse.originalPrice.value
        : undefined,
    reviewCount: ebayResponse.primaryProductReviewRating
      ? ebayResponse.primaryProductReviewRating.reviewCount
      : undefined,
    averageRating: ebayResponse.primaryProductReviewRating
      ? ebayResponse.primaryProductReviewRating.averageRating
      : undefined,
    createdAt: new Date().toISOString(),
    fullResponse: ebayResponse,
  };
}

/**
 * Get the current date in YYYY-MM-DD.
 */
function getCurrentDate() {
  var d = new Date(),
    month = '' + (d.getMonth() + 1),
    day = '' + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}
