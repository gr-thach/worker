const lodashGet = require('lodash/get');
const ignore = require('ignore');

const { MATCH_IGNORE_FILE } = require('../../../helper/filterReasonFlag');

const filterFindingsMatchingIgnoreFile = (engineOutput = {}, ignoreFile) => {
  const ignoredFiles = ignore().add(ignoreFile);
  for (let i = 0; i < engineOutput.output.length; i += 1) {
    const finding = engineOutput.output[i];
    const filepath = lodashGet(finding, 'location.path');
    if (filepath) {
      const matchIgnore = ignoredFiles.ignores(filepath);
      if (matchIgnore) {
        finding.filterReason |= MATCH_IGNORE_FILE;
      }
    }
  }
};

module.exports = filterFindingsMatchingIgnoreFile;
