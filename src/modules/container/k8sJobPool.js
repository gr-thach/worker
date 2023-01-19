const k8s = require('@kubernetes/client-node');
const lodashGet = require('lodash/get');

const log = require('../../utils/logger');
const { sleep } = require('../../helper/common');
const { env } = require('../../../config');

const tick = 2000;

class K8sJobPool {
  constructor(namespace) {
    this.namespace = namespace;
    this.pool = {};

    this.tick();
  }

  checkPoolEmpty() {
    return Object.keys(this.pool).length === 0;
  }

  watchJob(job) {
    if (!this.pool[job.jobName]) {
      this.pool[job.jobName] = job;
    }
  }

  removeJob(jobName) {
    delete this.pool[jobName];
  }

  cleanUpPool() {
    for (const job of Object.values(this.pool)) {
      if (!job || typeof job.checkJobWaitTimeout !== 'function' || job.checkJobWaitTimeout()) {
        this.removeJob(job.jobName);
      }
    }
  }

  async tick() {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sCore = kc.makeApiClient(k8s.CoreV1Api);
    const k8sBatch = kc.makeApiClient(k8s.BatchV1Api);

    /* eslint-disable no-await-in-loop */
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await sleep(tick);

      if (!this.checkPoolEmpty()) {
        let jobs;
        let pods;
        try {
          jobs = await k8sBatch.listNamespacedJob(
            this.namespace,
            null,
            null,
            null,
            null,
            'job-type=scan'
          );

          pods = await k8sCore.listNamespacedPod(
            this.namespace,
            null,
            null,
            null,
            null,
            `pod-type=scan`
          );
        } catch (e) {
          log.error(e);
          // ignore k8s api request error
        }

        const jobItems = lodashGet(jobs, 'body.items', []);
        const podItems = lodashGet(pods, 'body.items', []);

        for (const job of jobItems) {
          const jobName = job.metadata.name;
          const jobStatus = lodashGet(job, 'status.conditions[0].type', '');
          if (this.pool[jobName]) {
            // since Operarius, it is possible for multiple pod of a scan job
            // added filter by status.phase to pick the completed scan pod
            const jobPod = podItems.find(
              p =>
                lodashGet(p, 'metadata.labels.job-name') === jobName &&
                lodashGet(p, 'status.phase') === 'Succeeded'
            );
            const jobPodName = lodashGet(jobPod, 'metadata.name');

            if (jobStatus !== 'Failed' && jobStatus !== 'Complete') {
              const jobPodStatus = lodashGet(jobPod, 'status.phase');
              this.pool[jobName].updateStatus(
                jobPodStatus === 'Pending' ? 'Pending' : 'Running',
                jobPodName
              );
            } else {
              this.pool[jobName].updateStatus(jobStatus, jobPodName);
              this.removeJob(jobName);
            }
          }
        }

        this.cleanUpPool();
      }
    }
    /* eslint-enable no-await-in-loop */
  }
}

module.exports = new K8sJobPool(env.ONPREMISE ? env.ONPREMISE_K8S_NAMESPACE : 'guardrailsio');
