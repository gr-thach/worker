require('global-agent/bootstrap');
require('newrelic');

const http = require('http');
const prometheus = require('prom-client');
const k8s = require('@kubernetes/client-node');

const ContainerService = require('./src/services/container');
const queueConsumer = require('./src/queue');
const queueUpdater = require('./src/queueUpdater');
const { env, isK8s, k8sNamespace } = require('./config');
const log = require('./src/utils/logger');
const reportError = require('./src/utils/sentry');
const { sleep } = require('./src/helper/common');

global.Promise = require('bluebird');

global.Promise.config({
  longStackTraces: true
});

let server;
let rabbitmqConnection;

prometheus.register.registerMetric(
  new prometheus.Summary({
    name: 'worker_engine_run_time_seconds',
    help: 'Time needed to run a engine in seconds',
    labelNames: ['engineName', 'scanType'],
    percentiles: [0.5, 0.8, 0.9, 0.95, 0.99]
  })
);

prometheus.register.registerMetric(
  new prometheus.Summary({
    name: 'worker_engine_run_output_count',
    help: 'Count scan jobs',
    labelNames: ['engineName', 'success', 'scanType']
  })
);

prometheus.register.registerMetric(
  new prometheus.Summary({
    name: 'worker_engine_prepare_source_code_time_seconds',
    help: 'Time need to prepare source code in seconds',
    labelNames: ['provider'],
    percentiles: [0.5, 0.8, 0.9, 0.95, 0.99]
  })
);

prometheus.register.registerMetric(
  new prometheus.Counter({
    name: 'worker_engine_run_skipped_count',
    help: 'Count Skipped engine run',
    labelNames: ['engineName', 'version']
  })
);

// init
(async () => {
  server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    switch (req.url) {
      case '/healthcheck':
        res.writeHead(200);
        res.end(`{ status: 'ok' }`);
        break;
      case '/metrics':
        res.setHeader('Content-Type', prometheus.register.contentType);
        res.end(prometheus.register.metrics());
        break;
      default:
        res.writeHead(404);
        res.end(`{ error: 'not found' }`);
    }
  });
  server.listen(env.PORT);

  // TODO: only if docker
  if (!isK8s) {
    const containerService = new ContainerService();
    await containerService.dockerHostHealthCheck();
    if (['production', 'staging'].includes(env.ENVIRONMENT)) {
      await Promise.all([
        containerService.pullEnginesImages(),
        containerService.pullHelperEnginesImages(),
        containerService.cleanServices()
      ]);
    }
  }

  rabbitmqConnection = await queueConsumer.start();
  log.info('Worker up and running');

  await queueUpdater.migrate();
})();

const cleanupRabbitmq = async () => {
  if (rabbitmqConnection) {
    await rabbitmqConnection.close();
  }
};

const cleanupJobs = async () => {
  if (isK8s) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sBatch = kc.makeApiClient(k8s.BatchV1Api);
    try {
      await k8sBatch.deleteCollectionNamespacedJob(
        k8sNamespace,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        0,
        `worker-pod-name=${env.K8S_POD_NAME}`,
        undefined,
        undefined,
        'Background'
      );
    } catch (e) {
      // ignore
    }
  }
};

const cleanup = async () => {
  await cleanupRabbitmq();
  global.TERMINATING = true;
  await sleep(10000);
  await cleanupJobs();
};

process.on('SIGTERM', async () => {
  log.fatal('SIGTERM');
  await cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  log.fatal('SIGINT');
  await cleanup();
  process.exit(0);
});

process.on('unhandledRejection', async err => {
  log.fatal('unhandledRejection', err);
  const eventId = await reportError(err);
  log.info(`Sentry event sent [${eventId}]`);
  await cleanup();
  process.exit(1);
});

process.on('uncaughtException', async err => {
  log.fatal('uncaughtException', err);
  const eventId = await reportError(err);
  log.info(`Sentry event sent [${eventId}]`);
  await cleanup();
  process.exit(1);
});
