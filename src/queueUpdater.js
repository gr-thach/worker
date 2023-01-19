const amqp = require('amqp-connection-manager');
const { env } = require('../config');

const currentQueueName = env.AMQP_QUEUE_NAME;
const scanQueue = env.AMQP_SCAN_QUEUE;

// since we can not update queue argument after it created, queue need to be delete and re-create
const migrate = async () => {
  const migrationConnection = await amqp.connect([env.AMQP_URI]);

  /* eslint-disable no-await-in-loop */
  const migrateQueueMessages = async channel => {
    try {
      // migrate all messages from prevQueue to currentQueue and then delete prevQueue
      let msg = await channel.get(currentQueueName);
      while (msg) {
        await channel.sendToQueue(scanQueue, msg.content, msg.properties);
        channel.ack(msg);
        msg = await channel.get(currentQueueName);
      }

      // Note: there is chance that this migrate complete while an old-worker keep consuming msg -> msg cant be get to migrate
      //       So delete the queue at this stage can lead to error or lost msg
      // delete prev queue
      // await channel.deleteQueue(currentQueueName);
    } catch {
      // ignore any exception
    } finally {
      await migrationConnection.close();
    }
  };
  /* eslint-enable no-await-in-loop */

  migrationConnection.createChannel({
    setup: channel => Promise.all([migrateQueueMessages(channel)])
  });
};

module.exports = {
  migrate
};
