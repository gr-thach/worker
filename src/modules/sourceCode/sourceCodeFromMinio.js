const SourceCode = require('./sourceCode');

const minioClient = require('../../services/minio');
const log = require('../../utils/logger');
const {
  constants: { minio }
} = require('../../../config');

class SourceCodeFromMinio extends SourceCode {
  constructor(platform, scan, minioFileName) {
    super(platform, scan);
    this.minioBucketName = minio.cliBucketName;
    this.minioFileName = minioFileName;
  }

  async downloadSrc() {
    return this.pullSrcFromMinio(this.minioFileName, this.minioBucketName, this.baseTar);
  }

  async pullSrcFromMinio(fileName, storageBucketName, destPath) {
    if (!fileName || !storageBucketName) {
      log.info(
        `helper/scan.js > pullSrcFromMinio without filename/bucket ${fileName}/${storageBucketName}`
      );
      return false;
    }

    log.info(
      `helper/scan.js > Got fileName/bucket = '${fileName}/${storageBucketName}', we're gonna scan this file only`
    );
    return minioClient.getFile(fileName, destPath, storageBucketName);
  }

  cleanSrc() {
    minioClient
      .removeFile(this.minioFileName, this.minioBucketName)
      .catch(e => log.error(`failed to remove minioFileName=[${this.minioFileName}]`, e));
    super.cleanSrc();
  }
}

module.exports = SourceCodeFromMinio;
