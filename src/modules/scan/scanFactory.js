const lodashGet = require('lodash/get');
const parseDiff = require('parse-diff');

const ScanFull = require('./scanFull');
const ScanSmart = require('./scanSmart');

const log = require('../../utils/logger');
const redis = require('../../services/redis');
const { env } = require('../../../config');
const { SCAN_TYPE } = require('../../helper/core-api/enums');
const { calculateScanFingerPrint } = require('../../helper/common');
const {
  getSuccessEngineRunsBySha,
  getSuccessEngineRunsByShaAndRepositoryId
} = require('../../helper/core-api/engineRuns');
const { getPreHookDiff } = require('../../helper/preHook');
const { markIgnoreScan } = require('../../helper/core-api/scans');

class ScanFactory {
  static async issue(
    platform,
    scan,
    repositoryV2,
    account,
    subscriptionFeatures,
    srcCodeManager,
    providerService,
    jobPayload,
    repoConfig
  ) {
    const { type, sha, prNumber, branch, idScan } = scan;
    const { diffFileName, forceFullScan, isMonorepoSupported } = jobPayload;
    const beforeSha =
      type === SCAN_TYPE.PULL
        ? lodashGet(scan, 'githookMetadata.pullRequest.before', '')
        : lodashGet(scan, 'githookMetadata.commit.before', '');
    const repoId = repositoryV2.get().idRepository;

    const repoSize = await providerService.getSourceCodeSizeInKB(sha);
    srcCodeManager.setRepoSize(repoSize);
    if (env.FEATURE_LIMIT_SOURCE_CODE_SIZE) {
      if (repoSize > env.LIMIT_SOURCE_CODE_SIZE_IN_MB * 1000) {
        await markIgnoreScan(idScan);
        log.info(`[${idScan}] scan ignore because of source code size: ${repoSize} `);
        return null;
      }
    }

    // get prev scan result
    const prevEngineRunResults = isMonorepoSupported
      ? await getSuccessEngineRunsByShaAndRepositoryId(beforeSha, repoId)
      : await getSuccessEngineRunsBySha(beforeSha);

    const useSmartScan = env.FEATURE_SMARTSCAN && !forceFullScan && prevEngineRunResults !== null;

    let commitShaHistory = [];
    if (env.FEATURE_ENGINE_CIRCUIT_BREAKER) {
      try {
        // this cache value set from Probot when receive scan hook during getBeforeSha preparation
        const key = `${providerService.getShortName()}_sha_list_${repoId}_${sha}`;
        commitShaHistory = await redis.get(key);
        if (commitShaHistory) {
          commitShaHistory = JSON.parse(commitShaHistory);
        } else {
          commitShaHistory = await providerService.getHistoryCommitSha(sha, branch);
          if (commitShaHistory) {
            await redis.set(key, JSON.stringify(commitShaHistory), 3600 * 24 * 14);
          }
        }
      } catch (e) {
        log.error('Error in Engine circuit breaker:', e);
      }
    }

    const useGitCloner = repoConfig && repoConfig.useGitClone;
    srcCodeManager.setUseGitCloner(useGitCloner);

    // prDiffs is require for processor.filterFindingsOutsideOfPRDiff when type = pull or pre_hook
    let rawPrDiffs = '';
    let rawScanDiff = '';
    if (type === SCAN_TYPE.PRE_HOOK) {
      if (diffFileName) {
        rawPrDiffs = await getPreHookDiff(diffFileName);
        rawScanDiff = rawPrDiffs;
      }
    } else if (type === SCAN_TYPE.PULL) {
      rawPrDiffs = await providerService.getPullRequestDiffContent(prNumber);
      if (useSmartScan) {
        rawScanDiff = await providerService.getCommitDiffContent(sha, beforeSha);
      } else {
        rawScanDiff = rawPrDiffs;
      }
    } else {
      rawScanDiff = await providerService.getCommitDiffContent(sha, beforeSha);
    }

    // parseDiff
    const prDiffs = parseDiff(rawPrDiffs);
    const scanDiff = parseDiff(rawScanDiff);

    if (env.FEATURE_ENGINE_WRAPPER) {
      const scanFingerprint = calculateScanFingerPrint(scan);
      const diffKey = `${scanFingerprint}#from-worker#source-diff`;
      await redis.set(diffKey, JSON.stringify({ prDiffs, scanDiff }), 60 * 60 * 3);
    }

    // smart scan
    if (useSmartScan) {
      return new ScanSmart(
        platform,
        scan,
        repositoryV2,
        account,
        subscriptionFeatures,
        srcCodeManager,
        jobPayload,
        repoConfig,
        { prDiffs, scanDiff },
        commitShaHistory,
        prevEngineRunResults
      );
    }

    // full scan
    return new ScanFull(
      platform,
      scan,
      repositoryV2,
      account,
      subscriptionFeatures,
      srcCodeManager,
      jobPayload,
      repoConfig,
      { prDiffs, scanDiff },
      commitShaHistory,
      prevEngineRunResults
    );
  }
}

module.exports = ScanFactory;
