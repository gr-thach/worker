const matchToFilterPath = [
  /tests?\/?/i,
  /(dummy|debug|demo|sample|example)\//i,
];

const whiteList = [];

const matchToFilterLineContent = [];

const file_and_content_filter = {};

module.exports = (engineReport) => {
  const filteredOutput = [];

  for (let i = 0; i < engineReport.output.length; i++) {
    const finding = engineReport.output[i];
    let found = false;

    matchToFilterPath.forEach(function (element) {
      if (finding.location.path.match(element)) {
        found = true;
      }
    });

    // Add whitelist that works regardless of the above.
    whiteList.forEach(function (element) {
      if (finding.location.path.match(element)) {
        found = false;
      }
    });

    // File Matching was ok
    if (!found) {
      if (finding && finding.metadata && finding.metadata.lineContent) {
        const lineContent = finding.metadata.lineContent
          .replace(/\%27/g, '\'')
          .replace(/\%22/g, '"');
        // Let's check if the lineContent is ok too.
        matchToFilterLineContent.forEach(function (element) {
          if (lineContent.match(element)) {
            found = true;
          }
        });

        if (!found && finding.location.path in file_and_content_filter) {
          file_and_content_filter[finding.location.path].forEach(function (
            element
          ) {
            if (lineContent.match(element)) {
              found = true;
            }
          });
        }
        // Improve false positives for Secret Keyword
        if (!found && finding.ruleId && finding.ruleId.match(/GEN00[1-3]/)){
          if (lineContent.match(/secrets?manager/i)) {
            found = true;
          }
          if (!found && lineContent.match(/arn/i)) {
            found = true;
          }
          if (!found && lineContent.match(/=\s*(var\.|module\.)/i)) {
            found = true;
          }
          if (!found && lineContent.match(/(=|:|:=|==|===|=>)+\s*(''|""|" "|' '|)/i)) {
            found = true;
          }
          if(finding.metadata && 
            finding.metadata.description &&
            finding.metadata.description.match(/path/i)){
            found = true;
          }
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
