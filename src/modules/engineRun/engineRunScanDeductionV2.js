const EngineRun = require('./engineRun');
const engineRunType = require('./engineRunType');

const { sendScanResultToQueue } = require('../scanResult/scanResult');
const log = require('../../utils/logger');

const {
  generateSmartScanOutput,
  generateSmartScanParsedEngineOutput
} = require('../../helper/smartScan');

class EngineRunScanDeductionV2 extends EngineRun {
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
    try {
      const engineInfoWithType = {
        ...engineInfo,
        runType: engineRunType.SCAN_DEDUCTION
      };
      const smartScanOutput = generateSmartScanOutput(scanConfig.smartScan, prevFindings);
      parsedEngineOutput = generateSmartScanParsedEngineOutput(
        engineInfoWithType,
        smartScanOutput,
        'deduction-scan'
      );

      log.info('EngineRunScanDeductionV2 send engine message to queue');
      const engineMessage = {
        status: 'success',
        scan_result: parsedEngineOutput,
        scan_id: this.scan.idScan,
        scan_type: engineRunType.SCAN_DEDUCTION,
        repo_name: this.repository.name,
        repo_path: this.repository.path,
        account_id: this.account.idAccount ? this.account.idAccount.toString() : '',
        engine_id: engineInfo.idEngine ? engineInfo.idEngine.toString() : '',
        engine_name: engineInfo.name,
        scan_timestamp: scanConfig.scanTimestamp,
        execution_time: 0,
        number_of_engine_to_run: scanConfig.totalEnginesRun
      };
      await sendScanResultToQueue(engineMessage);
    } catch (error) {
      hasError = true;
    }
    return [hasError, parsedEngineOutput];
  }
}

module.exports = EngineRunScanDeductionV2;
