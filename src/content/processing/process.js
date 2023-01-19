const normalizeEngineOutput = require('./normalizeEngineOutput');
const filterByEngines = require('./engineFilter');
const filterByConfigAndRules = require('./configAndRuleFilter');

// Note: this processor() has side affect
// it will run through some engine-filter and config/rule-filter check
// then will add to engineOutputs filterReason attribute (and some others). refer to src/helper/filterReasonFlag.js
const processor = ({
  engineOutputs,
  engineRules,
  customEngineRules,
  engineName,
  engineLanguage,
  pullRequestDiffContent,
  config,
  scanType,
  actions,
  hashLineContentFn
}) => {
  // engine name without language prefix
  const pureEngineName = engineName.replace(`${engineLanguage}-`, '');

  // add some extra attributes to engineOutputs which require in processing and create findings in later stage
  normalizeEngineOutput(
    engineOutputs,
    engineLanguage,
    engineRules,
    customEngineRules,
    actions,
    hashLineContentFn
  );

  filterByEngines(engineOutputs, pureEngineName, engineLanguage);

  filterByConfigAndRules(
    engineOutputs,
    pullRequestDiffContent,
    config,
    scanType,
    engineLanguage,
    pureEngineName,
    actions
  );
};

module.exports = processor;
