const { env } = require('../../config');

const appendTimeToLog = (logFn, data) => {
  logFn(`[${new Date().toISOString()}]:`, ...data);
};

/* eslint-disable no-console */
module.exports = (() => {
  if (env.isTest) {
    return {
      debug: () => {},
      fatal: () => {},
      info: () => {},
      warn: () => {},
      success: () => {},
      error: () => {}
    };
  }

  return {
    debug: env.LOG_DEBUG === 'true' ? (...data) => appendTimeToLog(console.log, data) : () => {},
    fatal: (...data) => appendTimeToLog(console.error, data),
    info: (...data) => appendTimeToLog(console.log, data),
    warn: (...data) => appendTimeToLog(console.warn, data),
    success: (...data) => appendTimeToLog(console.log, data),
    error: (...data) => appendTimeToLog(console.error, data)
  };
})();
