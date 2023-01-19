const moment = require('moment');
const momentDurationFormatSetup = require('moment-duration-format');
const lodashGet = require('lodash/get');
const crypto = require('crypto');

const SourceCodeManager = require('../modules/sourceCode/sourceCodeManager');
const NotificationsService = require('../services/notifications');
const ScanFactory = require('../modules/scan/scanFactory');
const Scan = require('../modules/scan/scan');
const RepositoryEntity = require('../modules/repository/entity');

const { isK8s } = require('../../config');
const { getFeatureValue } = require('../helper/subscription');
const getProviderService = require('../provider');
const { PLAN_FEATURES, SCAN_TYPE } = require('../helper/core-api/enums');
const { findScanByUuid } = require('../helper/core-api/scans');
const { findCommentId } = require('../helper/core-api/comments');
const { getRepositoriesAncestorAndChildById } = require('../helper/core-api/repository');
const { setPullRequestComment } = require('../helper/provider-comment');
const { deletePreHookDiff } = require('../helper/preHook');
const { env } = require('../../config');
const log = require('../utils/logger');
const { getRepositoryConfig } = require('../helper/scanConfig');
const { shouldSetCommitStatus } = require('../helper/common');

momentDurationFormatSetup(moment);

const scanJob = async jobPayload => {
  const {
    idScan,
    filename: minioFile,
    diffFileName,
    isMonorepoSupported,
    detectedLanguages,
    scanTimestamp
  } = jobPayload;
  const scan = await findScanByUuid(idScan);
  if (!scan) {
    log.info(
      `Scan with id = [${idScan}] not found (or its repository or account had been deleted). Aborting Scan.`
    );
    return;
  }
  if (detectedLanguages) {
    scan.detectedLanguages = detectedLanguages;
  }

  if (!scanTimestamp) {
    scan.scanTimestamp = `${new Date().getTime()}-${crypto.randomBytes(4).toString('hex')}`;
  } else {
    scan.scanTimestamp = scanTimestamp;
  }

  const {
    repository,
    repository: { account },
    type,
    sha,
    branch,
    prNumber
  } = scan;
  let repoEntityData;
  if (isMonorepoSupported) {
    repoEntityData = await getRepositoriesAncestorAndChildById(repository.idRepository);
  } else {
    repoEntityData = [{ ...repository, level: 0 }];
  }

  const repositoryV2 = new RepositoryEntity(repoEntityData);

  const isPR = type === SCAN_TYPE.PULL;

  // TODO: improve this by include subscription features into Account or Query all data at once
  const { subscription } = account;
  const allowCustomEngines = await getFeatureValue(subscription, PLAN_FEATURES.CUSTOM_ENGINES);
  const excludedLanguages = await getFeatureValue(subscription, PLAN_FEATURES.LANG_EXCLUSIONS);
  const subscriptionFeatures = { allowCustomEngines, excludedLanguages };

  const providerService = await getProviderService(account, repositoryV2.get());

  const repoConfig = await getRepositoryConfig(
    providerService,
    scan,
    repositoryV2,
    sha,
    isMonorepoSupported
  );

  const platform = isK8s ? 'k8s' : 'docker';

  const srcCodeManager = new SourceCodeManager(platform, scan, providerService, minioFile);

  const scanService = await ScanFactory.issue(
    platform,
    scan,
    repositoryV2,
    account,
    subscriptionFeatures,
    srcCodeManager,
    providerService,
    jobPayload,
    repoConfig
  );

  if (!scanService) {
    return;
  }

  const isActiveCommit = await providerService.determineIsPushPartOfPR(branch, sha);

  scanService.on(Scan.EVENT.SCANNING, () => {
    if (shouldSetCommitStatus(account, repository, repoConfig, isPR || isActiveCommit)) {
      // if current PR status is success because of skipped then do not change status to pendding/running
      // https://guardrails.atlassian.net/browse/GRS-407
      providerService
        .checkPullRequestStartCommitStatusSkippedSuccess(prNumber)
        .then(r => !r && providerService.setCommitStatus(sha, 'pending', 'scan in progress'));
    }
  });

  scanService.on(Scan.EVENT.DONE, scanResult => {
    const createPRComment = lodashGet(repoConfig, 'report.pullRequest.comment', true);

    if (!isPR || !createPRComment) {
      return;
    }
    findCommentId(repositoryV2.get().idRepository, scan.prNumber)
      .then(commentId =>
        setPullRequestComment(
          scanResult.count,
          scanResult.vulnerabilities,
          providerService,
          sha,
          commentId,
          account,
          lodashGet(repoConfig, 'report.pullRequest.paranoid', false),
          prNumber
        )
      )
      .then(commentDoc => scanService.updateScanPRCommentId(lodashGet(commentDoc, 'id', null)));
  });

  scanService.on(Scan.EVENT.DONE, scanResult => {
    if (isPR && env.ASSIGN_REVIEWERS_BY_TEAM_SLUG && scanResult.count > 0) {
      providerService.assignReviewersByTeamSlug(prNumber, env.ASSIGN_REVIEWERS_BY_TEAM_SLUG);
    }
  });

  scanService.on(Scan.EVENT.DONE, scanResult => {
    if (shouldSetCommitStatus(account, repository, repoConfig, isPR || isActiveCommit)) {
      const { status, description } = scanResult;
      providerService.setCommitStatus(sha, status, description);
    }
  });

  scanService.on(Scan.EVENT.NOTIFY, scanResult => {
    const notificationsService = new NotificationsService(account, repoConfig);
    notificationsService.send(scan, scanResult, isPR);
  });

  scanService.on(Scan.EVENT.ERROR, () => {
    if (shouldSetCommitStatus(account, repository, repoConfig, isPR || isActiveCommit)) {
      providerService.setCommitStatus(scan.sha, 'error', 'internal error (please contact support)');
    }
  });

  scanService.on(Scan.EVENT.END, () => {
    if (!env.FEATURE_ENGINE_WRAPPER) {
      srcCodeManager.cleanSrc();
    }
  });

  // delete preHook diff file on minion
  scanService.on(Scan.EVENT.END, () => {
    if (type === SCAN_TYPE.PRE_HOOK) {
      deletePreHookDiff(diffFileName);
    }
  });

  await scanService.run();
};

module.exports = scanJob;
