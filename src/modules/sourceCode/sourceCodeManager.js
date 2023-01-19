const SourceCode = require('./sourceCode');
const SourceCodeFromArchive = require('./sourceCodeFromArchive');
const SourceCodeFromApi = require('./sourceCodeFromApi');
const SourceCodeFromMinio = require('./sourceCodeFromMinio');
const SourceCodeFromGitCloner = require('./sourceCodeFromGitCloner');

const log = require('../../utils/logger');
const { ignoreExtensionList } = require('../../helper/smartAbort');
const { env } = require('../../../config');

class SourceCodeManager {
  static type = {
    DEFAULT: 'default',
    ARCHIVE: 'archive',
    API: 'api',
    MINIO: 'minio',
    GITCLONER: 'gitcloner'
  };

  constructor(platform, scan, gitProvider, minioFile) {
    this.platform = platform;
    this.scan = scan;
    this.gitProvider = gitProvider;
    this.minioFile = minioFile;
    this.useGitCloner = false;
    this.srcCodeHandlers = {
      [SourceCodeManager.type.DEFAULT]: new SourceCode(platform, scan),
      [SourceCodeManager.type.ARCHIVE]: new SourceCodeFromArchive(platform, scan, gitProvider),
      [SourceCodeManager.type.API]: new SourceCodeFromApi(platform, scan, gitProvider),
      [SourceCodeManager.type.MINIO]: new SourceCodeFromMinio(platform, scan, minioFile),
      [SourceCodeManager.type.GITCLONER]: new SourceCodeFromGitCloner(
        platform,
        scan,
        minioFile,
        gitProvider
      )
    };
    this.type = SourceCodeManager.type.DEFAULT;
    this.forceUsingArchive = undefined;
    this.repoSize = 0;
  }

  syncDownloaded() {
    Object.values(this.srcCodeHandlers).map(h => h.markAsPrepared());
  }

  setUseGitCloner(gitCloner) {
    this.useGitCloner = gitCloner;
  }

  setRepoSize(size) {
    this.repoSize = size;
  }

  getRepoSize() {
    return this.repoSize;
  }

  setup(scanConfigs, isFullScan, diffFiles, ignores) {
    if (this.forceUsingArchive) {
      this.type = SourceCodeManager.type.ARCHIVE;
    } else {
      const canUseApi =
        env.FEATURE_DOWNLOAD_SRC_VIA_API &&
        scanConfigs.every(scanConfig => scanConfig.canDownloadSrcViaApi === true);
      if (canUseApi && this.diffFiles && this.diffFiles.length) {
        this.type = SourceCodeManager.type.API;
      } else if (this.minioFile) {
        this.type = SourceCodeManager.type.MINIO;
      } else if (this.useGitCloner) {
        this.type = SourceCodeManager.type.GITCLONER;
      } else {
        this.type = SourceCodeManager.type.ARCHIVE;
      }
    }

    const diffs = diffFiles.filter(f => f && !ignoreExtensionList.some(ext => f.endsWith(ext)));
    this.srcCodeHandlers[this.type].setup(scanConfigs, isFullScan, diffs, ignores);
  }

  async prepareSrc(scanConfigs, isFullScan, diffFiles, ignores, ...params) {
    let success;
    this.setup(scanConfigs, isFullScan, diffFiles, ignores);
    if (this.type === SourceCodeManager.type.GITCLONER) {
      success = await this.srcCodeHandlers[this.type].prepareSrc(...params);
    } else {
      success = await this.srcCodeHandlers[this.type].prepareSrc();
    }

    if (success) {
      this.syncDownloaded();
    }

    // fallback to download via ARCHIVE
    if (!success && this.type !== SourceCodeManager.type.ARCHIVE) {
      log.info(`Prepare src fallback from ${this.type} to ARCHIVE`);
      this.forceUsingArchive = true;
      this.setup(scanConfigs, isFullScan, diffFiles, ignores);
      success = await this.srcCodeHandlers[this.type].prepareSrc();
    }
  }

  cleanSrc(force) {
    // ignore clean src on engine run v3 because srcManager gonna handle this
    if (env.FEATURE_ENGINE_RUN_V3 && !force) {
      return true;
    }
    return this.srcCodeHandlers[this.type].cleanSrc();
  }

  getDiffSrc() {
    return this.srcCodeHandlers[this.type].getDiffDir();
  }

  getFullSrc() {
    return this.srcCodeHandlers[this.type].getFullDir();
  }

  getExcludePaths(srcLocation) {
    return this.srcCodeHandlers[this.type].getExcludePaths(srcLocation);
  }

  checkPathExistInSrc(rootPath) {
    return this.srcCodeHandlers[this.type].checkPathExistInSrc(rootPath || '');
  }

  getMinioObjectName() {
    return this.minioFile;
  }
}

module.exports = SourceCodeManager;
