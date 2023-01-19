const IoRedis = require('ioredis');

const { env } = require('../../config');
const log = require('../utils/logger');

class Redis {
  constructor() {
    this.isReady = false;
    if (env.IPV6) {
      this.client = new IoRedis({ family: 6, host: 'redis' });
    } else {
      this.client = new IoRedis(env.REDIS_URL);
    }

    this.client
      .on('error', () => {
        if (this.isReady) {
          log.warn('Redis error');
        }
        this.isReady = false;
      })
      .on('ready', () => {
        log.warn('Redis ready');
        this.isReady = true;
      });

    this.keys = {
      ENGINES_DB_KEY: 'worker_engines_db',
      ENGINES_HELPER_DB_KEY: 'worker_helper_engines_db',
      ENGINE_RULES_DB_KEY: 'worker_engines_rules_db',
      ENGINE_RUN_STATUS_DB_KEY: 'worker_engines_run_status_db',
      SEVERITY_DB_KEY: 'worker_severity_db',
      SCAN_STATUS_NAME_MAPPING_DB_KEY: 'worker_scan_status_name_mapping_db',
      SCAN_RESULT_NAME_MAPPING_DB_KEY: 'worker_scan_result_name_mapping_db'
    };
  }

  async get(key) {
    if (!this.isReady) {
      return undefined;
    }

    const result = await this.client.get(key);
    return result;
  }

  async set(key, value, expire = 600) {
    if (!this.isReady) {
      return undefined;
    }

    let result = await this.client.set(key, value);
    if (Number.isInteger(expire)) {
      result = await this.client.expire(key, expire);
    }
    return result;
  }
}

module.exports = new Redis();
