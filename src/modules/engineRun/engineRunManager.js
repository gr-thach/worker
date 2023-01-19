const lodashGet = require('lodash/get');
const prometheus = require('prom-client');

const engineRunType = require('./engineRunType');
const EngineRunHelper = require('./engineRunHelper');
const EngineRunScanFull = require('./engineRunScanFull');
const EngineRunScanPartial = require('./engineRunScanPartial');
const EngineRunScanDeduction = require('./engineRunScanDeduction');
const EngineRunScanDeductionV2 = require('./engineRunScanDeductionV2');
const { env } = require('../../../config');

const { SMARTSCAN_TYPE } = require('../../helper/smartScan');

class EngineRunManager {
  constructor(platform, account, scan, repository) {
    this.platform = platform;
    this.engineRunScanDeductionV2 = new EngineRunScanDeductionV2(
      platform,
      account,
      scan,
      repository
    );
    this.engineRuns = {
      [engineRunType.HELPER]: new EngineRunHelper(platform, account, scan, repository),
      [engineRunType.SCAN_FULL]: new EngineRunScanFull(platform, account, scan, repository),
      [engineRunType.SCAN_PARTIAL]: new EngineRunScanPartial(platform, account, scan, repository),
      [engineRunType.SCAN_DEDUCTION]: new EngineRunScanDeduction(
        platform,
        account,
        scan,
        repository
      )
    };
  }

  async run(engineInfo, scanConfig, srcCodeManager, prevFindings, useEngineWrapper) {
    const type = this.getEngineRunType(engineInfo, scanConfig);
    const srcLocation = engineInfo.diffSupported
      ? srcCodeManager.getDiffSrc()
      : srcCodeManager.getFullSrc();
    const rootPath = scanConfig.path || '';
    const excludePaths = srcCodeManager.getExcludePaths(srcLocation);
    const srcSize = srcCodeManager.getRepoSize();

    if (type === engineRunType.HELPER) {
      return this.engineRuns[engineRunType.HELPER].run(
        engineInfo,
        srcLocation,
        rootPath,
        excludePaths,
        srcSize,
        scanConfig,
        [],
        useEngineWrapper
      );
    }
    // Feature flag with engine_wrapper
    if (env.FEATURE_ENGINE_WRAPPER && type === engineRunType.SCAN_DEDUCTION) {
      return this.engineRunScanDeductionV2.run(
        engineInfo,
        srcLocation,
        rootPath,
        excludePaths,
        srcSize,
        scanConfig
      );
    }
    const result = await this.engineRuns[type].run(
      engineInfo,
      srcLocation,
      rootPath,
      excludePaths,
      srcSize,
      scanConfig,
      prevFindings
    );

    // prometheus metrics
    const engineName = engineInfo.name;
    const success = lodashGet(result, 'engineOutputHasError', false);
    const engineRunCounter = prometheus.register.getSingleMetric('worker_engine_run_output_count');
    engineRunCounter.observe(
      { engineName, success, scanType: type },
      lodashGet(result, 'parsedEngineOutput.output.length', 0)
    );

    return result;
  }

  getEngineRunType(engineInfo, scanConfig) {
    if (engineInfo.type === 'helper') {
      return engineRunType.HELPER;
    }
    if (scanConfig.scanType === SMARTSCAN_TYPE.DEDUCTION) {
      return engineRunType.SCAN_DEDUCTION;
    }

    if (scanConfig.scanType === SMARTSCAN_TYPE.PARTIAL && engineInfo.diffSupported) {
      return engineRunType.SCAN_PARTIAL;
    }
    return engineRunType.SCAN_FULL;
  }
}

module.exports = EngineRunManager;
