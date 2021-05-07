const inquirer = require('inquirer');
const AWS = require('aws-sdk');

const ebayAppClientIdParamName = '/keys/ebay/AppClientId';
const ebayDevIdParamName = '/keys/ebay/DevId';
const ebayCertIdParamName = '/keys/ebay/CertId';

const questions = [
  {
    type: 'input',
    name: 'EbayAppClientId',
    message: 'Enter your Ebay App Client ID: ',
    default: () => '',
  },
  {
    type: 'input',
    name: 'EbayDevId',
    message: 'Enter your Ebay Dev ID: ',
    default: () => '',
  },
  {
    type: 'input',
    name: 'EbayCertId',
    message: 'Enter your Ebay Cert ID: ',
    default: () => '',
  },
];

inquirer.prompt(questions).then((answers) => {
  var credentials = new AWS.SharedIniFileCredentials({ profile: 'ecommerce-item-manager' });

  const ssm = new AWS.SSM({
    region: 'us-east-1',
    credentials,
  });

  console.log('Uploading API keys to SSM...');

  const ssmParams = [
    {
      Name: ebayAppClientIdParamName,
      Description: 'Ebay App Client Id',
      Value: cleanSSMValue(answers.EbayAppClientId),
    },
    {
      Name: ebayDevIdParamName,
      Description: 'Ebay Dev Id',
      Value: cleanSSMValue(answers.EbayDevId),
    },
    {
      Name: ebayCertIdParamName,
      Description: 'Ebay Cert Id',
      Value: cleanSSMValue(answers.EbayCertId),
    },
  ];

  for (const ssmParam of ssmParams) {
    ssm.putParameter(
      {
        Name: ssmParam.Name,
        Description: ssmParam.Description,
        Type: 'SecureString',
        Value: ssmParam.Value,
        Overwrite: true,
      },
      (error) => {
        if (error) {
          throw error;
        }
      }
    );
  }

  console.log('API Keys uploaded successfully!');
  console.log(JSON.stringify(ssmParams, null, '  '));
});

// Util function to clean values before uploading to ssm
function cleanSSMValue(ssmValue) {
  // remove new lines
  ssmValue = ssmValue.replace(/\r?\n|\r|\\n/g, '');

  // remove tabs
  ssmValue = ssmValue.replace(/\t|\\t/g, '');

  // remove white space
  ssmValue = ssmValue.replace(/\s/g, '');

  return ssmValue;
}
