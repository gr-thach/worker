const REPORT_ON_SEVERITY = ['High', 'Critical'];

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
      }

      if (
        vulnerability &&
        vulnerability.metadata &&
        vulnerability.metadata.cvssAccessVector
      ) {
        const keep = vulnerability.metadata.cvssAccessVector === 'NETWORK';
        vulnerability.matchEngineFilterOut |= !keep;
      }

      if (
        vulnerability &&
        vulnerability.metadata &&
        vulnerability.metadata.cpeConfidence
      ) {
        const keep = vulnerability.metadata.cpeConfidence === 'High';
        vulnerability.matchEngineFilterOut |= !keep;
      }
    };

    // This creates a new output array that only keeps the highest severity dependency
    // Should work for mono-repos as well.
    let modOutput = [];
    for (let j = 0; j < engineReport.output.length; j += 1) {
      const item = engineReport.output[j];
      if (modOutput.length == 0) {
        modOutput.push(item);
      } else {
        let found = false;
        for (var i = 0; i < modOutput.length; i++) {
          if (
            modOutput[i].location.path === item.location.path &&
            modOutput[i].metadata.dependencyName ===
              item.metadata.dependencyName
          ) {
            // If same location/dependency exists, but the cvssScore is lower
            // replace the element with the new one.
            if (
              modOutput[i].metadata.cvssScore &&
              modOutput[i].metadata.cvssScore < item.metadata.cvssScore
            ) {
              modOutput[i].matchEngineFilterOut |= 1;
              modOutput[i] = item;
            }
            // If the item was found, then we can skip the rest of the loop
            found = true;
            break;
          } else {
            item.matchEngineFilterOut |= 1;
          }
        }
        if (!found) modOutput.push(item);
      }
    };
    // engineReport.output = modOutput;
  } else {
    // engineReport.output = [];
  }
  return engineReport;
};
