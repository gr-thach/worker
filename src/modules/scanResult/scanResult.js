const { env } = require('../../../config');
const log = require('../../utils/logger');
const { RabbitMQConnection } = require('../../services/rabbitmq');

const sendScanResultToQueue = async scanResult => {
  try {
    const channel = await RabbitMQConnection.getScanResultChannel();
    await channel.publish(
      env.AMQP_SCAN_RESULT_EXCHANGE_NAME,
      env.AMQP_SCAN_RESULT_QUEUE,
      Buffer.from(JSON.stringify(scanResult))
    );
    log.info('Publish message to scan result exchange');
  } catch (e) {
    log.warn('Failed to publish message to scan result exchange');
  }
};

const notifyScanStatusToSummarizer = async (scanId, scanStamp, status, data) => {
  const channel = await RabbitMQConnection.getScanResultChannel();
  const content = {
    status,
    scan_id: scanId,
    scan_timestamp: `${scanStamp}`,
    data
  };

  try {
    channel.publish(
      env.AMQP_SCAN_RESULT_EXCHANGE_NAME,
      env.AMQP_SCAN_EVENT_QUEUE,
      Buffer.from(JSON.stringify(content))
    );
    log.info('Notified scan to summarizer.');
  } catch (e) {
    log.warn('Failed to notified scan to summarizer!');
  }
};

module.exports = {
  sendScanResultToQueue,
  notifyScanStatusToSummarizer
};
