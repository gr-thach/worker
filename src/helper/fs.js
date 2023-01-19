const fs = require('fs');

const log = require('../utils/logger');

const getSubDir = dir => {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  } catch {
    log.warn('Get dir not found', dir);
    return [];
  }
};

/**
 * strip leading components in filename
 *
 * @param str
 * @param stripLevel
 * @returns {string}
 */
const stripName = (str, stripLevel) => {
  return str
    .split('/')
    .slice(stripLevel)
    .join('/');
};

const byteSize = str => typeof str === 'string' && Buffer.byteLength(str, 'utf8');

// check valid path on UNIX
// max path length 4096 and each file segment length under 255
const checkPathLength = path => {
  const MAX_PATH_LENGTH = 4096;
  const MAX_FILE_LENGTH = 255;

  if (!path) {
    return true;
  }

  if (byteSize(path) >= MAX_PATH_LENGTH) {
    return false;
  }

  return path.split('/').every(p => byteSize(p) < MAX_FILE_LENGTH);
};

module.exports = {
  getSubDir,
  stripName,
  checkPathLength
};
