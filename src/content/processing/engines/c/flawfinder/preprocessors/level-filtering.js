const { env } = require('../../../../../../../config');
const REPORT_MINIMUM_SCORE = env.ENVIRONMENT === 'production' ? 3 : 0;

module.exports = (engineReport) => {
  if (engineReport.output) {
    for (let i = 0; i < engineReport.output.length; i += 1) {
      const vulnerability = engineReport.output[i];
      let keep_finding = false;
      if (
        vulnerability &&
        vulnerability.metadata &&
        vulnerability.metadata.level
      ) {
        keep_finding = parseInt(vulnerability.metadata.level, 10) >= REPORT_MINIMUM_SCORE
      }
      if (
        vulnerability &&
        vulnerability.metadata &&
        vulnerability.metadata.name &&
        keep_finding) {
        if (vulnerability.ruleId === "misc"){
          if (vulnerability.metadata.name.toUpperCase() !== "SetSecurityDescriptorDacl".toUpperCase()){
            keep_finding = false;
          }
        } else if (vulnerability.ruleId === "tmpfile") {
          if (vulnerability.metadata.name.toUpperCase() !== "mktemp".toUpperCase()){
            keep_finding = false;
          }
        }
      }
      vulnerability.matchEngineFilterOut |= !keep_finding;
    }
  } else {
    // engineReport.output = [];
  }
  return engineReport;
};
