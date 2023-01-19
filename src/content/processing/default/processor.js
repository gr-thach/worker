/* eslint-disable no-param-reassign */
const lodashGet = require('lodash/get');
const { mapMetadataToSeverityId } = require('../../../helper/severity');

const processFindings = (
  findings,
  engineRulesFromEngine,
  customEngineRulesFromEngine,
  toolName,
  config,
  language,
  key
) => {
  const findingsByGrId = {};
  if (!findings || !findings.length) {
    return findingsByGrId;
  }
  findings.forEach(finding => {
    
    const isCustomEngineRule = !!finding.metadata.isCustomRule;
    const { ruleId } = finding;

    const engineRule = lodashGet(
      isCustomEngineRule ? customEngineRulesFromEngine : engineRulesFromEngine,
      `${ruleId}`,
      {}
    );
    let grId = engineRule.rule;

    // Todo: Add better logging to alert us in these cases.
    if (!grId) return;

    const {
      grRuleEnabled,
      grRuleEnabledForLanguage,
      engineRuleEnabled
    } = getRuleOverridesForFinding(config, language, toolName, grId, finding.ruleId);
    
    if (key === "output" && (!grRuleEnabled || !engineRuleEnabled || !grRuleEnabledForLanguage)) return;

    finding.engineRule = engineRule.id;
    finding.fkCustomEngineRule = isCustomEngineRule ? engineRule.id : null;
    finding.fkEngineRule = isCustomEngineRule ? null : engineRule.id;
    finding.fkSeverity = mapMetadataToSeverityId(finding.metadata, finding.type, engineRule);
    finding.rule = engineRule.fkRule;
    finding.language = language;
    finding.location.path = `/${finding.location.path}`;

    findingsByGrId[grId] = findingsByGrId[grId] || [];
    if (isCustomEngineRule) {
      findingsByGrId[grId].unshift(finding);
    } else {
      findingsByGrId[grId].push(finding);
    }
  });

  return findingsByGrId;
};

const defaultProcessor = (
  engineOutput,
  toolName,
  config,
  engineRulesFromEngine,
  customEngineRulesFromEngine
) => {
  const [
  vulnerabilitiesByGrId, 
  notInMappingByGrId, 
  onDisabledLinesByGrId, 
  notInPRDiffsByGrId, 
  matchIgnoreFileByGrId
] = ['output', 'notInMapping', 'onDisabledLines', 'notInPRDiffs', 'matchIgnoreFile'].map(key => 
  processFindings(
    engineOutput[key],
    engineRulesFromEngine,
    customEngineRulesFromEngine,
    toolName,
    config,
    engineOutput.language,
    key
  )
);

  return {
    vulnerabilitiesByGrId,
    notInMappingByGrId,
    onDisabledLinesByGrId,
    notInPRDiffsByGrId,
    matchIgnoreFileByGrId
  };
};

const getRuleOverridesForFinding = (config, language, toolName, grId, ruleId) => {
  const { enable: grRuleEnabled = true, languages } = lodashGet(
    config,
    `ruleOverride.GuardRailsRules.${grId}`,
    {}
  );
  const grRuleEnabledForLanguage = lodashGet(languages, language, true);
  const { enable: engineRuleEnabled = true } = lodashGet(
    config,
    `ruleOverride.engineRules[${language}-${toolName}][${ruleId}]`,
    {}
  );
  return { grRuleEnabled, grRuleEnabledForLanguage, engineRuleEnabled };
};

module.exports = { defaultProcessor, getRuleOverridesForFinding };
