const lodashGet = require('lodash/get');

const { constants } = require('../../config');

const getAccountIdentifier = provider => {
  switch (provider.toUpperCase()) {
    case 'BITBUCKET_DATA_CENTER':
      return 'providerMetadata.projectKey';
    default:
      return 'login';
  }
};

const getAccountIdentifierValue = account =>
  lodashGet(account, getAccountIdentifier(account.provider), account.login);

const shortGitProvider = provider => constants.shortProvider[provider.toUpperCase()];

const constructAccountPIDUrl = account => {
  const accountIdentifier = getAccountIdentifierValue(account);
  return `${shortGitProvider(account.provider)}/${accountIdentifier}`;
};

const dashboardScanUrl = (account, idRepository, sha) => {
  const pid = constructAccountPIDUrl(account);
  return `${constants.dashboardBaseUrl}/${pid}/repos/${idRepository}/scans?sha=${sha}`;
};

module.exports = {
  getAccountIdentifierValue,
  dashboardScanUrl
};
