const filterDuplicated = require('./preprocessors/filter-findings-duplicated-path-and-line-number');
const filterDisabledLine = require('./preprocessors/filter-findings-on-disabled-lines');
const filterNotInPRDiff = require('./preprocessors/filter-findings-outside-of-pull-request-diff');
const filterRuleOverride = require('./preprocessors/filter-findings-rule-override');
const filterIgnoreFile = require('./preprocessors/filter-findings-matching-ignore-file');
const filterUserAction = require('./preprocessors/filter-findings-user-action');
const { SCAN_TYPE } = require('../../helper/core-api/enums');

// Note: from https://github.com/guardrailsio/worker/blob/873f6f96aa488d133562b55250f598ec59d5319e/src/content/processing/preprocess.js#L29
const configAndRuleFilter = (
  enginesOutputs,
  pullRequestDiffContent,
  config,
  scanType,
  engineLanguage,
  engineName,
  actions
) => {
  const { ignore, report } = config || {};
  const prReportType = report && report.pullRequest && report.pullRequest.findings;

  if (
    scanType === SCAN_TYPE.PRE_HOOK ||
    (scanType === SCAN_TYPE.PULL && prReportType !== 'onAllFiles')
  ) {
    filterNotInPRDiff(enginesOutputs, pullRequestDiffContent, prReportType);
  }

  if (ignore && ignore.length) {
    filterIgnoreFile(enginesOutputs, ignore);
  }

  filterDisabledLine(enginesOutputs);

  filterRuleOverride(enginesOutputs, config, engineLanguage, engineName);

  filterDuplicated(enginesOutputs);

  filterUserAction(enginesOutputs, actions);
};

module.exports = configAndRuleFilter;
