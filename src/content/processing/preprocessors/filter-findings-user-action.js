const { checkIsVulnerability } = require('../../../helper/findings');
const {
  IS_USER_ACTION_SET,
  USER_ACTION_FALSE_POSITIVE
} = require('../../../helper/filterReasonFlag');

// Note: from https://github.com/guardrailsio/worker/blob/873f6f96aa488d133562b55250f598ec59d5319e/src/helper/findingStatus.js#L82
const filterUserAction = (engineOutput = {}) => {
  for (let i = 0; i < engineOutput.output.length; i += 1) {
    const finding = engineOutput.output[i];

    const { userAction } = finding;
    if (userAction !== null) {
      const isVulnerability = checkIsVulnerability(userAction);
      finding.filterReason |= isVulnerability
        ? IS_USER_ACTION_SET
        : IS_USER_ACTION_SET | USER_ACTION_FALSE_POSITIVE;
    }
  }
};

module.exports = filterUserAction;
