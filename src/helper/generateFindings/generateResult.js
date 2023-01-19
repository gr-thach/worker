const get = require('lodash/get');
const { getEngineRuleObjById } = require('../core-api/scanMappings');
const { extractImportantMetadataForSca } = require('../findings');

const generateResult = (
  listExistedFinding,
  listNewFinding,
  engineRulesFromEngine,
  customEngineRulesFromEngine,
  idEngineRun,
  idEngine,
  engine,
  ruleOverride
) => {
  const result = [];

  const allEngineRules = Object.values(engineRulesFromEngine);
  const allCustomEngineRules = Object.values(customEngineRulesFromEngine);

  for (const f of [...listExistedFinding, ...listNewFinding]) {
    const { isCustomRule } = f.metadata;

    const rule = isCustomRule
      ? getEngineRuleObjById(allCustomEngineRules, f.fkCustomEngineRule)
      : getEngineRuleObjById(allEngineRules, f.fkEngineRule);

    // Todo: Fallback to Rule Language Docs, and Rule Name
    const ruleTitle = rule.title ? rule.title : 'N/A';
    const ruleDocs = getRuleDocs(rule, engine, ruleOverride);

    result.push({
      ...f,
      rule: { title: ruleTitle, docs: ruleDocs },
      idEngineRun,
      fkEngine: idEngine,
      metadata: extractImportantMetadataForSca(f.metadata)
    });
  }

  return result;
};

const getRuleDocs = (rule, engine, ruleOverride) => {
  const engineNameWithLanguage = engine.isPrivate
    ? `${engine.language}-${engine.name}`
    : engine.name;

  const overridenDocsLink = get(ruleOverride, [
    'engineRules',
    engineNameWithLanguage,
    rule.name,
    'docs'
  ]);

  return overridenDocsLink || rule.docs || 'N/A';
};

module.exports = generateResult;
