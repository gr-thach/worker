const CoreApiError = require('../../src/errors/coreApiError');

describe('coreApiError', () => {
  const validAxiosError = {
    message: 'Server responded with status 400',
    config: {
      baseURL: 'http://dummy-url.com',
      url: '/test-url',
      method: 'post',
      data: '{ name: "john doe" }'
    },
    response: {
      statusText: 'Bad Request',
      status: 400,
      data: {
        message: 'invalid name'
      }
    }
  };
  const DUMMY_FUNCTION_NAME = 'dummyFunctionName';

  const copy = obj => JSON.parse(JSON.stringify(obj));

  const generateStr = length => {
    return ''.padStart(length, '3');
  };

  it('should successfully transform axios error to a core api error', () => {
    const error = new CoreApiError(validAxiosError, DUMMY_FUNCTION_NAME);

    expect(error.message).toEqual('Bad Request');
    expect(error.name).toEqual('CoreApiError');

    expect(error.context).toEqual({
      fnName: DUMMY_FUNCTION_NAME,
      request: {
        baseURL: 'http://dummy-url.com',
        body: '{ name: "john doe" }',
        method: 'post',
        url: '/test-url'
      },
      response: {
        body: '{"message":"invalid name"}',
        status: 400
      }
    });
  });

  it('should transform a axios error without a response to a core api error', () => {
    const axiosError = copy(validAxiosError);
    delete axiosError.response;

    const error = new CoreApiError(axiosError, DUMMY_FUNCTION_NAME);
    expect(error.message).toEqual('Server responded with status 400');
    expect(error.name).toEqual('CoreApiError');
    expect(error.context).toEqual({
      fnName: DUMMY_FUNCTION_NAME,
      request: {
        baseURL: 'http://dummy-url.com',
        body: '{ name: "john doe" }',
        method: 'post',
        url: '/test-url'
      }
    });
  });

  it('should transform a axios error without a config (i.e. request) to a core api error', () => {
    const axiosError = copy(validAxiosError);
    delete axiosError.config;

    const error = new CoreApiError(axiosError, DUMMY_FUNCTION_NAME);
    expect(error.message).toEqual('Bad Request');
    expect(error.name).toEqual('CoreApiError');
    expect(error.context).toEqual({
      fnName: DUMMY_FUNCTION_NAME,
      response: {
        body: '{"message":"invalid name"}',
        status: 400
      }
    });
  });
  it('should transform a axios error without a config (i.e. request) nor reponse to a core api error', () => {
    const axiosError = copy(validAxiosError);
    delete axiosError.config;
    delete axiosError.response;

    const error = new CoreApiError(axiosError, DUMMY_FUNCTION_NAME);
    expect(error.message).toEqual('Server responded with status 400');
    expect(error.name).toEqual('CoreApiError');
    expect(error.context).toEqual({
      fnName: DUMMY_FUNCTION_NAME
    });
  });
  it('should truncate config (i.e. request) data with length longer than 3000 characters', () => {
    const axiosError = copy(validAxiosError);
    axiosError.config.data = generateStr(3010);

    const error = new CoreApiError(axiosError, DUMMY_FUNCTION_NAME);
    expect(error.context.request.body.length).toEqual(3003);

    const expectedStr = `${generateStr(3000)}...`;
    expect(error.context.request.body).toEqual(expectedStr);
  });

  it('should truncate response body with length longer than 3000 characters', () => {
    const axiosError = copy(validAxiosError);
    axiosError.response.data = generateStr(3010);

    const error = new CoreApiError(axiosError, DUMMY_FUNCTION_NAME);
    expect(error.context.response.body.length).toEqual(3003);

    const expectedStr = `${generateStr(3000)}...`;
    expect(error.context.response.body).toEqual(expectedStr);
  });
});
