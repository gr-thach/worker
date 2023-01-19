const lodashGet = require('lodash/get');

const { IS_DUPLICATED } = require('../../../helper/filterReasonFlag');

// Note: from https://github.com/guardrailsio/worker/blob/873f6f96aa488d133562b55250f598ec59d5319e/src/content/processing/postprocess.js#L4
const fitlerFindingsHasDuplicatedPathAndLineNumber = (engineOutput = {}) => {
  const duplicatedGroup = {};
  for (let i = 0; i < engineOutput.output.length; i += 1) {
    const finding = engineOutput.output[i];
    const {ruleName, filterReason } = finding;

    if (ruleName !== 'GR0013') {
      const path = lodashGet(finding, 'location.path');
      const line = lodashGet(finding, 'location.positions.begin.line');
      if (line) {
        const key = `${ruleName}_${path}_${line}`;
        if (!duplicatedGroup[key]) {
          duplicatedGroup[key] = [i];
        } else {
          // add into group in filterReason priority order
          if (filterReason === 0) {
            duplicatedGroup[key].unshift(i)
          } else {
            duplicatedGroup[key].push(i)
          }
        }
      }
    }
  }

  // mark IS_DUPLICATED for all groups
  for (const ids of Object.values(duplicatedGroup)) {
    for (let i = 1; i < ids.length; i += 1) {
      engineOutput.output[ids[i]].filterReason |= IS_DUPLICATED;
    }
  }
};

module.exports = fitlerFindingsHasDuplicatedPathAndLineNumber;
