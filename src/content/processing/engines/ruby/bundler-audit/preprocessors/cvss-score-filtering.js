const { env } = require('../../../../../../../config');
const REPORT_MINIMUM_SCORE = 5;
module.exports = (engineReport) => {
  if (engineReport.output) {
    for (let i = 0; i < engineReport.output.length; i += 1) {
      const vulnerability = engineReport.output[i];
      if (
        vulnerability &&
        vulnerability.metadata &&
        vulnerability.metadata.cvssScore
      ) {
        const result = vulnerability.metadata.cvssScore >= REPORT_MINIMUM_SCORE;
        vulnerability.matchEngineFilterOut |= !result;
      }
    };
  } else {
    // engineReport.output = [];
  }
  return engineReport;
};