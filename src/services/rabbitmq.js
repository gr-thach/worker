const amqp = require('amqp-connection-manager');

const { env } = require('../../config');

const connectionSetting = {
  heartbeatIntervalInSeconds: 1800,
  reconnectTimeInSeconds: 30
};

class RabbitMQConnection {
  static instance;

  static scanResultChannel;

  static getInstance = async () => {
    if (RabbitMQConnection.isntace) {
      return RabbitMQConnection.instance;
    }
    RabbitMQConnection.instance = await amqp.connect([env.AMQP_URI], connectionSetting);
    return RabbitMQConnection.instance;
  };

  static getScanResultChannel = async () => {
    if (RabbitMQConnection.scanResultChannel) {
      return RabbitMQConnection.scanResultChannel;
    }
    const conn = await RabbitMQConnection.getInstance();
    const channel = await conn.createChannel();
    channel.assertExchange(env.AMQP_SCAN_RESULT_EXCHANGE_NAME, 'direct', {
      durable: true
    });
    RabbitMQConnection.scanResultChannel = channel;
    return RabbitMQConnection.scanResultChannel;
  };
}

module.exports = {
  RabbitMQConnection
};
