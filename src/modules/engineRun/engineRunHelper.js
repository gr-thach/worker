const EngineRun = require('./engineRun');
const engineRunType = require('./engineRunType');

const log = require('../../utils/logger');

class EngineRunHelper extends EngineRun {
  async run(
    engineInfo,
    srcLocation,
    rootPath,
    excludePaths,
    srcSize,
    scanConfig,
    envs = [],
    useEngineWrapper = false
  ) {
    const engineInfoWithType = { ...engineInfo, runType: engineRunType.HELPER };
    try {
      // HelperEngine which contains Enry and GitCloner by default should not use EngineWrapper
      // except override for Enry in fullscan detectEngineToRun in case of isMonorepoSupported=true and FEATURE_ENGINE_WRAPPER=true
      return super.run(
        engineInfoWithType,
        srcLocation,
        rootPath,
        excludePaths,
        srcSize,
        scanConfig,
        envs,
        useEngineWrapper || false
      );
    } catch (e) {
      log.warn('EngineRunHelper error', engineInfoWithType, e);
      return null;
    }
  }
}

module.exports = EngineRunHelper;
