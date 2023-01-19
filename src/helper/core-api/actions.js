const { wrapper, coreAxios } = require('./index');

const queryActionsByRepositoryId = async repositoryId => {
  const { data } = await coreAxios.get(`/actions`, { params: { repositoryId } });
  return data;
};

module.exports = {
  queryActionsByRepositoryId: wrapper(queryActionsByRepositoryId)
};
