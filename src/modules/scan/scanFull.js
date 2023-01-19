const lodashGet = require('lodash/get');

const Scan = require('./scan');
const EngineDetection = require('../engineDetection/engineDetection');

const log = require('../../utils/logger');
const { env } = require('../../../config');
const { getConfigForEngineRunNew, getScanConfigs } = require('../../helper/engineConfig');
const { generateFindings } = require('../../helper/generateFindings');
const { updateScan } = require('../../helper/core-api/scans');
const { ENGINE_RUN_STATUS } = require('../../helper/core-api/enums');
const { getAllEngineRulesGroupByName } = require('../../helper/core-api/scanMappings');
const { parseLanguageFromEnryOutput, parseLanguageFromEnryOutputV2 } = require('../../helper/enry');
const processor = require('../../content/processing/process');
const { hashedLineContentBuilder } = require('../../helper/findings');
const { SMARTSCAN_TYPE } = require('../../helper/smartScan');

class ScanFull extends Scan {
  async detectEngineToRun() {
    await this.getScanConfigs();

    await updateScan(this.scan.idScan, {
      githookMetadata: { ...this.scan.githookMetadata, scanConfigs: this.scanConfigs }
    });

    const {
      scanConfigs,
      account,
      subscriptionFeatures,
      engines,
      srcCodeManager,
      engineRunManager,
      scan
    } = this;

    await this.prepareSrc();

    const engineDetection = new EngineDetection(account, subscriptionFeatures, engines);

    if (scan.detectedLanguages) {
      // scan.detectedLanguages should only run with isMonorepoSupported -> scanConfigs should has only 1 item
      const config = scanConfigs[0];

      // continue the flow after enry container return result
      this.scanConfigs = [
        {
          ...config,
          path: config && config.path === '' ? null : config.path,
          enginesToRuns: engineDetection.detect({
            config,
            languages: parseLanguageFromEnryOutputV2(
              scan.detectedLanguages,
              this.allSupportedLanguages
            )
          })
        }
      ];
      return;
    }

    let runEnryEngineWrapper = false;
    const useEngineWrapper = env.FEATURE_ENGINE_WRAPPER && this.isMonorepoSupported;
    const detectLanguagesEngineRuns = scanConfigs.map(scanConfig => {
      // https://guardrails.atlassian.net/browse/GR-265
      // do not need to run Enry to detect languages if config bundle is set, just return all language as bundle config setting
      // check bundle is array is not necessary because the type should be valid by Joi() already
      const bundle = lodashGet(scanConfig, 'config.bundles', 'auto');
      if (bundle !== 'auto' && Array.isArray(bundle) && bundle.length) {
        return bundle.reduce((r, b) => {
          return typeof b === 'string' ? [...r, b] : [...r, ...Object.keys(b)];
        }, []);
      }

      const enryEngine = this.helperEngines.find(e => e.idEngine === env.HELPER_ENGINE_ID_ENRY);
      if (!enryEngine) {
        log.error('helper engine Enry not found in db');
        return [];
      }

      runEnryEngineWrapper = true;
      return new Promise(resolve =>
        engineRunManager
          .run(
            enryEngine,
            { ...scanConfig, scanTimestamp: scan.scanTimestamp },
            srcCodeManager,
            scan,
            useEngineWrapper
          )
          .then(output => resolve(parseLanguageFromEnryOutput(output, this.allSupportedLanguages)))
          .catch(e => {
            log.error('helper engine Enry run error', e);
            resolve([]);
          })
      );
    });

    // useEngineWrapper=true mean scanConfigs should have 1 item only
    // if run Enry with engine-wrapper, skip following detect engine to run logic, do not need to run scan
    if (useEngineWrapper && runEnryEngineWrapper) {
      log.info('skip detect engine to run because of useEngineWrapper');
      this.scanConfigs = [];
      return;
    }

    scan.detectedLanguages = await Promise.all(detectLanguagesEngineRuns);
    this.scanConfigs = scanConfigs.map((config, i) => {
      const languages = scan.detectedLanguages[i];
      log.info(
        `[${this.scan.idScan}] Detect language at /${config.path}: ${JSON.stringify(languages)}`
      );
      return {
        ...config,
        path: config.path === '' ? null : config.path,
        enginesToRuns: engineDetection.detect({
          config,
          languages
        })
      };
    });
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
      customConfig,
      minioObjectName: this.srcCodeManager.getMinioObjectName() // added for engine run v3
    };

    let [engineOutputHasError, parsedEngineOutput] = await this.engineRunManager.run(
      engineInfo,
      scanConfig,
      this.srcCodeManager
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
      throw Error('worker full-scan terminating...');
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

    this.scanConfigs = await getConfigForEngineRunNew(scanConfig, this.scanDiffContent, true);

    return this.scanConfigs;
  }
}

module.exports = ScanFull;
