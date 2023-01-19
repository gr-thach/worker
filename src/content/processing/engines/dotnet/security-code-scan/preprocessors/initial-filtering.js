let matchToFilterPath = [
  /\/?assets?\/?/i,
  /\/?public\//i,
  /\/?tests?\/?/i,
  /\/?external\/?/i
];

let whiteList = [];

let matchToFilterLineContent = [];

module.exports = (engineReport) => {
  let filteredOutput = [];

  for (let i = 0; i < engineReport.output.length; i++) {
    let finding = engineReport.output[i];
    let found = false;

    matchToFilterPath.forEach(function(element) {
      if (finding.location.path.match(element)) {
        found = true;
      }
    });

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
        if (finding.metadata.lineContent.match(element)) {
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
