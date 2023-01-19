const k8s = require('@kubernetes/client-node');
const lodashGet = require('lodash/get');

const BaseContainer = require('./base');
const K8sJob = require('./k8sJob');
const jobPool = require('./k8sJobPool');

const reportError = require('../../utils/sentry');
const { env, engineResources, k8sNamespace } = require('../../../config');
const { generateEngineErrorResult, generateEngineWrapperSuccessResult } = require('./helper');
const {
  getNodeAffinity,
  getPodAffinity,
  getVolumes,
  getVolumeMounts,
  buildInitContainerSpecs,
  buildScanContainerSpecs,
  buildJobTemplate
} = require('./k8sJobHelper');
const engineRunType = require('../engineRun/engineRunType');

class K8sContainer extends BaseContainer {
  constructor(engine, srcLocation, rootPath, excludePaths, scan) {
    super(scan);
    this.namespace = k8sNamespace;
    this.timeoutInMinutes = engine.timeoutInMinutes;
    this.idScan = scan.idScan;
    this.sha = scan.sha;
    this.srcLocation = srcLocation;
    this.rootPath = rootPath;
    this.excludePaths = excludePaths;
    this.engineName = engine.name;
    this.engineImage = engine.image;
    this.engineId = engine.idEngine;
    this.engineCustomConfig = engine.customConfig;
    this.engineType = engine.type;
    this.engine = engine;
  }

  async run(useEngineWrapper, envs = []) {
    try {
      const vars = [...envs];
      const envVars = vars.reduce((r, e) => {
        const [name, value] = e.split('=');
        return [...r, { name, value }];
      }, []);

      const job = await this.createJob(envVars);

      // add job to pool
      const jobName = lodashGet(job, 'metadata.name');
      if (!jobName) {
        return generateEngineErrorResult(
          this.engineName,
          'Engine scan job error',
          this.timeoutInMinutes
        );
      }
      const srcPath = `${this.srcLocation}/${this.rootPath}`;
      const k8sJob = new K8sJob(
        this.namespace,
        jobName,
        this.idScan,
        this.engine,
        this.timeoutInMinutes,
        srcPath
      );

      if (useEngineWrapper) {
        // to bypass engine output check in parseEngineOutput()
        return generateEngineWrapperSuccessResult(this.engineName);
      }

      jobPool.watchJob(k8sJob);

      const result = await k8sJob.wait();
      return result;
    } catch (e) {
      reportError(e);
      throw e;
    }
  }

  // k8s
  async createJob(envVar = []) {
    const {
      engineId,
      srcLocation,
      rootPath,
      excludePaths,
      engineName,
      idScan,
      engineImage,
      engineCustomConfig,
      timeoutInMinutes
    } = this;
    const podResource = engineResources[engineName] || engineResources.default;

    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sBatch = kc.makeApiClient(k8s.BatchV1Api);

    // Name must be no more than 63 characters
    // srcLocation = /tmp/something/scan-[idScan:36]-[timestamp:10]-[random]-[srcPart]-[full|diff]/
    // -> srcSuffix = [srcPart]-[full|diff]
    // -> name = scan-[idScan:32]-[engine]-[srcPart]-[full|diff]
    const srcWithoutLastSlash = (srcLocation || '').slice(0, -1);
    const srcSuffix = srcWithoutLastSlash.split('-').slice(-2);
    const jobGroup = `scan-${idScan.replace(/-/g, '')}`;
    const name = [jobGroup, engineId, ...srcSuffix].join('-');

    // improve mount folder structure with engineCustomConfig path on V3
    const configSrcLocation = env.FEATURE_ENGINE_RUN_V3
      ? srcLocation.replace(/-diff$|-full$/, '-config')
      : engineCustomConfig;

    const engineMountPoint = this.getEngineMountPoint();
    const volumes = getVolumes();
    const volumeMounts = getVolumeMounts(
      engineMountPoint,
      srcLocation,
      rootPath,
      excludePaths,
      configSrcLocation
    );

    const scanRunType = this.engine.runType;
    const isSmartScan = scanRunType === engineRunType.SCAN_PARTIAL;
    // because createJob does not have fullSrcLocation in smartScan type, the fullSrcLocation need to generate base on diffSrcLocation
    const fullSrcLocation = isSmartScan ? srcLocation.replace(/-diff$/, '-full') : srcLocation;
    const diffSrcLocation = isSmartScan ? srcLocation : '';

    const initContainer = buildInitContainerSpecs(
      jobGroup,
      fullSrcLocation,
      diffSrcLocation,
      configSrcLocation,
      scanRunType,
      envVar
    );
    const scanContainer = buildScanContainerSpecs(engineImage, volumeMounts, podResource, envVar);

    const nodeAffinity = getNodeAffinity();
    const podAffinity = env.FEATURE_ENGINE_RUN_V3 ? getPodAffinity(jobGroup) : {};
    const affinity = { ...nodeAffinity, ...podAffinity };

    const job = await k8sBatch.createNamespacedJob(
      this.namespace,
      buildJobTemplate(
        name,
        jobGroup,
        initContainer,
        scanContainer,
        volumes,
        env.USE_LOCAL_K8S ? {} : affinity,
        timeoutInMinutes
      )
    );
    return lodashGet(job, 'body');
  }
}

module.exports = K8sContainer;
