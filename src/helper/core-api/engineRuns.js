const lodashGet = require('lodash/get');
const { v4: uuid } = require('uuid');

const { wrapper, gql, coreAxios } = require('./index');

const updateEngineRunStatus = async (idEngineRun, patch) => {
  await coreAxios.post(`/findings/updateEngineRunStatus`, { idEngineRun, patch });
};

const getOrCreateEngineRunsFromScan = async (idScan, engines, fkEngineRunStatus) => {
  const now = new Date().toJSON();
  const existedEngine = await getEngineRunsByScanId(idScan);
  const notExistedEngines = engines.filter(
    ({ idEngine, rootPath }) =>
      !existedEngine.find(existed => existed.fkEngine === idEngine && existed.rootPath === rootPath)
  );

  const query = gql`
    mutation updateScan($idScan: UUID!, $create: [EngineRunsFkScanFkeyEngineRunsCreateInput!]) {
      updateScan(input: { idScan: $idScan, patch: { engineRuns: { create: $create } } }) {
        scan {
          engineRunsByFkScan {
            nodes {
              idEngineRun
              fkEngine
              engineRunStatus: engineRunStatusByFkEngineRunStatus {
                name
              }
              rootPath
            }
          }
        }
      }
    }
  `;
  const variables = {
    idScan,
    create: notExistedEngines.map(({ idEngine: fkEngine, rootPath }) => ({
      idEngineRun: uuid(),
      createdAt: now,
      fkEngine,
      fkEngineRunStatus,
      rootPath
    }))
  };
  const { data } = await coreAxios.post(`/graphql`, { query, variables });
  const allEngineRuns = lodashGet(data, 'data.updateScan.scan.engineRunsByFkScan.nodes', []);
  return allEngineRuns.map(engineRun =>
    !existedEngine.find(
      existed => existed.fkEngine === engineRun.fkEngine && existed.rootPath === engineRun.rootPath
    )
      ? engineRun
      : {
          ...engineRun,
          success: engineRun.engineRunStatus && engineRun.engineRunStatus.name === 'success'
        }
  );
};

const getEngineRunsByScanId = async idScan => {
  const query = gql`
    query($idScan: UUID!) {
      engineRuns(condition: { fkScan: $idScan }) {
        nodes {
          fkEngine
          rootPath
        }
      }
    }
  `;

  const variables = { idScan };
  const { data } = await coreAxios.post(`/graphql`, { query, variables });
  return lodashGet(data, 'data.engineRuns.nodes', []);
};

const getSuccessEngineRunsBySha = async sha => {
  if (!sha) {
    return null;
  }
  const { data } = await coreAxios.get(`/engineRuns/getSuccessEngineRunBySha/${sha}`);
  return data;
};

const getSuccessEngineRunsByShaAndRepositoryId = async (sha, repositoryId) => {
  if (!sha) {
    return null;
  }
  const { data } = await coreAxios.get(
    `/engineRuns/getSuccessEngineRunByShaAndRepositoryId/?sha=${sha}&repositoryId=${repositoryId}`
  );
  return data;
};

const getEngineRunOfEngineFromShaList = async (
  shaList,
  idRepository,
  idEngine,
  rootPath,
  limit
) => {
  const { data } = await coreAxios.post(`/engineRuns/getEngineRunOfEngineFromShaList`, {
    shaList,
    idRepository,
    idEngine,
    rootPath,
    limit
  });

  return data;
};

module.exports = {
  updateEngineRunStatus: wrapper(updateEngineRunStatus),
  getOrCreateEngineRunsFromScan: wrapper(getOrCreateEngineRunsFromScan),
  getEngineRunsByScanId: wrapper(getEngineRunsByScanId),
  getSuccessEngineRunsBySha: wrapper(getSuccessEngineRunsBySha),
  getSuccessEngineRunsByShaAndRepositoryId: wrapper(getSuccessEngineRunsByShaAndRepositoryId),
  getEngineRunOfEngineFromShaList: wrapper(getEngineRunOfEngineFromShaList)
};
