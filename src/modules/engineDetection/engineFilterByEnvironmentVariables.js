const { env } = require('../../../config');

// https://guardrails.atlassian.net/browse/GR-260
class EngineFilterByEnvironmentVariables {
  constructor(engines) {
    this.engines = engines;
  }

  generateEngineMapping() {
    return this.engines.reduce((r, e) => ({ ...r, [e.idEngine]: e }), {});
  }

  filter(enginesToRun) {
    const mapping = this.generateEngineMapping();

    const notAllowedTypes = [];
    if (env.FEATURE_SIS === false) {
      notAllowedTypes.push('secret');
    }
    if (env.FEATURE_SAST === false) {
      notAllowedTypes.push('code');
    }
    if (env.FEATURE_SCA === false) {
      notAllowedTypes.push('dependency');
    }
    if (env.FEATURE_CLOUD === false) {
      notAllowedTypes.push('cloud');
    }

    return enginesToRun.filter(idEngine => {
      const engine = mapping[idEngine];
      return !notAllowedTypes.includes(engine.type);
    });
  }
}

module.exports = EngineFilterByEnvironmentVariables;
