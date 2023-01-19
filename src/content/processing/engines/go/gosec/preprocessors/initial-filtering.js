let matchToFilterPath = [/\/?tests?\/?/i];

let whiteList = [];

let matchToFilterLineContent = [];

module.exports = (engineReport) => {
  let filteredOutput = [];

  for (let i = 0; i < engineReport.output.length; i++) {
    let finding = engineReport.output[i];
    let found = false;

    matchToFilterPath.forEach(function(element) {
      if (finding.location && finding.location.path && finding.location.path.match(element)) {
        found = true;
      }
    });

    let decodedLineContent;
    if (finding.metadata.lineContent) {
      decodedLineContent = finding.metadata.lineContent
        .replace(/\%27/g, '\'')
        .replace(/\%22/g, '"');
    }

    // Rule based filtering
    if (finding.ruleId) {
      // Potential file inclusion via variable
      if (finding.ruleId === 'G304' && decodedLineContent) {
        // Specifically reported false positives by zemanlx
        // if file, err = os.Open(fileName); err != nil {
        if (finding.location.path.match(/main\.go/i)) {
          if (decodedLineContent.match(/if file, err/i)) {
            found = true;
          }
        }
      }
    }

    // Add whitelist that works regardless of the above.
    whiteList.forEach(function(element) {
      if (finding.location.path.match(element)) {
        found = false;
      }
    });

    // File Matching was ok
    if (!found) {
      // Let's check if the lineContent is ok too.
      matchToFilterLineContent.forEach(function(element) {
        if (decodedLineContent.match(element)) {
          found = true;
        }
      });
      // If it made it this far, then we like it!
      if (!found) {
        filteredOutput.push(finding);
      }
    }
    finding.matchEngineFilterOut |= found;
  }
  // engineReport.output = filteredOutput;
  return engineReport;
};
