const lodashGet = require('lodash/get');

const { mapMetadataToSeverityId } = require('../../helper/severity');
const { getActionFindingStatus } = require('../../helper/findingStatus');

// Note: from https://github.com/guardrailsio/worker/blob/873f6f96aa488d133562b55250f598ec59d5319e/src/content/processing/default/processor.js#L42
const normalizeEngineOutput = (
  engineOutput,
  engineLanguage,
  engineRules,
  customEngineRules,
  actions,
  hashLineContentFn
) => {
  if (!engineOutput.output) {
    engineOutput.output = [];
  }

  // debug engine lineNumber isNaN
  const engineName = lodashGet(engineOutput, 'engine.name')
  let debugLineNumber = []

  for (let i = 0; i < engineOutput.output.length; i += 1) {
    const finding = engineOutput.output[i];

    const isCustomEngineRule = lodashGet(finding, 'metadata.isCustomRule', false);

    const engineRule = lodashGet(
      isCustomEngineRule ? customEngineRules : engineRules,
      `${finding.ruleId}`,
      {}
    );

    finding.engineRule = engineRule.id;
    finding.engineRuleEnabled = engineRule.enable;
    finding.isCustomEngineRule = isCustomEngineRule;
    finding.fkCustomEngineRule = isCustomEngineRule ? engineRule.id : null;
    finding.fkEngineRule = isCustomEngineRule ? null : engineRule.id;
    finding.fkSeverity = mapMetadataToSeverityId(finding.metadata, finding.type, engineRule);
    finding.rule = engineRule.fkRule;
    finding.ruleName = engineRule.rule;
    finding.ruleEnabled = engineRule.ruleEnable;
    finding.language = lodashGet(finding.metadata, 'language', engineLanguage);
    finding.filterReason = 0;
    finding.matchEngineFilterOut = 0;

    // Note: From https://github.com/guardrailsio/worker/blob/873f6f96aa488d133562b55250f598ec59d5319e/src/helper/generateFindings/utils.js#L92
    finding.type = lodashGet(finding, 'type', '');
    finding.path = lodashGet(finding, 'location.path', '');
    finding.lineNumber = parseInt(lodashGet(finding, 'location.positions.begin.line', 0), 10);

    if (isNaN(finding.lineNumber)) {
      debugLineNumber.push(JSON.stringify(engineOutput.output[i])); // debug engine lineNumber isNaN
      finding.lineNumber = 0; // fallback
    }

    finding.lineContent = lodashGet(finding.metadata, 'lineContent', '');
    if (finding.type === 'secret' && finding.lineContent) {
      finding.lineContent = hashLineContentFn(finding.lineContent);
    }
    if (finding.type === 'sca' && !lodashGet(finding.metadata, 'patchedVersions')) {
      finding.metadata.patchedVersions = '<0.0.0';
    }

    const { dependencyName, currentVersion } = finding.metadata;
    finding.userAction = getActionFindingStatus(
      {
        path: finding.path,
        lineNumber: finding.lineNumber,
        fkRule: finding.rule,
        lineContent: finding.lineContent,
        dependencyName,
        currentVersion
      },
      actions
    );
  }

  // debug engine lineNumber isNaN
  if (debugLineNumber.length) {
    console.warn(`[engine NaN lineNumber ${engineName}]`, debugLineNumber);
  }
};

module.exports = normalizeEngineOutput;
