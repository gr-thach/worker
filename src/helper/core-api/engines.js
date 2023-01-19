const lodashGet = require('lodash/get');

const redis = require('../../services/redis');
const { wrapper, gql, coreAxios } = require('./index');

const getEngines = async () => {
  const cached = await redis.get(redis.keys.ENGINES_DB_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  const query = gql`
    query {
      engines(condition: { enable: true, deletedAt: null }) {
        nodes {
          idEngine
          fkAccount
          name
          language
          allowFor
          isPrivate
          version
          account: accountByFkAccount {
            login
            provider
            providerMetadata
          }
          diffSupported
          triggerFiles
          type
        }
      }
    }
  `;
  const { data } = await coreAxios.post(`/graphql`, { query });
  const result = lodashGet(data, 'data.engines.nodes', []);
  await redis.set(redis.keys.ENGINES_DB_KEY, JSON.stringify(result));
  return result;
};

const getEngineAccountConfig = async (engineId, accountId) => {
  const variables = {
    accountId,
    engineId
  };

  const query = gql`
    query($accountId: Int!, $engineId: Int!) {
      engineAccountConfigs(
        condition: { fkAccount: $accountId, fkEngine: $engineId, deletedAt: null }
      ) {
        nodes {
          accountId: fkAccount
          rules
          envVars
          spec: engineConfigSpecByFkEngineConfigSpec {
            filename
            validation
            validator
          }
        }
      }
    }
  `;

  const { data } = await coreAxios.post(`/graphql`, { query, variables });
  return lodashGet(data, 'data.engineAccountConfigs.nodes[0]');
};

const getHelperEngines = async () => {
  const cached = await redis.get(redis.keys.ENGINES_HELPER_DB_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  const query = gql`
    query {
      helperEngines(condition: { enable: true, deletedAt: null }) {
        nodes {
          idEngine
          name
          version
          type
        }
      }
    }
  `;
  const { data } = await coreAxios.post(`/graphql`, { query });
  const result = lodashGet(data, 'data.helperEngines.nodes', []);
  await redis.set(redis.keys.ENGINES_HELPER_DB_KEY, JSON.stringify(result));
  return result;
};

module.exports = {
  getEngines: wrapper(getEngines),
  getEngineAccountConfig: wrapper(getEngineAccountConfig),
  getHelperEngines: wrapper(getHelperEngines)
};
