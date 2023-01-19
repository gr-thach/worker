const lodashUniq = require('lodash/uniq');

const getChangedFilePathInDiffs = diffs =>
  lodashUniq(diffs.map(d => [d.from, d.to]).flat()).filter(x => x && x !== '/dev/null');

module.exports = {
  getChangedFilePathInDiffs
};
