Ecommerce Item Manager

The purpose of this project is to retrieve data for each given eBay itemId and then store it in a database.

eBay is used as a POC, but this can be extended to other ecommerce websites, like Macys, Nordstrom, Amazon, etc.

This npm package only serves to deploy the infrastructure and code that will run on the lambda function(s). The code that is run on the lambdas can be found in src/ecommerceLambdas.

Setting up development environment:

- Ensure node is installed (preferably node v12.18.3)
- The aws cli should be installed (easiest way is with pip - `pip install awscli`): https://docs.aws.amazon.com/cli/latest/userguide/install-cliv1.html
- The aws cli should be configured with the credentials for your AWS account: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html
- There should be a profile in ~/.aws/credentials that has the name `ecommerce-item-manager` with the access key and
  secret access key of the aws account that you want to the deploy the resources to
- run `npm i` from the command line
- Before deploying the infrastructure, upload your eBay API keys by using `npm run configureSSM`.
- To deploy the infrastructure, run `npm run deploy`

To run:

1. Copy any new-line (\n) separated files with ebay itemIds to the ebay bucket(Ex name: ecommerce-item-manager-dev-ebayitembucket-yc8uxdpy2ab4). Example files can be found in test/sampleFiles. These will be picked up by the lambda and run whenever it is invoked.
2. Invoke the lambda manually through the aws console, and that's it!
3. The itemIds in the files will be used to query the eBay API, and the results will be parsed and stored in DynamoDB. Note: Any itemIds that already exist in Dynamo will be skipped.
4. Once a particular file is completed, it will be moved to a /completed subdirectory in S3. The files in /completed will not be run by the Lambda anymore.
