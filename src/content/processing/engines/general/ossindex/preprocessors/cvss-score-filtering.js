const REPORT_ON_SEVERITY = ['High', 'Critical', 'Medium'];

module.exports = (engineReport) => {
  if (engineReport.output) {
    for (let i = 0; i < engineReport.output.length; i+= 1) {
      const vulnerability = engineReport.output[i];
      if (
        vulnerability &&
        vulnerability.metadata &&
        vulnerability.metadata.cvssSeverity
      ) {
        const keep = REPORT_ON_SEVERITY.includes(vulnerability.metadata.cvssSeverity);
        vulnerability.matchEngineFilterOut |= !keep;
      }
      // Filter all local attack vectors
      if (
        vulnerability &&
        vulnerability.metadata &&
        vulnerability.metadata.cvssVector
      ) {
        const keep = vulnerability.metadata.cvssVector.match(/AV:N/);
        vulnerability.matchEngineFilterOut |= !keep;
      }
      // Stefan: Not present in the output at the moment
      // if (
      //   vulnerability &&
      //   vulnerability.metadata &&
      //   vulnerability.metadata.cpeConfidence
      // ) {
      //   return vulnerability.metadata.cpeConfidence === 'High';
      // }
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
            } else {
              item.matchEngineFilterOut |= 1;
            }
            // If the item was found, then we can skip the rest of the loop
            found = true;
            break;
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
