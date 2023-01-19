const axios = require('axios');
const axiosRetry = require('axios-retry');
const lodashGet = require('lodash/get');
const nr = require('newrelic');

const CoreApiError = require('../../errors/coreApiError');
const { env } = require('../../../config');

const client = axios.create({
  baseURL: `${env.CORE_API_URI}`,
  maxContentLength: Infinity,
  maxBodyLength: Infinity
});
axiosRetry(client, {
  retries: 3,
  retryCondition: axiosRetry.isNetworkError && axiosRetry.isSafeRequestError
});

const wrapper = fn => async (...args) => {
  try {
    const req = nr.startBackgroundTransaction(`core-api/${fn.name}`, 'core-api', () => fn(...args));
    return Promise.resolve(req);
  } catch (e) {
    if (e.isAxiosError) {
      const err = new CoreApiError(e, fn.name);
      err.stack = e.stack;
      throw err;
    } else {
      throw e;
    }
  }
};

const gql = (literals, ...substitutions) => {
  let result = '';

  for (let i = 0; i < substitutions.length; i += 1) {
    result += literals[i];
    result += substitutions[i];
  }

  result += literals[literals.length - 1];

  return result;
};

const groupBy = (objs, getKey) =>
  objs.reduce((result, obj) => {
    const key = getKey(obj);
    return {
      ...result,
      [key]: [...(result[key] || []), obj]
    };
  }, {});

const getObjByAttribute = (data, attr, value) => data.find(x => x[attr] === value);

const getFieldByAttribute = (data, attr, value, field) =>
  lodashGet(getObjByAttribute(data, attr, value), field);

module.exports = {
  wrapper,
  gql,
  coreAxios: client,
  groupBy,
  getObjByAttribute,
  getFieldByAttribute
};
