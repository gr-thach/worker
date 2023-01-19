const fs = require('fs');
const archiver = require('archiver');

const filterEntryPaths = (entry, rootPath = '', excludedPaths = [], extractPaths = []) => {
  if (entry.name.indexOf(rootPath || '') !== 0) {
    return false; // remove
  }
  if (
    (excludedPaths || []).find(excludedPath => entry.name.indexOf(excludedPath.slice(0, -1)) === 0)
  ) {
    return false; // remove;
  }
  if (extractPaths && extractPaths.length && extractPaths.indexOf(entry.name) === -1) {
    return false; // remove;
  }
  return true; // keep
};

const archiveSrc = async (repositoryDir, tarFileName, rootPath, excludedPaths, extractPaths) => {
  const wstream = fs.createWriteStream(tarFileName);

  const archive = archiver('tar', { gzip: true });

  return new Promise((resolve, reject) => {
    archive
      .directory(repositoryDir, false, entry =>
        filterEntryPaths(entry, rootPath, excludedPaths, extractPaths) ? entry : false
      )
      .on('error', err => reject(err))
      .pipe(wstream);

    wstream.on('close', () => resolve(tarFileName));
    archive.finalize();
  });
};

module.exports = {
  archiveSrc
};
