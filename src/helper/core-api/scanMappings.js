const lodashGet = require('lodash/get');

const redis = require('../../services/redis');
const { wrapper, gql, coreAxios, getObjByAttribute, getFieldByAttribute } = require('./index');

const getAllScanStatusNameIdMapping = async () => {
  const cached = await redis.get(redis.keys.SCAN_STATUS_NAME_MAPPING_DB_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  const query = `query { scanStatuses (condition: { deletedAt: null }) { nodes { idScanStatus, name } } }`;
  const { data } = await coreAxios.post(`/graphql`, { query });
  const result = lodashGet(data, 'data.scanStatuses.nodes', []).reduce(
    (r, e) => ({ ...r, [e.name]: e.idScanStatus }),
    {}
  );
  await redis.set(redis.keys.SCAN_STATUS_NAME_MAPPING_DB_KEY, JSON.stringify(result));
  return result;
};

const getAllScanResultNameIdMapping = async () => {
  const cached = await redis.get(redis.keys.SCAN_RESULT_NAME_MAPPING_DB_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  const query = `query { scanResults (condition: { deletedAt: null }) { nodes { idScanResult, name } } }`;
  const { data } = await coreAxios.post(`/graphql`, { query });
  const result = lodashGet(data, 'data.scanResults.nodes', []).reduce(
    (r, e) => ({ ...r, [e.name]: e.idScanResult }),
    {}
  );
  await redis.set(redis.keys.SCAN_RESULT_NAME_MAPPING_DB_KEY, JSON.stringify(result));
  return result;
};

const getAllEngineRule = async () => {
  const cached = await redis.get(redis.keys.ENGINE_RULES_DB_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  const query = gql`
    query {
      engineRules(condition: { deletedAt: null }) {
        nodes {
          idEngineRule
          name
          title
          docs
          enable
          fkEngine
          fkRule
          cvssSeverity
          ruleByFkRule {
            name
            title
            docs
            enable
          }
        }
      }
    }
  `;
  const { data } = await coreAxios.post(`/graphql`, { query });
  const result = lodashGet(data, 'data.engineRules.nodes', []).reduce(
    (r, e) => [
      ...r,
      {
        id: e.idEngineRule,
        name: e.name,
        enable: e.enable,
        fkEngine: e.fkEngine,
        idEngine_name: `${e.fkEngine}_${e.name}`,
        fkRule: e.fkRule,
        rule: e.ruleByFkRule ? e.ruleByFkRule.name : null,
        docs: e.docs || (e.ruleByFkRule && e.ruleByFkRule.docs) || null,
        title: (e.ruleByFkRule && e.ruleByFkRule.title) || null, // always use GrRule title https://guardrails.slack.com/archives/CTK7BAA5T/p1601545940019500
        ruleEnable: e.ruleByFkRule ? e.ruleByFkRule.enable : false,
        engineRuleTitle: e.title,
        ruleDocs: (e.ruleByFkRule && e.ruleByFkRule.docs) || null,
        cvssSeverity: e.cvssSeverity
      }
    ],
    []
  );

  await redis.set(redis.keys.ENGINE_RULES_DB_KEY, JSON.stringify(result));
  return result;
};

const getAllCustomEngineRules = async accountId => {
  const query = gql`
    query($accountId: Int!) {
      customEngineRules(condition: { fkAccount: $accountId, deletedAt: null }) {
        nodes {
          idCustomEngineRule
          name
          title
          docs
          enable
          fkEngine
          fkRule
          fkAccount
          cvssSeverity
          grSeverity
          ruleByFkRule {
            name
            title
            docs
            enable
          }
        }
      }
    }
  `;

  const variables = {
    accountId
  };

  const { data } = await coreAxios.post(`/graphql`, { query, variables });
  return lodashGet(data, 'data.customEngineRules.nodes', []).reduce(
    (result, e) => [
      ...result,
      {
        id: e.idCustomEngineRule,
        name: e.name,
        enable: e.enable,
        fkEngine: e.fkEngine,
        fkAccount: e.fkAccount,
        idEngine_name: `${e.fkEngine}_${e.name}`,
        fkRule: e.fkRule,
        rule: e.ruleByFkRule ? e.ruleByFkRule.name : null,
        docs: e.docs || (e.ruleByFkRule && e.ruleByFkRule.docs) || null,
        title: (e.ruleByFkRule && e.ruleByFkRule.title) || null, // always use GrRule title https://guardrails.slack.com/archives/CTK7BAA5T/p1601545940019500
        ruleEnable: e.ruleByFkRule ? e.ruleByFkRule.enable : false,
        engineRuleTitle: e.title,
        ruleDocs: (e.ruleByFkRule && e.ruleByFkRule.docs) || null,
        cvssSeverity: e.cvssSeverity,
        grSeverity: e.grSeverity
      }
    ],
    []
  );
};

const getAllEngineRunStatus = async () => {
  const cached = await redis.get(redis.keys.ENGINE_RUN_STATUS_DB_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  const query = `query { engineRunStatuses (condition: { deletedAt: null }) { nodes { idEngineRunStatus, name } } }`;
  const { data } = await coreAxios.post(`/graphql`, { query });
  const result = lodashGet(data, 'data.engineRunStatuses.nodes', []).reduce(
    (r, e) => [...r, { id: e.idEngineRunStatus, name: e.name }],
    []
  );
  await redis.set(redis.keys.ENGINE_RUN_STATUS_DB_KEY, JSON.stringify(result));
  return result;
};

const getAllSeverity = async () => {
  const cached = await redis.get(redis.keys.SEVERITY_DB_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  const query = `query { severities (condition: { deletedAt: null }) { nodes { idSeverity, name } } }`;
  const { data } = await coreAxios.post(`/graphql`, { query });
  const result = lodashGet(data, 'data.severities.nodes', []).reduce(
    (r, e) => [...r, { id: e.idSeverity, name: e.name }],
    []
  );
  await redis.set(redis.keys.SEVERITY_DB_KEY, JSON.stringify(result));
  return result;
};

const getEngineRuleObjById = (data, v) => getObjByAttribute(data, 'id', v);

const getAllEngineRulesGroupByName = (data, v) =>
  data.filter(x => x.fkEngine === v).reduce((r, e) => ({ ...r, [e.name]: e }), {});

const getIdByName = (data, v) => getFieldByAttribute(data, 'name', v, 'id');

module.exports = {
  getIdByName,
  getEngineRuleObjById,
  getAllEngineRulesGroupByName,
  getAllScanStatusNameIdMapping: wrapper(getAllScanStatusNameIdMapping),
  getAllScanResultNameIdMapping: wrapper(getAllScanResultNameIdMapping),
  getAllEngineRule: wrapper(getAllEngineRule),
  getAllEngineRunStatus: wrapper(getAllEngineRunStatus),
  getAllSeverity: wrapper(getAllSeverity),
  getAllCustomEngineRules: wrapper(getAllCustomEngineRules)
};
