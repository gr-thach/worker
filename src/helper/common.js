const lodashGet = require('lodash/get');
const capitalize = require('lodash/capitalize');
const semver = require('semver');

const { env, constants } = require('../../config');

const { defaultSlackFormattedMessage } = require('./slack');
const SlackService = require('../services/slack');
const { ACCOUNT_PROVIDER } = require('./core-api/enums');

const getMaxVersion = versions => {
  let highest = '<0.0.0';

  if (versions) {
    versions
      .replace(/([>=<]) /g, '$1')
      .replace(/,|\|/g, ' ')
      .replace(/\s\s+/g, ' ')
      .split(' ')
      .map(x => x.trim())
      .forEach(v => {
        if (semver.valid(semver.coerce(v))) {
          highest = semver.lt(semver.coerce(highest), semver.coerce(v)) ? v : highest;
        }
      });
  }

  return highest;
};

const hasLatestPatchedVersions = (candidate, current = {}) => {
  if (candidate.type !== 'sca') {
    return true;
  }

  const currentPatchedVersions = lodashGet(current, 'metadata.patchedVersions');
  const candidatePatchedVersions = lodashGet(candidate, 'metadata.patchedVersions');

  const maxCandidate = getMaxVersion(candidatePatchedVersions);
  const maxCurrent = getMaxVersion(currentPatchedVersions);
  return semver.lte(semver.coerce(maxCurrent), semver.coerce(maxCandidate));
};

const alertOnEngineTimeout = ({
  engineName,
  accountIdentifier,
  repositoryName,
  sha,
  timeoutInMinutes
}) => {
  if (env.IGNORE_DEVOPS_HOOKS) return;
  const title = `:warning: ${engineName} is terminated after ${timeoutInMinutes} minutes`;
  const text = `on ${accountIdentifier}/${repositoryName}@${sha}`;
  SlackService.postNotification(constants.slackDevopsWebhookUrl, {
    attachments: [defaultSlackFormattedMessage(`*${title}*\n${text}`, '#edeeef')]
  });
};

const capitalizeLang = lang => {
  if (lang === 'php' || lang === '.net') {
    return lang.toUpperCase();
  }

  if (lang === 'javascript') return 'JavaScript';
  if (lang === 'typescript') return 'TypeScript';
  if (lang === 'dotnet') return '.NET';
  if (lang === 'objective-c') return 'Objective-C';
  if (lang === 'ios') return 'iOS';
  if (lang === 'c') return 'C/C++';

  return capitalize(lang);
};

const calculateScanFingerPrint = scan => {
  const { idScan, scanTimestamp } = scan;
  return `${idScan}|${scanTimestamp}`;
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const shouldSetCommitStatus = (account, repository, repoConfig, isPR) => {
  return (
    isPR && // we only do it for PRs
    !env.DISABLE_COMMIT_STATUS && // if the feature is also not disabled
    // and if showPublicReposChecks is not disabled (only applied for github public repos)
    (account.provider !== ACCOUNT_PROVIDER.GITHUB ||
      repository.isPrivate ||
      lodashGet(repoConfig, 'report.pullRequest.showPublicReposChecks', true) !== false)
  );
};

module.exports = {
  hasLatestPatchedVersions,
  alertOnEngineTimeout,
  capitalizeLang,
  calculateScanFingerPrint,
  sleep,
  shouldSetCommitStatus
};
