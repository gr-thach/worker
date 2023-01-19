const amqp = require('amqp-connection-manager');
const lodashGet = require('lodash/get');

const { env } = require('../config');
const reportError = require('./utils/sentry');
const log = require('./utils/logger');
const scanRun = require('./jobs/scanRun');
const scanReject = require('./jobs/scanReject');
const { sleep } = require('./helper/common');

const scanQueue = env.AMQP_SCAN_QUEUE;
const detectEngineQueue = env.AMQP_DETECT_ENGINE_QUEUE;

const handleJob = async (job, channel) => {
  const hrstart = process.hrtime();

  let msgAck = 'unknow';
  let payload;
  let idScan = '';
  let jobName = '';
  try {
    payload = JSON.parse(job.content.toString());
    idScan = payload.idScan;
    jobName = payload.name;
  } catch (e) {
    log.error(`Parse job message content error`, job);
  }

  try {
    if (jobName === 'generate-and-save-report') {
      log.info(`===> Consuming amqp message for idScan=[${idScan}]`);
      await scanRun(payload);
    } else if (jobName === 'detect-engine-to-run') {
      log.info(`===> Consuming amqp detect engine to run message for idScan=[${idScan}]`);
      await scanRun(payload);
    }
    channel.ack(job);
    msgAck = 'ack';
  } catch (e) {
    channel.nack(job, false, false);
    msgAck = 'nack';

    // do not report if error is "terminating"
    if (
      e.message !== 'worker full-scan terminating...' &&
      e.message !== 'worker smart-scan terminating...'
    ) {
      reportError(e).catch(() => {});
    }
  } finally {
    const hrend = process.hrtime(hrstart);
    log.info(`[${idScan}] Scan message ${msgAck} in ${hrend}s`);
  }
};

const handleDeadLetter = async (job, channel) => {
  try {
    const payload = JSON.parse(job.content.toString());
    const header = lodashGet(job, 'properties.headers.x-death', []);
    const { count, reason } = header.find(d => d.count > env.AMQP_DEAD_LETTER_MAX_RETRY) || {};

    if (reason) {
      await scanReject(payload, count);
      log.info(`[${payload.idScan}] REJECTED with reason=${reason} after ${count} tries`);
    } else {
      await sleep(5000);
      await channel.sendToQueue(scanQueue, job.content, { ...job.properties });

      // sort to get latest x-death property by count
      header.sort((a, b) => b.count - a.count);
      const { count: requeueCount, reason: requeueReason } = lodashGet(header, '[0]', {});
      log.info(`[${payload.idScan}] REQUEUED with reason=${requeueReason} at try=${requeueCount}`);
    }
  } catch (e) {
    reportError(e).catch(() => {});
  } finally {
    channel.ack(job);
  }
};

const start = async () => {
  let logDisconnectError = true;
  const conn = await amqp.connect([env.AMQP_URI], {
    heartbeatIntervalInSeconds: 1800,
    reconnectTimeInSeconds: 30
  });
  conn.on('connect', () => {
    log.info('Queue: connected!');
    logDisconnectError = true;
  });
  conn.on('disconnect', ({ err }) => {
    if (logDisconnectError) {
      log.warn('Queue: disconnected!', err);
      reportError(err);
      logDisconnectError = false;
    }

    // kill worker when get rabbitmq disconnected to prevent ack msg on difference channel and auto reconnect (when worker restart)
    process.kill(process.pid, 'SIGINT');
  });

  const channelWrapper = conn.createChannel({
    setup: channel => {
      log.info(`Queue: configured to prefetch up to ${env.AMQP_QUEUE_PREFETCH} messages`);
      const deadLetterExchange = `${env.AMQP_DEAD_LETTER_SCAN_QUEUE}-exchange`;
      const deadLetterRoutingKey = `${env.AMQP_DEAD_LETTER_SCAN_QUEUE}-key`;
      const detectEngineExchange = 'guardrails-detect-engine-exchange';
      return Promise.all([
        channel.assertQueue(scanQueue, {
          maxPriority: env.AMQP_QUEUE_MAX_PIORITY,
          durable: env.AMQP_QUEUE_DURABLE,
          messageTtl: env.AMQP_QUEUE_MESSAGE_TTL,
          deadLetterExchange,
          deadLetterRoutingKey
        }),
        channel.assertExchange(detectEngineExchange),
        channel.assertExchange(deadLetterExchange),
        channel.assertExchange(env.AMQP_SCAN_RESULT_EXCHANGE_NAME),
        channel.assertQueue(env.AMQP_DEAD_LETTER_SCAN_QUEUE, { durable: env.AMQP_QUEUE_DURABLE }),
        channel.bindQueue(
          env.AMQP_DEAD_LETTER_SCAN_QUEUE,
          deadLetterExchange,
          deadLetterRoutingKey
        ),
        channel.assertQueue(detectEngineQueue, {
          durable: true
        }),
        channel.bindQueue(detectEngineQueue, detectEngineExchange, detectEngineQueue),
        channel.prefetch(env.AMQP_QUEUE_PREFETCH),
        channel.consume(scanQueue, async job => {
          await handleJob(job, channelWrapper);
        }),
        channel.consume(detectEngineQueue, async job => {
          await handleJob(job, channelWrapper);
        }),
        channel.consume(env.AMQP_DEAD_LETTER_SCAN_QUEUE, async job => {
          await handleDeadLetter(job, channelWrapper);
        })
      ]);
    }
  });

  // This is just to give us some more insights of what happened
  channelWrapper.on('connect', () => log.info('Queue: channel connected'));
  channelWrapper.on('error', (err, { name }) => log.error('Queue: channel error', err, name));
  channelWrapper.on('close', () => log.warn('Queue: channel closed'));

  await channelWrapper.waitForConnect();
  log.info('Queue: listening for messages');

  return conn;
};

module.exports = {
  start
};
