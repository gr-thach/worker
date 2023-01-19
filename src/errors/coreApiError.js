const { asString, truncateString } = require('../helper/string');

class CoreApiError extends Error {
  constructor(axiosError, fnName) {
    if (axiosError.response && axiosError.response.statusText) {
      super(axiosError.response.statusText);
    } else {
      super(axiosError.message);
    }

    this.name = this.constructor.name;
    this.context = getContextFromAxiosError(axiosError);
    this.context.fnName = fnName;
  }
}

const getContextFromAxiosError = axiosError => {
  return {
    request: getRequestContext(axiosError),
    response: getResponseContext(axiosError)
  };
};

const getRequestContext = axiosError => {
  const { config } = axiosError;

  if (config) {
    const body = truncateString(asString(config.data), 3000);

    return {
      baseURL: config.baseURL,
      url: config.url,
      method: config.method,
      body
    };
  }

  return undefined;
};

const getResponseContext = axiosError => {
  const { response } = axiosError;

  if (response) {
    const { status, data } = response;
    const body = truncateString(asString(data), 3000);

    return {
      status,
      body
    };
  }

  return undefined;
};

module.exports = CoreApiError;
