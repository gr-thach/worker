const { wrapper, coreAxios } = require('./index');
const { env } = require('../../../config');

const findAccountById = async accountId => {
  const { data } = await coreAxios.get(`/accounts/${accountId}`, {
    params: { withRootAccountInfo: 1, withSubscription: env.ONPREMISE ? 0 : 1 }
  });
  return data;
};

module.exports = {
  findAccountById: wrapper(findAccountById)
};
