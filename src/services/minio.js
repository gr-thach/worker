/* eslint-disable no-console */
const minio = require('minio');

const { env } = require('../../config');

class MinioClient {
  constructor() {
    this.client = new minio.Client({
      endPoint: env.STORAGE_HOST,
      accessKey: env.STORAGE_ACCESS_KEY,
      secretKey: env.STORAGE_SECRET_KEY,
      port: parseInt(env.STORAGE_PORT, 10) || 443,
      region: env.STORAGE_S3_REGION,
      useSSL: true
    });

    this.client.setRequestOptions({
      rejectUnauthorized: false
    });
  }

  async getFile(fileName, destPath, storageBucketName) {
    try {
      await this.client.fGetObject(storageBucketName, fileName, destPath);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async getFileAsString(fileName, storageBucketName) {
    try {
      const stream = await this.client.getObject(storageBucketName, fileName);

      const chunks = [];

      // eslint-disable-next-line no-restricted-syntax
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      return buffer.toString('utf-8');
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async removeFile(fileName, storageBucketName) {
    try {
      await this.client.removeObject(storageBucketName, fileName);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
}

module.exports = new MinioClient();
