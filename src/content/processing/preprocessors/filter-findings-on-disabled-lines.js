const { DISABLED_LINE } = require('../../../helper/filterReasonFlag');

const filterFindingsOnDisabledLines = (engineOutput = {}) => {
  for (let i = 0; i < engineOutput.output.length; i += 1) {
    const finding = engineOutput.output[i];
    const lineIsDisabled =
      finding.metadata &&
      finding.metadata.lineContent &&
      finding.metadata.lineContent.match(/guardrails-disable-line/);
    if (lineIsDisabled) {
      finding.filterReason |= DISABLED_LINE;
    }
  }
};

module.exports = filterFindingsOnDisabledLines;
