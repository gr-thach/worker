const EngineRun = require('./engineRun');
const engineRunType = require('./engineRunType');

const log = require('../../utils/logger');

const {
  generateSmartScanOutput,
  generateSmartScanParsedEngineOutput
} = require('../../helper/smartScan');

class EngineRunScanDeduction extends EngineRun {
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
    const engineInfoWithType = { ...engineInfo, runType: engineRunType.SCAN_DEDUCTION };

    try {
      const smartScanOutput = generateSmartScanOutput(scanConfig.smartScan, prevFindings);
      parsedEngineOutput = generateSmartScanParsedEngineOutput(
        engineInfoWithType,
        smartScanOutput,
        'deduction-scan'
      );
    } catch (e) {
      hasError = true;
      log.warn('EngineRunScanDeduction error', engineInfoWithType, e);
    }

    return [hasError, parsedEngineOutput];
  }
}

module.exports = EngineRunScanDeduction;
