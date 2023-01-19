const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const tar = require('tar-stream');
const lodashUniq = require('lodash/uniq');
const minimatch = require('minimatch');
const crypto = require('crypto');

const log = require('../../utils/logger');
const reportError = require('../../utils/sentry');
const { fillWildcardPaths } = require('../../helper/engineConfig');
const { ignoreExtensionList } = require('../../helper/smartAbort');
const { checkPathLength, stripName } = require('../../helper/fs');

class SourceCode {
  constructor(platform, scan) {
    this.platform = platform || 'k8s';
    this.preparedSrc = false;
    this.configs = [];
    this.isFullScan = undefined;
    this.excludedPaths = {};
    this.diffFiles = [];
    this.ignoreFiles = [];

    this.scan = scan;
    this.srcDest = '/tmp/scan';
    this.srcName = `scan-${this.scan.idScan}-${this.generatePathSuffix()}`;
    this.fullDir = `${this.srcDest}/${this.srcName}-full`;
    this.diffDir = `${this.srcDest}/${this.srcName}-diff`;
    this.baseTar = `${this.srcDest}/${this.srcName}.tar`;

    this._cleanSrcDir =
      this.platform === 'docker'
        ? dir => fs.rmSync(dir, { recursive: true, force: true })
        : dir => fs.renameSync(dir, dir.replace('scan-', 'del-'));

    // TODO: move this to other place where it run only once when worker start
    // create srcDest folder if not exist
    if (!fs.existsSync(this.srcDest)) {
      fs.mkdirSync(this.srcDest, { recursive: true });
    }
  }

  setup(configs, isFullScan, diffFiles, ignoreFiles) {
    this.configs = configs;
    this.isFullScan = isFullScan;
    this.diffFiles = diffFiles;
    this.ignoreFiles = ignoreFiles;
  }

  generatePathSuffix() {
    const timestamp = Math.floor(Date.now() / 1000);

    // Create random string of length 8 (1 byte = 2 chars in hex).
    const simpleRandom = crypto.randomBytes(4).toString('hex');

    return `${timestamp}-${simpleRandom}`;
  }

  getFullDir() {
    return this.fullDir;
  }

  getDiffDir() {
    return this.diffDir;
  }

  markAsPrepared() {
    this.preparedSrc = true;
  }

  // This is called by engineRunManager, when run the engine
  getExcludePaths(srcLocation) {
    if (this.excludedPaths[srcLocation]) {
      return this.excludedPaths[srcLocation];
    }

    let paths = lodashUniq(
      this.configs.reduce((r, scanConfig) => [...r, ...scanConfig.excluded], [])
    );

    const hasWildcard = paths.some(p => (p || '').includes('*'));

    if (hasWildcard) {
      // Call this function before preparedSrc will give undefined because unable to do fillWildcardPaths
      if (!this.preparedSrc) {
        return undefined;
      }
      paths = fillWildcardPaths(paths, srcLocation);
    }

    // filter exclude path exist in src
    this.excludedPaths[srcLocation] = paths.filter(p => fs.existsSync(`${srcLocation}/${p}`));

    return this.excludedPaths[srcLocation];
  }

  checkPathExistInSrc(rootPath) {
    return fs.existsSync(`${this.fullDir}/${rootPath}`);
  }

  async downloadSrc() {
    return false;
  }

  async createFullSrc() {
    const destPath = this.fullDir;
    return new Promise((resolve, reject) => {
      const unzip = zlib.createUnzip();
      const wstream = tar.extract();
      const fsStream = fs
        .createReadStream(this.baseTar)
        .pipe(unzip)
        .pipe(wstream);

      wstream.on('entry', (header, stream, next) => {
        let headerName = header.name;
        // strip 1 leading directory - only SourceCodeFromArchive
        if (this.doStripLeadingDirOnExtract) {
          headerName = stripName(header.name, 1);
        }
        headerName = path.normalize(`/${headerName}`).replace(/^\//, '');

        const fpath = `${destPath}/${headerName}`;
        if (header.type !== 'symlink' && checkPathLength(fpath)) {
          if (header.type === 'directory' && !fs.existsSync(fpath)) {
            fs.mkdirSync(fpath, { recursive: true });
          }
          if (header.type === 'file') {
            // In some case, it fetch the file before the folder which contain the file
            // So check and create folder-of-the-file if not existed
            const dir = path.dirname(fpath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            const { base: filename } = path.parse(header.name);
            if (
              !ignoreExtensionList.some(ext => filename.endsWith(ext)) && // filter ignore ext
              !this.ignoreFiles.some(g => minimatch(headerName, g)) // filter ignore file
            ) {
              const writeStream = fs.createWriteStream(fpath);
              stream.pipe(writeStream);
            }
          }
        }
        stream.on('end', () => next());
        stream.resume();
      });

      wstream.on('finish', () => resolve(true));

      wstream.on('error', streamErr => {
        log.error('could not extract file', streamErr);
        reportError(streamErr, { caughtIn: 'extractSrc.wstream' });
        reject(streamErr);
      });

      unzip.on('error', e => {
        reportError(e, { caughtIn: 'extractSrc.unzip' });
        reject(e);
      });

      fsStream.on('error', e => {
        reportError(e, { caughtIn: 'extractSrc.fsStream' });
        reject(e);
      });
    }).catch(e => {
      log.error('extractSrc error', e);
      reportError(e, { caughtIn: 'extractSrc.catch' });
      throw e;
    });
  }

  async createDiffSrc() {
    const copy = this.diffFiles.map(file =>
      new Promise(resolve => {
        const src = `${this.fullDir}/${file}`;
        const dest = `${this.diffDir}/${file}`;

        if (checkPathLength(src) && checkPathLength(dest)) {
          const dirName = path.dirname(dest);

          if (!fs.existsSync(src)) {
            return resolve(false);
          }

          // ignore if the src diff is a folder
          const stats = fs.statSync(src);
          if (stats && stats.isDirectory()) {
            return resolve(false);
          }

          if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName, { recursive: true });
          }

          fs.copyFileSync(src, dest);
        }
        return resolve(true);
      }).catch(e => {
        log.error('buildDiffSrc error', e);
        reportError(e, { caughtIn: 'buildDiffSrc.catch' });
      })
    );
    await Promise.all(copy.flat());
  }

  async prepareBaseSrc(...params) {
    log.info(`[${this.scan.idScan}] before download ${this.constructor.name}`);
    const hrstart = process.hrtime();

    const downloadSrcResult = await this.downloadSrc(...params);

    const hrend = process.hrtime(hrstart);
    log.info(`[${this.scan.idScan}] download ${this.constructor.name} in ${hrend}s`);

    return downloadSrcResult;
  }

  async prepareFullSrc() {
    log.info(`[${this.scan.idScan}] before prepareFullSrc ${this.constructor.name}`);
    const hrstart = process.hrtime();

    const prepare = this.createFullSrc();
    await Promise.all([prepare]);

    const hrend = process.hrtime(hrstart);
    log.info(`[${this.scan.idScan}] prepareFullSrc ${this.constructor.name} in ${hrend}s`);
  }

  async prepareDiffSrc() {
    log.info(`[${this.scan.idScan}] before prepareDiffSrc ${this.constructor.name}`);
    const hrstart = process.hrtime();

    await this.createDiffSrc();

    const hrend = process.hrtime(hrstart);
    log.info(`[${this.scan.idScan}] prepareDiffSrc ${this.constructor.name} in ${hrend}s`);
  }

  async prepareSrc(...params) {
    if (this.preparedSrc) {
      return true;
    }

    const prepareBaseSrcResult = await this.prepareBaseSrc(...params);
    if (!prepareBaseSrcResult) {
      return false;
    }

    await this.prepareFullSrc();

    if (!this.isFullScan) {
      await this.prepareDiffSrc();
    }

    this.markAsPrepared();
    return true;
  }

  async cleanSrc() {
    log.info(`[${this.scan.idScan}] before clean up ${this.constructor.name}`);
    const hrstart = process.hrtime();

    // still need to scan srcDest because of support for customeEngineRule folder
    fs.readdirSync(this.srcDest, { withFileTypes: true })
      .filter(dirent => dirent.name.startsWith(this.srcName))
      .forEach(dirent => {
        try {
          const location = `${this.srcDest}/${dirent.name}`;
          if (dirent.isDirectory()) {
            this._cleanSrcDir(location);
          } else if (dirent.isFile()) {
            fs.unlinkSync(location);
          }
        } catch (e) {
          log.error('SrcCodeError - error clean up srcCode', e);
        }
      });

    const hrend = process.hrtime(hrstart);
    log.info(`[${this.scan.idScan}] clean up ${this.constructor.name} in ${hrend}s`);
  }
}

module.exports = SourceCode;
