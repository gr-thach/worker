module.exports = (engineReport) => {
  if (engineReport.output) {
      for (let i = 0; i < engineReport.output.length; i += 1) {
        const vulnerability = engineReport.output[i];
        const { ruleId } = vulnerability;
        if (ruleId) {
          // The engine returns this value for unexpected line items
          if (ruleId === 'noRuleId') {
            vulnerability.matchEngineFilterOut |= 1;
          }
          // NOTE: ignore rules 0004 (@stefan requirement)
          if (ruleId === 'security/disable-html-escape') {
            vulnerability.matchEngineFilterOut |= 1;
          }
          // remove per https://guardrails.slack.com/archives/GEATB853J/p1582543544021400
        }
      }
  } else {
    // engineReport.output = [];
  }
  return engineReport;
};
