const lodashGet = require('lodash/get');

const { DISABLED_RULE } = require('../../../helper/filterReasonFlag');

// Note: from https://github.com/guardrailsio/worker/blob/873f6f96aa488d133562b55250f598ec59d5319e/src/content/processing/default/processor.js#L99
const filterRuleOverride = (engineOutput = {}, config, engineLanguage, engineName) => {
  for (let i = 0; i < engineOutput.output.length; i += 1) {
    const finding = engineOutput.output[i];
    const { engineRuleEnabled, ruleEnabled, ruleName } = finding;

    const { overrideGrRuleEnabled, overrideEngineRuleEnabled } = getRuleOverridesForFinding(
      config,
      engineLanguage,
      engineName,
      ruleName,
      finding.ruleId
    );

    if (
      !ruleName ||
      (!ruleEnabled && overrideGrRuleEnabled !== true) ||
      (ruleEnabled && overrideGrRuleEnabled === false) ||
      (!engineRuleEnabled && overrideEngineRuleEnabled !== true) ||
      (engineRuleEnabled && overrideEngineRuleEnabled === false)
    ) {
      finding.filterReason |= DISABLED_RULE;
    }
  }
};

const getRuleOverridesForFinding = (config, language, toolName, grId, ruleId) => {
  const { enable: overrideGrRuleEnabled } = lodashGet(
    config,
    `ruleOverride.GuardRailsRules.${grId}`,
    {}
  );
  const { enable: overrideEngineRuleEnabled } = lodashGet(
    config,
    `ruleOverride.engineRules[${language}-${toolName}][${ruleId}]`,
    {}
  );
  return { overrideGrRuleEnabled, overrideEngineRuleEnabled };
};

module.exports = filterRuleOverride;
