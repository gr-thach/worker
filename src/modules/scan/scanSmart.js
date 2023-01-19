const lodashGet = require('lodash/get');

const EngineDetection = require('../engineDetection/engineDetection');
const Scan = require('./scan');

const log = require('../../utils/logger');
const { env } = require('../../../config');
const { getConfigForEngineRunNew, getScanConfigs } = require('../../helper/engineConfig');
const { SMARTSCAN_TYPE } = require('../../helper/smartScan');
const { generateFindings } = require('../../helper/generateFindings');
const { ENGINE_RUN_STATUS } = require('../../helper/core-api/enums');
const { updateScan } = require('../../helper/core-api/scans');
const { getAllEngineRulesGroupByName } = require('../../helper/core-api/scanMappings');
const processor = require('../../content/processing/process');
const { hashedLineContentBuilder } = require('../../helper/findings');

class SmartScan extends Scan {
  constructor(...params) {
    super(...params);
    this.isFullScan = false;
  }

  async detectEngineToRun() {
    await this.getScanConfigs();
    const prevEngineRun = this.prevEngineRunResults.map(e => `${e.fkEngine}_${e.rootPath}`);

    await updateScan(this.scan.idScan, {
      githookMetadata: { ...this.scan.githookMetadata, scanConfigs: this.scanConfigs }
    });

    const { scanConfigs, account, subscriptionFeatures, engines } = this;

    const engineDetection = new EngineDetection(account, subscriptionFeatures, engines);

    const enginesToRun = scanConfigs.map(config => {
      const enginesToRuns = engineDetection.detect({ config });

      // check if all detected engines has success prev scan result - compare with successEngine
      // check if all detected engines are diff supported - check successEngine
      const useApi = enginesToRuns.every(
        idEngine =>
          prevEngineRun.indexOf(`${idEngine}_${config.path || 'null'}`) !== -1 &&
          this.enginesByIdMap[idEngine].diffSupported
      );

      return {
        ...config,
        path: config.path === '' ? null : config.path,
        enginesToRuns,
        canDownloadSrcViaApi: useApi
      };
    });
    // Add engine run for success engine run but not be triggered by diffs
    const moreEnginesToRun = enginesToRun.map(config => {
      const enginesToRuns = prevEngineRun
        .filter(e => {
          const [idEngine, rootPath] = e.split('_');
          return (
            rootPath === (config.path || 'null') &&
            this.enginesByIdMap[idEngine] &&
            config.enginesToRuns.indexOf(parseInt(idEngine, 10)) === -1
          );
        })
        .map(e => parseInt(e.split('_')[0], 10));

      return {
        ...config,
        path: config.path === '' ? null : config.path,
        enginesToRuns,
        scanType: SMARTSCAN_TYPE.DEDUCTION,
        smartScan: {
          fileRemove: {},
          fileRename: {},
          onlyLineRemove: {},
          others: {},
          type: SMARTSCAN_TYPE.DEDUCTION
        },
        diffs: []
      };
    });

    this.scanConfigs = [...moreEnginesToRun, ...enginesToRun];
  }

  async runScan(idEngine, scanConfig, idEngineRun, allFindings) {
    // [SS-69] a flag to indicate if the EngineRunErrorFallback is trigger during this runScan
    let isScanErrorFallbackTriggered = false;

    await this.updateEngineRunStatus(idEngineRun, ENGINE_RUN_STATUS.RUNNING);

    const engine = this.enginesByIdMap[idEngine];

    const skip = await this.engineCircuitBreakerCheck(engine.idEngine, scanConfig.path);
    if (skip) {
      await this.updateEngineRunStatus(idEngineRun, ENGINE_RUN_STATUS.SKIP);
      return [];
    }

    const customConfig = await this.prepareCustomConfig(engine.idEngine, engine.name);
    const engineInfo = {
      idEngine: engine.idEngine,
      name: engine.name,
      language: engine.language,
      version: engine.version,
      fkAccount: engine.fkAccount,
      account: engine.account,
      diffSupported: engine.diffSupported,
      customConfig,
      minioObjectName: this.srcCodeManager.getMinioObjectName() // added for engine run v3
    };

    let [engineOutputHasError, parsedEngineOutput] = await this.engineRunManager.run(
      engineInfo,
      scanConfig,
      this.srcCodeManager,
      this.prevFindings[`${idEngine}_${scanConfig.path}`]
    );

    // skip all logic/process below as it will be handled by Summarizer svc
    if (env.FEATURE_ENGINE_WRAPPER) {
      return [];
    }

    if (engineOutputHasError && env.FEATURE_ENGINE_RUN_ERROR_FALLBACK) {
      isScanErrorFallbackTriggered = true;

      // NOTE: when engine error, we not throw error but will use previous scan result
      // per new strategy https://guardrails.slack.com/archives/CEATB853J/p1635303750119900
      [engineOutputHasError, parsedEngineOutput] = await this.engineRunManager.run(
        engineInfo,
        { ...scanConfig, scanType: SMARTSCAN_TYPE.DEDUCTION },
        this.srcCodeManager,
        this.prevFindings[`${idEngine}_${scanConfig.path}`]
      );
      log.info(`[${this.scan.idScan}] engine ${idEngine} return fallback results`);
    }

    if (engineOutputHasError) {
      await this.updateEngineRunStatus(idEngineRun, ENGINE_RUN_STATUS.ERROR);
      return [];
    }

    if (global.TERMINATING) {
      await this.updateEngineRunStatus(idEngineRun, ENGINE_RUN_STATUS.ERROR);
      throw Error('worker smart-scan terminating...');
    }

    const engineRules = getAllEngineRulesGroupByName(this.allEngineRule, idEngine);
    const customEngineRules = getAllEngineRulesGroupByName(this.allCustomEngineRule, idEngine);
    const sender = lodashGet(this.scan, 'githookMetadata.sender.login', 'N/A');

    const hashLineContentFn = hashedLineContentBuilder(this.account.idAccount);

    // processor function has side effect. it modify parsedEngineOutput
    processor({
      engineOutputs: parsedEngineOutput,
      scanType: this.scan.type,
      pullRequestDiffContent: this.prDiffContent,
      config: scanConfig.config,
      engineRules,
      customEngineRules,
      engineName: engine.name,
      engineLanguage: engine.language,
      actions: this.actions,
      hashLineContentFn
    });

    const findings = await generateFindings({
      idEngine,
      idRepository: this.repository.idRepository,
      idEngineRun,
      branch: this.scan.branch,
      parsedEngineOutput,
      allFindings,
      engineRules,
      customEngineRules,
      sender,
      diffContent: this.scanDiffContent,
      rootPath: scanConfig.path,
      excludedPaths: scanConfig.excluded,
      hashLineContentFn,
      engine,
      ruleOverride: lodashGet(scanConfig, 'config.ruleOverride')
    });

    await this.updateEngineRunStatus(
      idEngineRun,
      isScanErrorFallbackTriggered ? ENGINE_RUN_STATUS.ERROR : ENGINE_RUN_STATUS.SUCCESS
    );

    return findings;
  }

  async getScanConfigs() {
    if (this.scanConfigs && this.scanConfigs.length) {
      return this.scanConfigs;
    }

    let excludeSubRepo = null;
    let rootPath = '';
    if (this.isMonorepoSupported) {
      excludeSubRepo = this.repositoryV2.getChildren().map(r => ({ fullpath: r.path }));
      rootPath = lodashGet(this.repository, 'path') || '';
    }

    let scanConfig = getScanConfigs(this.repoConfig, rootPath, excludeSubRepo);

    if (!this.isMonorepoSupported && this.scanConfigPathHasWildcard(scanConfig)) {
      scanConfig = await this.fillWildcardScanConfigPath(scanConfig);
    }

    this.scanConfigs = await getConfigForEngineRunNew(scanConfig, this.scanDiffContent, false);

    return this.scanConfigs;
  }
}

module.exports = SmartScan;
