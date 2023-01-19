const { wrapper, coreAxios } = require('./index');

const getRepositoriesAncestorAndChildById = async repositoryId => {
  const { data } = await coreAxios.post('/v2/repositories/getAncestorAndDescendantById', {
    descendant: 1,
    ancestor: -1, // get all parents
    repositoryId
  });
  return data;
};

module.exports = {
  getRepositoriesAncestorAndChildById: wrapper(getRepositoriesAncestorAndChildById)
};
