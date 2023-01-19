const { env } = require('../../../../../../../config');
const REPORT_ON_SEVERITY = ['high', 'critical', 'medium'];

module.exports = (engineReport) => {
  if (engineReport.output) {
    for (let i = 0; i < engineReport.output.length; i += 1) {
      const vulnerability = engineReport.output[i];
      if (
        vulnerability &&
        vulnerability.metadata &&
        vulnerability.metadata.severity
      ) {
        const keep = REPORT_ON_SEVERITY.includes(vulnerability.metadata.severity);
        vulnerability.matchEngineFilterOut |= !keep;
      } else {
        vulnerability.matchEngineFilterOut |= 1;
      }
    };
  } else {
    // engineReport.output = [];
  }
  return engineReport;
};
