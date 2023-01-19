const generateEngineErrorResult = (engineName, message, executionTime, errorType = 'error') => {
  return JSON.stringify({
    engine: { name: engineName },
    status: errorType,
    message: message || `Timed out after ${executionTime} min.`,
    executionTime: executionTime * 60 * 1000,
    issues: 0,
    output: []
  });
};

const generateEngineWrapperSuccessResult = engineName => {
  return JSON.stringify({
    engine: { name: engineName },
    status: 'use-engine-wrapper',
    message: `Engine output handle by engine-wrapper.`,
    executionTime: 0,
    issues: 0,
    output: []
  });
};

const generateEngineTimeoutResult = (engineName, message, executionTime) =>
  generateEngineErrorResult(engineName, message, executionTime, 'timeout');

const allPossibleNodeAffinity = (text, separator = '.') => {
  if (!text) {
    return [];
  }

  const result = [text];
  let idx = text.indexOf(separator);
  while (idx !== -1) {
    result.push(text.substr(0, idx));
    idx = text.indexOf(separator, idx + 1);
  }
  return result;
};

const removeDockerContainerById = (docker, containerId) =>
  docker
    .getContainer(containerId)
    .remove({ force: true })
    .catch(() => {
      // ignore
    });

module.exports = {
  generateEngineErrorResult,
  generateEngineWrapperSuccessResult,
  generateEngineTimeoutResult,
  allPossibleNodeAffinity,
  removeDockerContainerById
};
