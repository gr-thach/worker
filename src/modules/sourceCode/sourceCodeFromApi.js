const fs = require('fs');
const path = require('path');

const SourceCode = require('./sourceCode');

const log = require('../../utils/logger');
const reportError = require('../../utils/sentry');
const { checkPathLength } = require('../../helper/fs');

class SourceCodeFromApi extends SourceCode {
  constructor(platform, scan, gitProvider) {
    super(platform, scan);
    this.gitProvider = gitProvider;
  }

  async downloadSrc() {
    this.baseTar = null;
    return true;
  }

  async createFullSrc() {
    const files = await this.gitProvider.getFiles(this.diffFiles, this.scan.sha);
    const promises = Object.entries(files).map(([file, content]) =>
      new Promise(resolve => {
        const fileName = `${this.fullDir}/${file}`;
        if (checkPathLength(fileName)) {
          const dirName = path.dirname(fileName);
          if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName, { recursive: true });
          }
          fs.writeFileSync(fileName, content);
        }
        resolve(true);
      }).catch(e => {
        log.error('downloadSrcApi error', e);
        reportError(e, { caughtIn: 'storeSrcApiContent.catch' });
        throw e;
      })
    );

    await Promise.all(promises.flat());
  }

  async createDiffSrc() {
    this.diffDir = this.fullDir;
  }
}

module.exports = SourceCodeFromApi;
