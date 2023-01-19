const { SCAN_STATUS } = require('../helper/core-api/enums');
const { updateScan, findScanByUuid } = require('../helper/core-api/scans');
const { getAllScanStatusNameIdMapping } = require('../helper/core-api/scanMappings');
const getProviderService = require('../provider');
const { SCAN_TYPE } = require('../helper/core-api/enums');
const log = require('../utils/logger');
const { getRepositoriesAncestorAndChildById } = require('../helper/core-api/repository');
const { getRepositoryConfig } = require('../helper/scanConfig');
const RepositoryEntity = require('../modules/repository/entity');
const { shouldSetCommitStatus } = require('../helper/common');

const scanReject = async (jobPayload, count) => {
  const { idScan, isMonorepoSupported } = jobPayload;

  const scan = await findScanByUuid(idScan);
  if (!scan) {
    log.info(
      `Scan with id = [${idScan}] not found (or its repository or account had been deleted). Aborting Scan.`
    );
    return;
  }

  const {
    repository,
    repository: { account },
    type,
    sha,
    branch
  } = scan;

  let repoEntityData;
  if (isMonorepoSupported) {
    repoEntityData = await getRepositoriesAncestorAndChildById(repository.idRepository);
  } else {
    repoEntityData = [{ ...repository, level: 0 }];
  }

  const repositoryV2 = new RepositoryEntity(repoEntityData);

  // update pr comment
  const isPR = type === SCAN_TYPE.PULL;
  const providerService = await getProviderService(account, repository);
  const repoConfig = await getRepositoryConfig(
    providerService,
    scan,
    repositoryV2,
    sha,
    isMonorepoSupported
  );
  const isActiveCommit = await providerService.determineIsPushPartOfPR(branch, sha);
  if (shouldSetCommitStatus(account, repository, repoConfig, isPR || isActiveCommit)) {
    await providerService.setCommitStatus(sha, 'error', `Scan rejected after ${count} tries`);
  }

  // update db
  const scanStatusMapping = await getAllScanStatusNameIdMapping();
  const patch = {
    fkScanStatus: scanStatusMapping[SCAN_STATUS.ERROR],
    finishedAt: new Date().toJSON()
  };
  await updateScan(idScan, patch);
  log.info(`[${idScan}] mark as rejected`);
};

module.exports = scanReject;
