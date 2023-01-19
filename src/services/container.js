const Dockerode = require('dockerode');

const { env } = require('../../config');
const { resolveDockerImage } = require('../helper/engineDockerImage');
const log = require('../utils/logger');
const { getEngines, getHelperEngines } = require('../helper/core-api/engines');
const { removeDockerContainerById } = require('../modules/container/helper');

class ContainerService {
  constructor() {
    this.docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
  }

  async dockerHostHealthCheck() {
    return this.docker.ping();
  }

  async pullImages(engines, type) {
    try {
      const imagesPulls = [];
      engines.forEach(engine => {
        const isCustom = !!engine.fkAccount;
        const dockerImage = resolveDockerImage(engine, type);
        imagesPulls.push(
          this.docker.pull(dockerImage, {
            authconfig: {
              key: isCustom ? env.DOCKER_HUB_CUSTOM_ENGINES_AUTH_BASE64 : env.DOCKER_HUB_AUTH_BASE64
            }
          })
        );
      });
      await Promise.all(imagesPulls);
    } catch (e) {
      log.error(
        `Error pulling docker images for type = ${type}. Images for this type were not update. Worker will still proceed to start as normal.`,
        e
      );
    }
  }

  async cleanServices() {
    // This cleans up worker and cleanup containers
    const services = await this.docker.listContainers({
      filters: { label: ['io.guardrails.cleanup'], status: ['exited', 'dead'] }
    });

    for (const service of services) {
      removeDockerContainerById(this.docker, service.Id);
    }
  }

  async pullEnginesImages() {
    const engines = await getEngines();
    await this.pullImages(engines, 'engine');
  }

  async pullHelperEnginesImages() {
    const engines = await getHelperEngines();
    await this.pullImages(engines, 'helper');
  }
}

module.exports = ContainerService;
