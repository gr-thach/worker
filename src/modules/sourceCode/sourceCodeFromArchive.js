const zlib = require('zlib');
const fs = require('fs');

const SourceCode = require('./sourceCode');

const { env } = require(' ../../../config');
const log = require('../../utils/logger');
const reportError = require('../../utils/sentry');

class SourceCodeFromArchive extends SourceCode {
  constructor(platform, scan, gitProvider) {
    super(platform, scan);
    this.gitProvider = gitProvider;
    this.doStripLeadingDirOnExtract = true;
  }

  async downloadSrc() {
    const rstream = await this.gitProvider.getTarSourceCode(this.scan.sha);
    await new Promise((resolve, reject) => {
      const unzip = zlib.createUnzip();
      unzip.on('error', e => {
        reportError(e, { caughtIn: 'downloadSrcArchive.unzip' });
        reject(e);
      });

      const gzip = zlib.createGzip();
      gzip.on('error', e => {
        reportError(e, { caughtIn: 'downloadSrcArchive.gzip' });
        reject(e);
      });

      const wstream = fs.createWriteStream(this.baseTar);
      rstream.pipe(wstream);

      let timerId;
      wstream.on('ready', () => {
        timerId = setTimeout(() => {
          wstream.destroy(
            `[${this.scan.idScan}] sha=${this.scan.sha} download stream timeout after ${env.GITPROVIDER_GET_SOURCECODE_TIMEOUT_IN_SECOND}s`
          );
        }, env.GITPROVIDER_GET_SOURCECODE_TIMEOUT_IN_SECOND * 1000);
      });

      wstream.on('close', () => clearTimeout(timerId));

      wstream.on('finish', () => resolve(true));

      wstream.on('error', streamErr => {
        reportError(streamErr, { caughtIn: 'downloadSrcArchive.wstream' });
        reject(streamErr);
      });
    }).catch(e => {
      log.error('downloadSrcArchive error', e);
      reportError(e, { caughtIn: 'downloadSrcArchive.catch' });
      throw e;
    });

    return true;
  }
}

module.exports = SourceCodeFromArchive;
