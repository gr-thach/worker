const SourceCodeFromMinio = require('./sourceCodeFromMinio');
const EngineRunHelper = require('../engineRun/engineRunHelper');

const {
  env,
  constants: { minio }
} = require('../../../config');
const { getAccountIdentifierValue } = require('../../helper/account');
const { getHelperEngines } = require('../../helper/core-api/engines');
const { ACCOUNT_PROVIDER } = require('../../helper/core-api/enums');

class SourceCodeFromGitCloner extends SourceCodeFromMinio {
  constructor(platform, scan, minioFileName, gitProvider) {
    super(platform, scan, minioFileName);
    this.gitProvider = gitProvider;
  }

  async downloadSrc(scan, reppository, account) {
    const minioFileName = await this.getGitCloneArchive(scan, reppository, account);
    this.minioBucketName = minio.gitCloneBucketName;
    this.minioFileName = minioFileName;
    return super.downloadSrc();
  }

  async getGitCloneArchive(scan, repository, account) {
    const helperEngines = await getHelperEngines();
    const gitClonerEngine = helperEngines.find(e => e.idEngine === env.HELPER_ENGINE_ID_GITCLONER);
    if (!gitClonerEngine) {
      return undefined;
    }

    const { sha, idScan } = scan;
    const { providerInternalId, name: repositoryName } = repository;
    const accountIdentifier = getAccountIdentifierValue(account);
    const providerAccessToken = this.gitProvider.getToken();
    const gitPath = await this.gitProvider.getRepositoryFullPath();
    const envs = [
      `PROVIDER=${account.provider.toLowerCase()}`,
      `TOKEN=${providerAccessToken}`,
      `GIT_URL=${this.getGitUrlForGitClone(account.provider)}`,
      `GIT_PATH=${gitPath}`,
      `SHA=${sha}`,
      `ID_SCAN=${idScan}`,
      `MINIO_ENDPOINT=${env.STORAGE_HOST}`,
      `MINIO_PORT=${env.STORAGE_PORT}`,
      `MINIO_ACCESS_KEY=${env.STORAGE_ACCESS_KEY}`,
      `MINIO_SECRET_KEY=${env.STORAGE_SECRET_KEY}`,
      `REJECT_UNAUTHORIZED=false`,
      `ACCOUNT_NAME=${accountIdentifier}`,
      `REPO_NAME=${repositoryName}`,
      `PROVIDER_INTERNAL_ID=${providerInternalId}`,
      `ACCOUNT_INTERNAL_ID=${account.providerInternalId}`,
      `MINIO_S3_REGION=${env.STORAGE_S3_REGION}`
    ];

    if (env.GLOBAL_AGENT_HTTP_PROXY) {
      envs.push(`GLOBAL_AGENT_HTTP_PROXY=${env.GLOBAL_AGENT_HTTP_PROXY}`);
    }

    if (env.GLOBAL_AGENT_HTTPS_PROXY) {
      envs.push(`GLOBAL_AGENT_HTTPS_PROXY=${env.GLOBAL_AGENT_HTTPS_PROXY}`);
    }

    const helperEngineRun = new EngineRunHelper(this.platform, account, scan, repository);
    const output = await helperEngineRun.run(gitClonerEngine, '', '', [], 0, {}, envs);
    if (output && output.includes(`${idScan}.tar.gz`)) {
      return `${idScan}.tar.gz`;
    }
    return undefined;
  }

  getGitUrlForGitClone(provider) {
    switch (provider) {
      case ACCOUNT_PROVIDER.GITHUB:
        return env.GITHUB_URL.replace('https://', '');
      case ACCOUNT_PROVIDER.GITLAB:
        return env.GITLAB_URL.replace('https://', '');
      case ACCOUNT_PROVIDER.BITBUCKET:
        return env.BITBUCKET_URL.replace('https://', '');
      case ACCOUNT_PROVIDER.BITBUCKET_DATA_CENTER:
        return env.BITBUCKET_DATA_CENTER_SITE_URL.replace('https://', '');
      default:
        return '';
    }
  }
}

module.exports = SourceCodeFromGitCloner;
