const matchToFilterPath = [
  /assets?\/?/i,
  /public\//i,
  /external\/?/i,
  /\/tests?\/?/i
];

const whiteList = [];

const matchToFilterLineContent = [
  // Todo: Check the lineContent for other variable strings before blacklisting.
  /dirname\(__FILE__\)/
];

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
