const matchToFilterPath = [
  /\/?tests?\/?/i,
  /\/?static\//i,
  /\/?vendor\//i,
  /\/?node_modules\/?/i,
  /\/bootstrap?\//i,
  /\/jquery?\//i,
  /\/?.html\/?/i,
  /min\.js/i,
  /webpack\.config\./i
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

    let decodedLineContent;
    if (finding.metadata.lineContent) {
      decodedLineContent = finding.metadata.lineContent
        .replace(/\%27/g, '\'')
        .replace(/\%22/g, '"');
    }

    // Rule based filtering
    if (finding.ruleId) {
      // Potential file inclusion via variable
      if (finding.ruleId === 'Unescaped variable in Pug.js template file' && decodedLineContent && finding.location.path) {
        // Ignore results in json files
        if (finding.location.path.match(/\.json$/i)) {
          found = true;
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
