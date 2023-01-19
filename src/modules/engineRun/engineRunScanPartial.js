const EngineRun = require('./engineRun');
const engineRunType = require('./engineRunType');

const log = require('../../utils/logger');

const {
  generateSmartScanParsedEngineOutput,
  combinePartialSmartScanEngineOutput
} = require('../../helper/smartScan');

class EngineRunScanPartial extends EngineRun {
  async run(
    engineInfo,
    srcLocation,
    rootPath,
    excludePaths,
    srcSize,
    scanConfig,
    prevFindings = []
  ) {
    let hasError = false;
    let parsedEngineOutput = [];
    const engineInfoWithType = { ...engineInfo, runType: engineRunType.SCAN_PARTIAL };

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
      // combine engine output with previousEngineFindings
      const smartScanOutput = combinePartialSmartScanEngineOutput(
        scanConfig.diffs,
        prevFindings,
        parsedEngineOutput
      );

      const { executionTime } = parsedEngineOutput;
      parsedEngineOutput = generateSmartScanParsedEngineOutput(
        engineInfoWithType,
        smartScanOutput,
        'partial-scan',
        executionTime
      );
    } catch (e) {
      hasError = true;
      log.warn('EngineRunScanPartial error', engineInfoWithType, e);
    }

    return [hasError, parsedEngineOutput];
  }
}

module.exports = EngineRunScanPartial;
