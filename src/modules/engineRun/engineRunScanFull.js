const EngineRun = require('./engineRun');
const engineRunType = require('./engineRunType');

const log = require('../../utils/logger');

class EngineRunScanFull extends EngineRun {
  async run(engineInfo, srcLocation, rootPath, excludePaths, srcSize, scanConfig) {
    let hasError = false;
    let parsedEngineOutput = [];
    const engineInfoWithType = { ...engineInfo, runType: engineRunType.SCAN_FULL };

    try {
      const engineOutput = await super.run(
        engineInfoWithType,
        srcLocation,
        rootPath,
        excludePaths,
        srcSize,
        scanConfig
      );
      parsedEngineOutput = this.parseEngineOutput(
        engineOutput,
        this.scan.idScan,
        engineInfoWithType.idEngine
      );
    } catch (e) {
      hasError = true;
      log.warn('EngineRunScanFull error', engineInfoWithType, e);
    }

    return [hasError, parsedEngineOutput];
  }
}

module.exports = EngineRunScanFull;
