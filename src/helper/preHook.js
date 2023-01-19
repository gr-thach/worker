const minioClient = require('../services/minio');
const {
  constants: { minio }
} = require('../../config');
const log = require('../utils/logger');

const getPreHookDiff = async fileName => {
  const storageBucketName = minio.cliBucketName;

  if (!fileName || !storageBucketName) {
    log.error(
      `helper/preHook.js > getPreHookDiff without filename/bucket ${fileName}/${storageBucketName}`
    );
    return false;
  }

  log.info(
    `helper/preHook.js > Fetching diff file for fileName/bucket = '${fileName}/${storageBucketName}'.`
  );

  return minioClient.getFileAsString(fileName, storageBucketName);
};

const deletePreHookDiff = async fileName => {
  log.info(
    `helper/preHook.js > Deleting diff file, fileName/bucket = '${fileName}/${minio.cliBucketName}'.`
  );

  return minioClient
    .removeFile(fileName, minio.cliBucketName)
    .catch(e => log.error(`helper/preHook.js > failed to remove minioFileName=[${fileName}]`, e));
};

module.exports = {
  getPreHookDiff,
  deletePreHookDiff
};
