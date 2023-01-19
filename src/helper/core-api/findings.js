/* eslint-disable no-await-in-loop */
const { wrapper, coreAxios } = require('./index');

const getAllFindingByEngine = async (idRepository, branch, idEngine) => {
  const { data } = await coreAxios.post(`/findings/getAllFindingByEngine`, {
    idRepository,
    branch,
    idEngine
  });
  return data;
};

const updateEnginRunFindings = async engineRunsFindings => {
  const chunkSize = 20;
  for (let c = 0, l = engineRunsFindings.length; c < l; c += chunkSize) {
    const chunk = engineRunsFindings.slice(c, c + chunkSize);
    await coreAxios.post('/findings/updateEnginRunFindingsDuplicatedWith', chunk);
  }
};

const getFindingByEngineRuns = async idEngineRuns => {
  const { data } = await coreAxios.post(`/findings/getFindingByEngineRuns`, { idEngineRuns });
  return data;
};

module.exports = {
  getAllFindingByEngine: wrapper(getAllFindingByEngine),
  updateEnginRunFindings: wrapper(updateEnginRunFindings),
  getFindingByEngineRuns: wrapper(getFindingByEngineRuns)
};
