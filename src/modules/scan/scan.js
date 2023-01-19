const moment = require('moment');
const lodashGet = require('lodash/get');
const lodashUniq = require('lodash/uniq');
const lodashUniqBy = require('lodash/uniqBy');
const prometheus = require('prom-client');

const EngineRunManager = require('../engineRun/engineRunManager');

const log = require('../../utils/logger');
const { env, constants } = require('../../../config');
const reportError = require('../../utils/sentry');
const { deDuplicatedFindings, groupFindingByRuleTitle } = require('../../helper/findings');
const { findingStatus } = require('../../helper/findingStatus');
const { updateScan } = require('../../helper/core-api/scans');
const { dashboardScanUrl } = require('../../helper/account');
const { getEngines, getHelperEngines } = require('../../helper/core-api/engines');
const { queryActionsByRepositoryId } = require('../../helper/core-api/actions');
const { SCAN_STATUS, SCAN_RESULT, ENGINE_RUN_STATUS } = require('../../helper/core-api/enums');
const {
  getIdByName,
  getAllEngineRunStatus,
  getAllEngineRule,
  getAllScanStatusNameIdMapping,
  getAllScanResultNameIdMapping,
  getAllCustomEngineRules
} = require('../../helper/core-api/scanMappings');
const {
  getOrCreateEngineRunsFromScan,
  updateEngineRunStatus,
  getEngineRunOfEngineFromShaList
} = require('../../helper/core-api/engineRuns');
const { generateEngineCustomConfig, fillWildcardPaths } = require('../../helper/engineConfig');
const { getChangedFilePathInDiffs } = require('../../helper/diffs');
const { groupBy } = require('../../helper/core-api');
const { getFindingByEngineRuns, getAllFindingByEngine } = require('../../helper/core-api/findings');
const { notifyScanStatusToSummarizer } = require('../scanResult/scanResult');
const { calculateScanFingerPrint } = require('../../helper/common');
const redis = require('../../services/redis');

class Scan {
  static EVENT = {
    BEGIN: 'begin',
    SCANNING: 'scanning',
    DONE: 'done',
    ERROR: 'error',
    END: 'end',
    NOTIFY: 'notify'
  };

  constructor(
    platform,
    scan,
    repositoryV2,
    account,
    subscriptionFeatures,
    srcCodeManager,
    jobPayload,
    repoConfig,
    rawDiffContent,
    commitShaHistory,
    prevEngineRunResults
  ) {
    this.observers = {};
    this.startTime = new Date();

    this.platform = platform;
    this.scan = scan;
    this.repositoryV2 = repositoryV2;
    this.repository = repositoryV2.get();
    this.account = account;
    this.subscriptionFeatures = subscriptionFeatures;
    this.srcCodeManager = srcCodeManager;
    this.repoConfig = repoConfig;
    const { prDiffs, scanDiff } = rawDiffContent;
    this.prDiffContent = prDiffs;
    this.scanDiffContent = scanDiff;
    this.commitShaHistory = commitShaHistory;
    this.isFullScan = true; // default value
    this.prevEngineRunResults = prevEngineRunResults || [];

    this.isMonorepoSupported = jobPayload.isMonorepoSupported;
    this.engineRunManager = new EngineRunManager(platform, account, scan, this.repository);
    this.scanConfigs = [];
  }

  async run() {
    try {
      log.info(
        `[${this.scan.idScan}] id=${this.repository.idRepository} ${this.account.provider}/${this.account.login}/${this.repository.name} scan as ${this.constructor.name}`
      );

      await this.updateScanWithStatus(SCAN_STATUS.SCANNING);

      if (env.FEATURE_ENGINE_WRAPPER && !this.scan.detectedLanguages) {
        await this.notifyScanStartedToSummarizer();
      }

      this.triggerEvent(Scan.EVENT.BEGIN);

      await this.prepareDataFromDb();

      log.info(`[${this.scan.idScan}] prepared data`);

      await this.detectEngineToRun();

      log.info(`[${this.scan.idScan}] detected engine to run`);

      if (env.FEATURE_ENGINE_WRAPPER && !this.scan.detectedLanguages && this.isFullScan) {
        return null;
      }

      await this.prepareSrc();

      log.info(`[${this.scan.idScan}] prepared src`);

      this.triggerEvent(Scan.EVENT.SCANNING);

      await this.prepareAllEngineRuns();

      log.info(`[${this.scan.idScan}] before run scan`);

      const findings = await this.runScans();

      log.info(`[${this.scan.idScan}] after run scan`);

      // skip all logic/process below as it will be handled by Summarizer svc
      if (env.FEATURE_ENGINE_WRAPPER) {
        return null;
      }

      const processedFindings = await this.deDuplicate(findings);

      const [scanResult, scanPatch] = await this.summary(processedFindings);
      await this.updateScanWithStatus(SCAN_STATUS.SUCCESS, scanPatch);

      this.triggerEvent(Scan.EVENT.DONE, scanResult);

      this.triggerEvent(Scan.EVENT.NOTIFY, scanResult);

      log.info(`[${this.scan.idScan}] completed: ${scanResult.count}`);

      return scanResult;
    } catch (e) {
      await this.updateScanWithStatus(SCAN_STATUS.ERROR);
      this.triggerEvent(Scan.EVENT.ERROR, e);

      if (env.FEATURE_ENGINE_WRAPPER) {
        notifyScanStatusToSummarizer(this.scan.idScan, this.scan.scanTimestamp, 'scan-error');
      }
      throw e;
    } finally {
      this.triggerEvent(Scan.EVENT.END);
    }
  }

  async prepareDataFromDb() {
    const [
      allEngineRule,
      allEngineRunStatus,
      actions,
      engines,
      helperEngines,
      scanStatusMapping,
      scanResultMapping,
      allCustomEngineRule
    ] = await Promise.all([
      getAllEngineRule(),
      getAllEngineRunStatus(),
      queryActionsByRepositoryId(this.repository.idRepository),
      getEngines(),
      getHelperEngines(),
      getAllScanStatusNameIdMapping(),
      getAllScanResultNameIdMapping(),
      getAllCustomEngineRules(this.account.idAccount)
    ]);

    this.allEngineRule = allEngineRule;
    this.allEngineRunStatus = allEngineRunStatus;
    this.actions = actions;
    this.engines = engines;
    this.helperEngines = helperEngines;
    this.scanStatusMapping = scanStatusMapping;
    this.scanResultMapping = scanResultMapping;
    this.allCustomEngineRule = allCustomEngineRule;

    this.enginesByIdMap = engines.reduce((r, e) => ({ ...r, [e.idEngine]: e }), {});
    this.idEngineRunStatus = Object.values(ENGINE_RUN_STATUS).reduce(
      (r, e) => ({ ...r, [e]: getIdByName(this.allEngineRunStatus, e) }),
      {}
    );
    this.allSupportedLanguages = lodashUniq(engines.map(e => e.language));

    // prevFindings are required for smart scan and need for full scan with FEATURE_ENGINE_RUN_ERROR_FALLBACK enable
    // for fullscan, it would be a waste to query prevFindings in case all engineRun are success
    // but because all enginesToRuns run async in parallel, in some case, prepare prevFindings at this stage can prevent multiple same query
    if (!this.isFullScan || env.FEATURE_ENGINE_RUN_ERROR_FALLBACK) {
      const engineRunIds = this.prevEngineRunResults.map(e => e.idEngineRun);
      this.prevFindings = await this.getPrevEngineRunResults(engineRunIds);
    }
  }

  async prepareSrc(isPrepareSrcForScanConfig) {
    // ignore variable using to ignore files in prepare src step
    // this logic has issue with smart scan when use toggle a ignore file
    // so decided to do ignore-filter in processor step before can improve further
    const ignore = [];
    const changedFilePathInDiffs = getChangedFilePathInDiffs(this.scanDiffContent);

    // ignore prepare src on engine run v3 because srcManager gonna handle this
    // except prepare src to build scanConfig in detect engine to run
    if (env.FEATURE_ENGINE_RUN_V3 && !isPrepareSrcForScanConfig) {
      // run srcCodeManager setup to set scanConfigs, to able to get the excludePaths when container.run()
      this.srcCodeManager.setup(this.scanConfigs, this.isFullScan, changedFilePathInDiffs, ignore);
      return;
    }

    const engineSrcTimer = prometheus.register.getSingleMetric(
      'worker_engine_prepare_source_code_time_seconds'
    );
    const engineSrcTimerEnd = engineSrcTimer.startTimer();

    await this.srcCodeManager.prepareSrc(
      this.scanConfigs,
      this.isFullScan,
      changedFilePathInDiffs,
      ignore,
      this.scan,
      this.repository,
      this.account
    );

    engineSrcTimerEnd({ provider: this.account.provider });
  }

  async prepareAllEngineRuns() {
    if (!this.idEngineRunStatus) {
      await this.prepareDataFromDb();
    }
    const engineRuns = this.scanConfigs.map(scanConfig =>
      scanConfig.enginesToRuns.map(idEngine => ({ idEngine, rootPath: scanConfig.path }))
    );

    // allEngineRuns include all (new and success) EngineRuns for a idScan
    // success EngineRuns will have attribute success=true
    // TODO: make getOrCreateEngineRunsFromScan default with idEngineRunStatus=QUEUED
    this.allEngineRuns = await getOrCreateEngineRunsFromScan(
      this.scan.idScan,
      engineRuns.flat(),
      this.idEngineRunStatus[ENGINE_RUN_STATUS.QUEUED]
    );
  }

  async runScans() {
    // get all findings by engines to pass into runScan().
    // Note: this helpful for monorepo scan which an engine might trigger multiple time on each rootPath.
    const allFindings = {};
    const uniqueEngineIds = lodashUniq(
      this.scanConfigs.map(scanConfig => scanConfig.enginesToRuns).flat()
    );
    const enginesFindings = await Promise.all(
      uniqueEngineIds.map(idEngine =>
        getAllFindingByEngine(
          this.repository.idRepository,
          this.scan.branch,
          idEngine
        ).then(data => ({ idEngine, data }))
      )
    );
    for (const engineFindings of enginesFindings) {
      allFindings[engineFindings.idEngine] = engineFindings.data;
    }

    // count number of engine need to run
    // extra data that require by go-wrapper
    const totalEnginesRun = this.scanConfigs.reduce((r, cfg) => r + cfg.enginesToRuns.length, 0);
    const { scanTimestamp } = this.scan;

    const engineRuns = this.scanConfigs.map(scanConfig => {
      const { scanType, path, enginesToRuns } = scanConfig;

      // check path exist in src before run engine, but ignore this check when run v3
      if (!env.FEATURE_ENGINE_RUN_V3 && !this.srcCodeManager.checkPathExistInSrc(path)) {
        return [];
      }

      log.info(
        `[${this.scan.idScan}] engine run type=${scanType} at /${path || ''}: ${enginesToRuns}`
      );
      return enginesToRuns.map(async idEngine => {
        const engineRun = this.allEngineRuns.find(
          e => e.fkEngine === idEngine && e.rootPath === (path || null)
        );

        return engineRun && engineRun.idEngineRun
          ? this.runScan(
              idEngine,
              { ...scanConfig, totalEnginesRun, scanTimestamp },
              engineRun.idEngineRun,
              allFindings[idEngine]
            )
          : [];
      });
    });

    const findings = await Promise.all(engineRuns.flat()).catch(e => {
      return Promise.reject(e);
    });
    return findings.flat();
  }

  async deDuplicate(findings) {
    return deDuplicatedFindings(findings);
  }

  async summary(allFindings) {
    const paranoid = lodashGet(this.config, 'report.pullRequest.paranoid', false);

    const filteredVulnerabilities = allFindings.filter(
      f =>
        // For vulnerabilities we take only unique ones (duplicatedWith=null) or from the duplicated ones, the one that has duplicatedWith=itself (means is the main one from the group of duplicated ones)
        (!f.duplicatedWith || f.duplicatedWith === f.idFinding) &&
        (paranoid // filter vulnerability
          ? [findingStatus.FIXED.toUpperCase(), findingStatus.MARK_AS_FIXED.toUpperCase()].indexOf(
              f.status
            ) === -1
          : f.isVulnerability)
    );

    // because of of smart scan - which does not all guarantee engine run will be trigger to run
    // so deduction engine scan for previous scan need to always run
    // causing in some case, the finding might return twice since the engine run more than 1 time
    const vulnerabilities = lodashUniqBy(filteredVulnerabilities, 'idFinding');

    const totalVulnerabilities = vulnerabilities.length;
    const newVulnerabilities = vulnerabilities.filter(f => f.createdAt === f.updatedAt).length;
    const existedVulnerabilities = totalVulnerabilities - newVulnerabilities;

    const timeScan = moment
      .duration(new Date().getTime() - this.startTime.getTime(), 'milliseconds')
      .format('(in mm[m]ss[s])', { trim: false });
    const description = totalVulnerabilities
      ? `detected ${totalVulnerabilities} new security issues ${timeScan}${
          paranoid ? ' - Paranoid mode' : ''
        }`
      : `no new security issues detected ${timeScan}`;

    const scanResult = {
      count: totalVulnerabilities,
      vulnerabilities: groupFindingByRuleTitle(vulnerabilities),
      status: totalVulnerabilities ? 'failure' : 'success',
      description
    };

    // add result to scan object
    const scanPatch = {
      isParanoid: paranoid,
      totalVulnerabilities,
      newVulnerabilities,
      existedVulnerabilities,
      fkScanResult: this.scanResultMapping[
        totalVulnerabilities === 0 ? SCAN_RESULT.PASS : SCAN_RESULT.FAIL
      ]
    };

    return [scanResult, scanPatch];
  }

  scanConfigPathHasWildcard(scanConfig) {
    return scanConfig.some(c => (c.path || '').includes('*'));
  }

  async fillWildcardScanConfigPath(scanConfigs) {
    // download src to replace/fill wildcard in config path
    await this.prepareSrc(true);

    // the fillWildcardPaths for config.path need to process here (instead of do it into srcCode module) because this affect the result of detect engine to runs
    const config = scanConfigs.reduce((r, c) => {
      if (c.path.indexOf('*') === -1) {
        return [...r, c];
      }
      const srcDir = this.srcCodeManager.getFullSrc();
      const detailConfigs = fillWildcardPaths([c.path], srcDir).map((d, i) => ({
        ...c,
        index: `${c.index}s${i}`,
        path: d
      }));
      return [...r, ...detailConfigs];
    }, []);

    // NOTE: delete prepared src code that require for fillWildcardPaths because this downloaded source code folder currently conflict with logic on SrcManager/Operarius side
    // This logic will be removed when implement DetectEngine V3
    if (env.FEATURE_ENGINE_RUN_V3) {
      log.info(`[${this.scan.idScan}] clean up fillWildcardScanConfigPath use for src`);
      await this.srcCodeManager.cleanSrc(true);
    }

    return config;
  }

  async updateEngineRunStatus(idEngineRun, status) {
    if (!this.idEngineRunStatus) {
      await this.prepareDataFromDb();
    }

    let timePart = 'createdAt'; // QUEUED
    if (status === ENGINE_RUN_STATUS.RUNNING) {
      timePart = 'startedAt';
    } else if (status === ENGINE_RUN_STATUS.SUCCESS || status === ENGINE_RUN_STATUS.ERROR) {
      timePart = 'finishedAt';
    }
    const patch = {
      fkEngineRunStatus: this.idEngineRunStatus[status],
      [timePart]: new Date().toJSON()
    };

    await updateEngineRunStatus(idEngineRun, patch);
  }

  async updateScanWithStatus(status, extra = {}) {
    if (!this.scanStatusMapping) {
      await this.prepareDataFromDb();
    }

    let timePart = 'queuedAt'; // QUEUED
    if (status === SCAN_STATUS.SCANNING) {
      timePart = 'scanningAt';
    } else if (status === SCAN_STATUS.SUCCESS || status === SCAN_STATUS.ERROR) {
      timePart = 'finishedAt';
    }

    const patch = {
      ...extra,
      fkScanStatus: this.scanStatusMapping[status],
      [timePart]: new Date().toJSON()
    };

    return updateScan(this.scan.idScan, patch);
  }

  // call from scanRun
  async updateScanPRCommentId(commentId) {
    const patch = {
      hasComment: !!commentId,
      commentId
    };
    return updateScan(this.scan.idScan, patch);
  }

  // NOTE: fully rely on clean-src-code daemon set to clean up custom config
  // should not get custom config for helper engine because helper engine is not manage in db
  async prepareCustomConfig(idEngine, name) {
    // ignore prepare custom config on engine run v3 because Init-cont gonna handle this
    if (env.FEATURE_ENGINE_RUN_V3) {
      return '';
    }

    return generateEngineCustomConfig({ idEngine, name }, this.account.idAccount, this.scan.idScan);
  }

  async getPrevEngineRunResults(successPrevEngineRunIds) {
    const previousFindings = await getFindingByEngineRuns(successPrevEngineRunIds);
    const groupedPreviousFindings = groupBy(previousFindings, f => `${f.fkEngine}_${f.rootPath}`);
    return groupedPreviousFindings;
  }

  async engineCircuitBreakerCheck(engineId, rootPath) {
    if (!env.FEATURE_ENGINE_CIRCUIT_BREAKER) {
      return false;
    }

    // TODO: cache and re-use getEngineRunOfEngineFromShaList query result
    const data = await getEngineRunOfEngineFromShaList(
      this.commitShaHistory,
      this.repository.idRepository,
      engineId,
      rootPath
    );

    if (
      data.length === env.ENGINE_CIRCUIT_BREAKER_THRESHOLD &&
      data.every(d => d.status === 'error') &&
      moment.duration(moment().diff(moment(data[0].createdAt))).asMinutes() <
        env.ENGINE_CIRCUIT_BREAKER_COOLING_IN_MINUTE
    ) {
      const engineCounter = prometheus.register.getSingleMetric('worker_engine_run_skipped_count');
      const { name, version } = this.enginesByIdMap[engineId];
      engineCounter.inc({ engineName: name, version }, 1);
      return true;
    }
    return false;
  }

  on(event, observer) {
    if (!this.observers[event]) {
      this.observers[event] = [];
    }
    this.observers[event].push(observer);
  }

  triggerEvent(event, ...params) {
    (this.observers[event] || []).forEach(obs => {
      try {
        obs(...params);
      } catch (error) {
        log.warn(`triggerEvent ${event} error`, error);
        reportError(error);
      }
    });
  }

  async notifyScanStartedToSummarizer() {
    // Send these info to summarizer so that summarizer can update the PR commit status.
    const minioObjectName = this.srcCodeManager.getMinioObjectName();
    const providerType = minioObjectName ? 'minio' : this.account.provider.trim();

    const data = {
      context: `${constants.botDisplayName}/scan`,
      accountId: this.account.idAccount,
      accountProvider: this.account.provider,
      owner: this.account.login,
      repo: this.repository.name,
      isPrivateRepo: this.repository.isPrivate,
      repoConfig: this.repoConfig,
      targetUrl: dashboardScanUrl(this.account, this.repository.idRepository, this.scan.sha),
      providerType: providerType.toLowerCase(),
      providerInternalId: this.repository.providerInternalId,
      installationId: `${this.account.installationId}`,
      repositoryProviderInternalId: this.repository.providerInternalId,
      accountProviderInternalId: this.account.providerInternalId,
      projectKey: lodashGet(this.account, 'providerMetadata.projectKey'), // For bitbucket
      minioObjectName // For minio provider
    };

    const scanFingerprint = calculateScanFingerPrint(this.scan);
    const scanContextKey = `${scanFingerprint}#from-worker#scan-context`;
    await redis.set(scanContextKey, JSON.stringify(data), 60 * 60 * 3);
    await notifyScanStatusToSummarizer(
      this.scan.idScan,
      this.scan.scanTimestamp,
      'scan-started',
      data
    );
  }
}

module.exports = Scan;
