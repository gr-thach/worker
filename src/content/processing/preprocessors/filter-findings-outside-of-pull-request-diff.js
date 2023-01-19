const lodashGet = require('lodash/get');

const { NOT_IN_PR_DIFFS } = require('../../../helper/filterReasonFlag');

const filterFindingsOutsideOfPullRequestDiff = (
  engineOutput,
  pullRequestDiffContent,
  reportRule
) => {
  const filepathsToIncludeInReport = [];
  const linesWithChanges = {};
  for (const fileDiff of pullRequestDiffContent) {
    if (fileDiff.to) {
      const filepath = fileDiff.to;
      filepathsToIncludeInReport.push(filepath);
      for (const chunk of fileDiff.chunks) {
        for (const change of chunk.changes) {
          if (change.type === 'add') {
            linesWithChanges[filepath] = linesWithChanges[filepath] || [0]; // default to always match with lineNumber=0
            linesWithChanges[filepath].push(parseInt(change.ln, 10));
          }
        }
      }
    }
  }

  for (let i = 0; i < engineOutput.output.length; i += 1) {
    const finding = engineOutput.output[i];
    const filepath = lodashGet(finding, 'location.path');
    const lineNumber = lodashGet(finding, 'location.positions.begin.line');

    let includeInReport = filepathsToIncludeInReport.indexOf(filepath) !== -1;

    if (includeInReport && reportRule === 'onChangedLinesOnly' && lineNumber) {
      includeInReport = !!(
        linesWithChanges[filepath] && linesWithChanges[filepath].includes(parseInt(lineNumber, 10))
      );
    }
    if (!includeInReport) {
      finding.filterReason |= NOT_IN_PR_DIFFS;
    }
  }

  return engineOutput;
};

module.exports = filterFindingsOutsideOfPullRequestDiff;
