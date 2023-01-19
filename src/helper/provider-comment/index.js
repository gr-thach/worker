const GithubCommentRenderer = require('./github');
const GitlabCommentRenderer = require('./gitlab');
const BitbucketCommentRenderer = require('./bitbucket');
const BitbucketDataCenterCommentRenderer = require('./bitbucketDataCenter');
const { ACCOUNT_PROVIDER } = require('../core-api/enums');
const {
  getAllEngineRule,
  getAllCustomEngineRules,
  getAllSeverity
} = require('../core-api/scanMappings');

const setPullRequestComment = async (
  totalVulnerabilities,
  vulnerabilities,
  providerService,
  sha,
  commentId,
  account,
  paranoidMode,
  prNumber
) => {
  if (!commentId && totalVulnerabilities === 0) {
    return false;
  }

  const dashboardScanUrl = providerService.getDashboardScanUrl(sha);
  const generateLinkToCodeInShaFunc = await providerService.generateLinkToCodeInSha(sha);

  const comment = await getPullRequestComment(
    account.idAccount,
    account.provider,
    totalVulnerabilities,
    vulnerabilities,
    paranoidMode,
    generateLinkToCodeInShaFunc,
    dashboardScanUrl
  );

  return providerService.setPRComment(commentId, prNumber, comment);
};

const getPullRequestComment = async (
  accountId,
  provider,
  totalVulnerabilities,
  vulnerabilities,
  paranoidMode,
  generateLinkToCodeInShaFunc,
  dashboardScanUrl
) => {
  let completeGroupedVulnerabilities = {};

  if (totalVulnerabilities > 0) {
    completeGroupedVulnerabilities = await addEngineRuleAndSeverityDataToVulns(
      accountId,
      vulnerabilities
    );
  }

  const commentRenderer = getProviderCommentRenderer(
    provider,
    completeGroupedVulnerabilities,
    generateLinkToCodeInShaFunc,
    dashboardScanUrl
  );

  return commentRenderer.render(paranoidMode, totalVulnerabilities);
};

const getProviderCommentRenderer = (
  provider,
  completeGroupedVulnerabilities,
  generateLinkToCodeInShaFunc,
  dashboardScanUrl
) => {
  switch (provider) {
    case ACCOUNT_PROVIDER.GITHUB:
      return new GithubCommentRenderer(
        completeGroupedVulnerabilities,
        generateLinkToCodeInShaFunc,
        dashboardScanUrl
      );
    case ACCOUNT_PROVIDER.GITLAB:
      return new GitlabCommentRenderer(
        completeGroupedVulnerabilities,
        generateLinkToCodeInShaFunc,
        dashboardScanUrl
      );
    case ACCOUNT_PROVIDER.BITBUCKET:
      return new BitbucketCommentRenderer(
        completeGroupedVulnerabilities,
        generateLinkToCodeInShaFunc,
        dashboardScanUrl
      );
    case ACCOUNT_PROVIDER.BITBUCKET_DATA_CENTER:
      return new BitbucketDataCenterCommentRenderer(
        completeGroupedVulnerabilities,
        generateLinkToCodeInShaFunc,
        dashboardScanUrl
      );
    default:
      throw Error(`provider=[${provider}] is not supported`);
  }
};

const addEngineRuleAndSeverityDataToVulns = async (accountId, groupedVulnerabilities) => {
  const allEngineRule = await getAllEngineRule();
  const allCustomEngineRules = await getAllCustomEngineRules(accountId);
  const allSeverity = await getAllSeverity();

  const engineRules = Object.fromEntries(new Map(allEngineRule.map(er => [er.id, er])));
  const customEngineRules = Object.fromEntries(
    new Map(allCustomEngineRules.map(cer => [cer.id, cer]))
  );
  const severities = Object.fromEntries(new Map(allSeverity.map(s => [s.id, s])));
  const completeGroupedVulns = {};
  Object.keys(groupedVulnerabilities).forEach(category => {
    const vulns = groupedVulnerabilities[category];
    completeGroupedVulns[category] = vulns.map(v => ({
      ...v,
      engineRule: v.fkCustomEngineRule
        ? customEngineRules[v.fkCustomEngineRule]
        : engineRules[v.fkEngineRule],

      severity: severities[v.fkSeverity]
    }));
  });

  return completeGroupedVulns;
};

module.exports = { setPullRequestComment };
