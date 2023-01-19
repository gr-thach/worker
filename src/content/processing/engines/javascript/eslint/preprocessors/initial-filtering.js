let matchToFilterPath = [
  /\/?public\//i,
  /bower_components\//i,
  /\/?assets?\/?/i,
  /\/bootstrap?\//i,
  /\/jquery?\//i,
  /\/?frontend\//i,
  /\/?deps\/?/i,
  /\/?docs?\//i,
  /\/?third.?party?\//i,
  /\/?tests?\/?/i,
  /\/?static\//i,
  /\/?vendor\//i,
  /\/?jekyll\//i,
  /\/?dist\//i,
  /webpack\//i,
  /css/i,
  /lib\//i,
  /\/?specs?\//,
  /\/?packages?\//i,
  /browser\.js$/i,
  /benchmarks\//i,
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
      // Let's check for certain false positive cases
      // Reported by Grainbridge
      if (finding.ruleId === "security/detect-non-literal-require") {
        if (finding.metadata.lineContent.match(/require\s*\(\s*appPackageJson.*\)/) ||
            finding.metadata.lineContent.match(/require\s*\(\s*paths.*\)/) ||
            finding.metadata.lineContent.match(/require\s*\(\s*\[[a-zA-Z0-9_,"' -]*\]/) ||
            finding.metadata.lineContent.match(/require\s*\(\s*resolve\.sync\(/)) {
              found = true;
        }
      } else if (finding.ruleId === "security/detect-child-process"){
        if (finding.location.path.match(/.*react\-structured\-filter\.js/)){
          found = true;
        }
      }
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
