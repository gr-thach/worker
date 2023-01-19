const lodashGet = require('lodash/get');
const nr = require('newrelic');

const DockerContainer = require('../container/docker');
const K8sContainer = require('../container/k8s');

const log = require('../../utils/logger');
const { env } = require('../../../config');
const { getAccountIdentifierValue } = require('../../helper/account');
const { resolveDockerImage } = require('../../helper/engineDockerImage');
const { ACCOUNT_PROVIDER } = require('../../helper/core-api/enums');

const MINIO_PROVIDER = 'minio';

class EngineRun {
  constructor(platform, account, scan, repository) {
    this.platform = platform;
    this.account = account;
    this.scan = scan;
    this.repository = repository;
  }

  async run(
    engineInfo,
    srcLocation,
    rootPath,
    excludePaths,
    srcSize,
    scanConfig,
    envs = [],
    useEngineWrapper
  ) {
    const ContainerService = this.platform === 'k8s' ? K8sContainer : DockerContainer;
    const engine = await this.getEngine(engineInfo);
    const container = new ContainerService(engine, srcLocation, rootPath, excludePaths, this.scan);

    // if useEngineWrapper value is not set, use env.FEATURE_ENGINE_WRAPPER
    const engineWrapper =
      useEngineWrapper !== undefined ? useEngineWrapper : env.FEATURE_ENGINE_WRAPPER;

    const accountIdentifier = getAccountIdentifierValue(this.account);
    const repoPath = lodashGet(this.repository, 'path') || '';
    const vars = [
      `ACCOUNT_NAME=${accountIdentifier}`,
      `ACCOUNT_INTERNAL_ID=${this.account.providerInternalId}`,
      // `REPO_OWNER=${this.repository.owner}`,
      `REPO_OWNER=${this.account.login}`,
      `REPO_ID=${this.repository.idRepository}`,
      `REPO_NAME=${this.repository.name}`,
      `REPO_PATH=${repoPath}`,
      `IDSCAN=${this.scan.idScan}`,
      `SCAN_ID=${this.scan.idScan}`,
      `SCAN_TYPE=${this.scan.type}`,
      `ACCOUNT_ID=${this.account.idAccount}`,
      `ONPREMISE=${env.ONPREMISE}`,
      `ENVIRONMENT=${env.ENVIRONMENT}`,
      `DASHBOARD_URL=${env.DASHBOARD_URL}`,
      `BRANCH=${this.scan.branch}`,
      `SCAORACLEAGENT_URL=${env.SCAORACLEAGENT_URL}`,
      `AMQP_URI=${env.AMQP_URI}`,
      `SCAN_TIMESTAMP=${scanConfig.scanTimestamp}`,
      `NUMBER_OF_ENGINE_TO_RUN=${scanConfig.totalEnginesRun}`,
      `ENGINE_TIMEOUT_IN_MINUTE=${engine.timeoutInMinutes}`,
      `ENGINE_RUN_TYPE=${engine.runType}`,
      `ENGINE_ID=${engineInfo.idEngine}`,
      `ENGINE_NAME=${engineInfo.name}`,
      `FEATURE_ENGINE_WRAPPER=${engineWrapper}`,
      ...envs
    ];

    if (env.FEATURE_ENGINE_RUN_V3 && this.platform === 'k8s') {
      const providerType = engineInfo.minioObjectName
        ? MINIO_PROVIDER
        : this.account.provider.trim();

      // set env for init container job
      vars.push(
        `PROVIDER_TYPE=${providerType.toLowerCase()}`,
        `PROVIDER_INTERNAL_ID=${this.repository.providerInternalId}`,
        `CURRENT_COMMIT_SHA=${this.scan.sha}`,
        `DIFF_COMMIT_SHA=${this.scan.baseSha || ''}`,
        `REPO_SIZE=${srcSize}`
      );

      if (providerType === ACCOUNT_PROVIDER.GITHUB) {
        // set env for github provider
        vars.push(`GITHUB_INSTALLATION_ID=${this.account.installationId}`);
      } else if (providerType === ACCOUNT_PROVIDER.GITLAB) {
        // set env for gitlab provider
        vars.push(`GITLAB_PROJECT_ID=${this.repository.providerInternalId}`);
      } else if (providerType === ACCOUNT_PROVIDER.BITBUCKET) {
        // set env for bitbucket provider
        vars.push(
          `BITBUCKET_USER_OR_TEAM_UUID=${this.account.providerInternalId}`,
          `BITBUCKET_REPOSITORY_UUID=${this.repository.providerInternalId}`
        );
      } else if (providerType === ACCOUNT_PROVIDER.BITBUCKET_DATA_CENTER) {
        // set env for bitbucket data center provider
        vars.push(
          `BITBUCKET_DATA_CENTER_PROJECT_ID=${lodashGet(
            this.account,
            'providerMetadata.projectKey'
          )}`
        );
      } else if (providerType === MINIO_PROVIDER) {
        // set env for minio provider
        vars.push(`MINIO_OBJECT_NAME=${engineInfo.minioObjectName}`);
      }
    }

    const className = this.constructor.name;
    const run = nr.startBackgroundTransaction(
      `engine-run/${className}-run${env.FEATURE_ENGINE_RUN_V3 ? '-v3' : ''}`,
      'engine',
      async () => container.run(engineWrapper, vars)
    );

    return run;
  }

  async getEngine(engine) {
    let timeoutInMinutes = engine && ['java', 'go', 'dotnet'].includes(engine.language) ? 25 : 10;
    if (env.ENGINE_CUSTOM_TIMEOUT_MIN !== 0) timeoutInMinutes = env.ENGINE_CUSTOM_TIMEOUT_MIN;
    const image = engine && resolveDockerImage(engine, engine.type);
    return { ...engine, image, timeoutInMinutes };
  }

  parseEngineOutput(engineOutput, idScan, idEngine) {
    /**
     * engineOutput can be:
     *  - parsed docker logs - string
     *  - cought exception - Error (coming from resolve(e))
     *  - timeout error - string
     * */
    let parsedEngineOutput;
    try {
      parsedEngineOutput = JSON.parse(engineOutput); // TODO: If engineOutput is an Error, it doesn't make sense to try to parse it
      if (lodashGet(parsedEngineOutput, 'status') === 'error') {
        throw Error(`Engine finished with status = "error"`);
      }

      if (lodashGet(parsedEngineOutput, 'status') === 'unsuccessful') {
        throw Error(`Engine finished with status = "unsuccessful"`);
      }

      // ignore error/debug-log for engine status = timeout
      if (lodashGet(parsedEngineOutput, 'status') === 'timeout') {
        const timeoutTime = lodashGet(parsedEngineOutput, 'executionTime');
        throw Error(`Engine timeout [${timeoutTime} ms]`);
      }

      if (
        lodashGet(parsedEngineOutput, 'output', null) === null ||
        typeof lodashGet(parsedEngineOutput, 'output')[Symbol.iterator] !== 'function'
      ) {
        throw Error(`Engine finished with output not being an iterator`);
      }

      if (
        lodashGet(parsedEngineOutput, 'status') === 'success' &&
        Array.isArray(lodashGet(parsedEngineOutput, 'errors')) &&
        parsedEngineOutput.errors.length !== 0 &&
        parsedEngineOutput.errors[0] !== '' // because some engine return "errors":[""]
      ) {
        throw Error(`Engine finished with status = "error"`);
      }
    } catch (e) {
      log.warn(
        `<${idScan}-${idEngine}> parsedEngineOutput error`,
        JSON.stringify(JSON.parse(engineOutput || '')).slice(0, 500)
      );
      throw e;
    }
    return parsedEngineOutput;
  }
}

module.exports = EngineRun;
