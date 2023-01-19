const Dockerode = require('dockerode');
const prometheus = require('prom-client');

const BaseContainer = require('./base');

const log = require('../../utils/logger');
const { env } = require('../../../config');
const { sleep } = require('../../helper/common');
const {
  generateEngineTimeoutResult,
  generateEngineWrapperSuccessResult,
  removeDockerContainerById
} = require('./helper');

const maxRunningContainer = env.ONPREMISE_DOCKER_MAX_RUNNING_CONTAINERS; // default 5
const waitLimit = env.ONPREMISE_DOCKER_CONTAINERS_WAIT_LIMIT; // default 15 min
const maxCreatedEngineTimeoutInSeconds = 7200;

class DockerContainer extends BaseContainer {
  constructor(engine, srcLocation, rootPath, excludePaths, scan) {
    super();
    this.docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
    this.container = null;
    this.timeoutInMinutes = engine.timeoutInMinutes;
    this.idScan = scan.idScan;
    this.sha = scan.sha;
    this.srcLocation = srcLocation;
    this.rootPath = rootPath;
    this.excludePaths = excludePaths;
    this.engineName = engine.name;
    this.engineImage = engine.image;
    this.engineType = engine.type;
    this.engine = engine;
  }

  async cleanStoppedContainers() {
    const containers = await this.docker.listContainers({
      filters: { label: ['enginerun'], status: ['exited', 'dead'] }
    });

    for (const container of containers) {
      removeDockerContainerById(this.docker, container.Id);
    }
  }

  async checkRunningContainerReachedLimit() {
    const containers = await this.docker.listContainers({
      filters: { label: ['enginerun'], status: ['created', 'running'] }
    });

    // and check the Created timestamp of the containers[i] to see if it's older than 2 hours
    // if it's older than 2 hours, we should kill the container
    const currentTimestampInSeconds = new Date().getTime() / 1000;
    let count = 0;
    for (const container of containers) {
      if (currentTimestampInSeconds - container.Created >= maxCreatedEngineTimeoutInSeconds) {
        removeDockerContainerById(this.docker, container.Id);
      } else {
        count += 1;
      }
    }

    return count >= maxRunningContainer;
  }

  async run(useEngineWrapper, envs = []) {
    const { engineName } = this;
    const envVars = [...envs];
    if (!this.engineImage) {
      return `No engine found for ${engineName}`;
    }

    // add a random delay in range of 0s to 3s to reduce race condition
    await sleep(Math.floor(Math.random() * 3000));

    /* eslint-disable no-await-in-loop */
    let waitCount = 0;
    this.cleanStoppedContainers();
    while ((await this.checkRunningContainerReachedLimit()) && waitCount < waitLimit) {
      await sleep(1000);
      waitCount += 1;
    }
    /* eslint-enable no-await-in-loop */

    log.info(`Running ${engineName}`);

    const engineMountPoint = this.getEngineMountPoint();

    const binds = [];
    if (this.srcLocation) {
      binds.push(
        `${this.srcLocation}/${this.rootPath}:/opt/mount/${engineMountPoint}${this.rootPath}:ro`
      );
    }

    if (this.excludePaths && this.excludePaths.length) {
      const overlays = [];
      for (const path of this.excludePaths) {
        // any rootPath will be the excludePath of the its parent, so we need to filter it to prevent duplicated mount
        if (path.indexOf(this.rootPath) === 0 && path !== this.rootPath) {
          overlays.push(path);
        }
      }

      // filter overlay if parent folder existed. e.g. ['/root/a/b', '/root/a'] -> ['/root/a']
      const filteredOverlays = [];
      for (const path of overlays) {
        if (!overlays.find(p => path.indexOf(p) === 0 && p.length < path.length)) {
          filteredOverlays.push(path);
        }
      }

      for (const path of filteredOverlays) {
        // TODO: is that empty-folder safe ?
        binds.push(
          `/tmp/folder-that-not-exist-on-host-machine-guardrails/:/opt/mount/${engineMountPoint}${path}:ro`
        );
      }
    }

    // as on-prem docker swarm support custom volumn mount to not necessarily /tmp (default) anymore
    //    ref: https://github.com/guardrailsio/production/blob/b085a8fa4c6b879502e95ab1cc9f39d740c5b387/onpremise/replicated.yaml#L942
    // and because the way src code mount to engine is via Host config
    // so the Binds need to be update accordingly from default /tmp to env.ONPREMISE_DOCKER_CONTAINERS_WORKER_TMP_MOUNT
    const tmpMountPath = env.ONPREMISE_DOCKER_CONTAINERS_WORKER_TMP_MOUNT.endsWith('/')
      ? env.ONPREMISE_DOCKER_CONTAINERS_WORKER_TMP_MOUNT.slice(0, -1)
      : env.ONPREMISE_DOCKER_CONTAINERS_WORKER_TMP_MOUNT;
    for (let i = 0; i < binds.length; i += 1) {
      binds[i] = binds[i].replace(/^\/tmp/, tmpMountPath);
    }
    const hostConfig = {
      Binds: binds,
      // The config to bind the engine on the same network with guardrails stack
      // This one only affects to docker-compose deployment
      ...(useEngineWrapper ? { NetworkMode: env.DOCKER_NETWORK_NAME } : {})
    };

    const containerConfigs = {
      Name: this.sha,
      Image: this.engineImage,
      Env: envVars,
      HostConfig: hostConfig,
      Labels: { enginerun: 'true' }
    };

    this.container = await this.docker.createContainer(containerConfigs);

    const hrstart = process.hrtime();
    const engineRunTimer = prometheus.register.getSingleMetric('worker_engine_run_time_seconds');
    const engineRunTimerEnd = engineRunTimer.startTimer();

    if (this.engine.customConfig) {
      await this.container.putArchive(this.engine.customConfig, { path: '/opt/config/' });
    }

    log.info(`Container [${this.engineImage}] started`);
    this.container = await this.container.start();

    if (useEngineWrapper) {
      // to bypass engine output check in parseEngineOutput()
      return generateEngineWrapperSuccessResult(engineName);
    }

    const engineOutput = await Promise.race([
      // eslint-disable-next-line no-async-promise-executor
      new Promise(async resolve => {
        try {
          await this.container.wait();
          const logs = await this.container.logs({
            stdout: true,
            stderr: false
          });
          resolve(this.parseLogs(logs));
        } catch (e) {
          resolve(e.stack);
        }
      }),
      new Promise(resolve => {
        const id = setTimeout(() => {
          clearTimeout(id);
          resolve(generateEngineTimeoutResult(engineName, null, this.timeoutInMinutes));
        }, this.timeoutInMinutes * 60 * 1000); // minutes to ms
      })
    ]);

    // prometheus metrics
    engineRunTimerEnd({ engineName, scanType: this.engine.runType });

    const hrend = process.hrtime(hrstart);
    log.info(
      `[${this.idScan}] run ${this.engineImage} type=${this.engine.runType} at ${this.srcLocation}/${this.rootPath}} in ${hrend}s`
    );

    await this.container.remove({ force: true });
    return engineOutput;
  }
}

module.exports = DockerContainer;
