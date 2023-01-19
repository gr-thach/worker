const k8s = require('@kubernetes/client-node');
const prometheus = require('prom-client');

const log = require('../../utils/logger');
const { sleep } = require('../../helper/common');
const { generateEngineTimeoutResult } = require('./helper');

const tick = 1000;

const jobStatus = ['Pending', 'Running', 'Complete', 'Failed'];

class K8sJob {
  constructor(namespace, name, idScan, engine, timeoutInMinutes, srcPath) {
    this.namespace = namespace;
    this.jobName = name;
    this.idScan = idScan;
    this.engine = engine;
    this.timeoutInMinutes = timeoutInMinutes;
    this.srcPath = srcPath;
    this.statusIndex = 0;
    this.podName = '';

    this.createdAt = Math.floor(Date.now() / 1000);
    this.runAt = undefined;
    this.resultReady = false;
  }

  updateStatus(status, podName) {
    const newStatusIndex = jobStatus.indexOf(status);

    if (newStatusIndex <= this.statusIndex) {
      return;
    }

    // this is a little magic since we know status always start as Pending
    if (jobStatus[newStatusIndex] !== 'Pending') {
      if (!this.runAt) {
        this.runAt = Math.floor(Date.now() / 1000);
      }
      this.engineRunTimerEnd = prometheus.register
        .getSingleMetric('worker_engine_run_time_seconds')
        .startTimer();
    }

    if (jobStatus[newStatusIndex] === 'Complete' || jobStatus[newStatusIndex] === 'Failed') {
      this.podName = podName;
      this.resultReady = true;
    }

    this.statusIndex = newStatusIndex;
  }

  getStatus() {
    return jobStatus[this.statusIndex];
  }

  checkJobRunTimeout() {
    return (
      this.getStatus() === 'Running' &&
      Math.floor(Date.now() / 1000) - this.runAt > this.timeoutInMinutes * 60
    );
  }

  getTimeSpend() {
    return Math.floor(Date.now() / 1000) - this.createdAt;
  }

  checkJobWaitTimeout() {
    if (this.getStatus() !== 'Pending') {
      return false;
    }
    // stop if engine not able to schedule for a while (timeout x 5)
    return this.getTimeSpend() > this.timeoutInMinutes * 60 * 5;
  }

  async wait() {
    while (!this.resultReady) {
      // check job run timeout
      if (this.checkJobRunTimeout()) {
        break;
      }

      // check job wait limit
      if (this.checkJobWaitTimeout()) {
        break;
      }

      if (global.TERMINATING) {
        return generateEngineTimeoutResult(
          this.engine.name,
          'worker job terminating...',
          this.getTimeSpend() / 60
        );
      }

      await sleep(tick); // eslint-disable-line no-await-in-loop
    }

    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sCore = kc.makeApiClient(k8s.CoreV1Api);

    let result;
    if (this.getStatus() === 'Complete' && this.podName) {
      const podLog = await k8sCore.readNamespacedPodLog(this.podName, this.namespace);
      result = JSON.stringify(podLog.body);
    } else {
      result = generateEngineTimeoutResult(this.engine.name, null, this.timeoutInMinutes);
    }

    // prometheus metrics
    if (this.engineRunTimerEnd) {
      this.engineRunTimerEnd({ engineName: this.engine.name, scanType: this.engine.runType });
    }

    const runTime = Math.floor(Date.now() / 1000) - this.runAt;
    log.info(
      `[${this.idScan}] run ${this.engine.image} type=${this.engine.runType} at ${this.srcPath} in ${runTime}s`
    );
    return result;
  }
}

module.exports = K8sJob;
