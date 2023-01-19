/* eslint-disable no-restricted-syntax */
const crypto = require('crypto');
const get = require('lodash/get');

const { updateEnginRunFindings } = require('./core-api/findings');
const { hasLatestPatchedVersions } = require('./common');
const { groupBy } = require('./core-api');

const hashedLineContentPrefix = '--gr-hash-v1--';

const findingStatus = {
  VULNERABILITY: 'vulnerability',
  FIXED: 'fixed',
  WONT_FIX: 'wont_fix',
  FALSE_POSITIVE: 'false_positive',
  MARK_AS_FIXED: 'mark_as_fixed',
  MARK_AS_VULNERABILITY: 'mark_as_vulnerability'
};

const isVulnerabilityStatus = [
  findingStatus.VULNERABILITY.toUpperCase(),
  findingStatus.MARK_AS_VULNERABILITY.toUpperCase()
];

const stripAllSpace = s => (s || '').replace(/\s+/g, '');

const parseScaIdentity = d =>
  get(d, 'lineNumber', 0) > 0
    ? get(d, 'lineNumber', 0)
    : `${get(d, 'metadata.dependencyName', '')}_${get(d, 'metadata.currentVersion', 'null')}`;

// Update finding in case of file rename
const modifyAllFindingWithFileRenameDiffs = (allFindings, diffs) => {
  for (const diff of diffs) {
    // file rename
    if (diff.from !== '/dev/null' && diff.to !== '/dev/null' && diff.from !== diff.to) {
      for (const i in allFindings) {
        if (allFindings[i].path === diff.from) {
          allFindings[i].path = diff.to; // eslint-disable-line no-param-reassign
        }
      }
    }
  }
};

const modifyAllFindingWithHashLineContent = (allFindings, hashLineContentFn) => {
  for (const i in allFindings) {
    if (allFindings[i].type === 'secret' && allFindings[i].lineContent) {
      allFindings[i].lineContent = hashLineContentFn(allFindings[i].lineContent); // eslint-disable-line no-param-reassign
    }
  }
};

const generateFixedValue = (isVulnerability, currentVulnerability, currentValue, newValue) => {
  if (!isVulnerability && currentVulnerability) {
    return newValue;
  }
  if (isVulnerability) {
    return null;
  }
  return currentValue;
};

const checkIsVulnerability = status => isVulnerabilityStatus.includes((status || '').toUpperCase());

const extractImportantMetadataForSca = metadata => ({
  dependencyName: metadata.dependencyName,
  currentVersion: metadata.currentVersion || null,
  patchedVersions: metadata.patchedVersions,
  severity: metadata.severity,
  cvssSeverity: metadata.cvssSeverity,
  cvssScore: metadata.cvssScore,
  cvssVector: metadata.cvssVector
});

// Mark duplicatedWith to the input findings and EngineRunsFindings table
const deDuplicatedFindings = async findings => {
  // group by uniqueKey: "fkRepository", "branch", "path", "lineNumber", "fkRule"
  const grouped = {};
  for (const finding of findings) {
    const { type } = finding;

    let identity = '';
    switch (type) {
      case 'sca':
        identity = parseScaIdentity(finding);
        break;
      case 'sast':
      default:
        identity = `${get(finding, 'lineNumber')}_${stripAllSpace(get(finding, 'lineContent'))}`;
    }
    const uniqueKey = `${finding.fkRepository}_${finding.branch}_${finding.fkRule}_${finding.path}_${type}_${identity}`;

    if (uniqueKey in grouped) {
      grouped[uniqueKey].push(finding);
    } else {
      grouped[uniqueKey] = [finding];
    }

    // temporary mark duplicatedWith with uniqueKey. final value will be set after accumulate all data set
    finding.duplicatedWith = uniqueKey;
  }

  // sort to make sure we can pick the best finding when deduplicate
  for (const key of Object.keys(grouped)) {
    // Note: Add extra sort() try to quick fix to achieve the de-duplication result consistent across multiple engines
    grouped[key].sort((a, b) => b.fkEngine - a.fkEngine);

    grouped[key].sort((a, b) => {
      if (a.filterReason === b.filterReason) {
        return hasLatestPatchedVersions(b, a) ? -1 : 1;
      }
      return a.filterReason - b.filterReason;
    });
  }

  // mark duplicatedWith to the input findings
  for (const finding of findings) {
    finding.duplicatedWith =
      grouped[finding.duplicatedWith].length > 1
        ? grouped[finding.duplicatedWith][0].idFinding
        : null;
  }

  const patch = [];
  for (const key of Object.keys(grouped)) {
    for (const dup of grouped[key]) {
      if (grouped[key].length > 1) {
        patch.push([dup.idEngineRun, dup.idFinding, grouped[key][0].idFinding]);
      }
    }
  }

  await updateEnginRunFindings(patch);

  return findings;
};

const groupFindingByRuleTitle = findings =>
  groupBy(findings, finding => finding.rule && finding.rule.title);

const isHashedLineContent = lineContent =>
  lineContent.substr(0, hashedLineContentPrefix.length) === hashedLineContentPrefix &&
  lineContent.length - hashedLineContentPrefix.length === 128;

// Note: From https://github.com/guardrailsio/worker/blob/873f6f96aa488d133562b55250f598ec59d5319e/src/helper/generateFindings/utils.js#L82
const hashedLineContentBuilder = salt => lineContent => {
  if (isHashedLineContent(lineContent)) {
    return lineContent;
  }
  const hash = crypto.createHmac('sha512', String(salt));
  const hashedLineContent = hash.update(stripAllSpace(lineContent)).digest('hex');
  return `${hashedLineContentPrefix}${hashedLineContent}`;
};

const hashLineContent = (lineContent, salt) => hashedLineContentBuilder(salt)(lineContent);

module.exports = {
  deDuplicatedFindings,
  modifyAllFindingWithFileRenameDiffs,
  modifyAllFindingWithHashLineContent,
  groupFindingByRuleTitle,
  extractImportantMetadataForSca,
  checkIsVulnerability,
  generateFixedValue,
  stripAllSpace,
  isHashedLineContent,
  hashLineContent,
  hashedLineContentBuilder
};
