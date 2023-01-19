const Github = require('./github');
const Gitlab = require('./gitlab');
const Bitbucket = require('./bitbucket');
const BitbucketDataCenter = require('./bitbucketDataCenter');
const { ACCOUNT_PROVIDER } = require('../helper/core-api/enums');

const getProviderService = async (account, repository) => {
  let providerService;
  switch (account.provider) {
    case ACCOUNT_PROVIDER.GITHUB:
      providerService = new Github(account, repository);
      break;
    case ACCOUNT_PROVIDER.GITLAB:
      providerService = new Gitlab(account, repository);
      break;
    case ACCOUNT_PROVIDER.BITBUCKET:
      providerService = new Bitbucket(account, repository);
      break;
    case ACCOUNT_PROVIDER.BITBUCKET_DATA_CENTER:
      providerService = new BitbucketDataCenter(account, repository);
      break;
    default:
      throw Error(`provider=[${account.provider}] is not supported`);
  }
  await providerService.init();
  return providerService;
};

module.exports = getProviderService;
