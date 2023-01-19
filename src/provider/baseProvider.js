const nr = require('newrelic');

const logger = require('../utils/logger');
const { configFileName, ignoreFileName, ruleOverrideFileName } = require('../helper/scanConfig');
const { dashboardScanUrl } = require('../helper/account');

class BaseProvider {
  constructor(account, repository, provider, url) {
    if (!account || !repository) {
      throw Error(
        `Invalid account or repository when creating ${provider} provider service`,
        { account },
        { repository }
      );
    }

    this.account = account;
    this.repository = repository;
    this.provider = provider;
    this.url = url;
    this.logger = logger;

    this.className = this.constructor.name;
  }

  async init() {
    return this.provider;
  }

  getShortName() {
    throw new Error(
      `getShortName must be implemented on children class of provider [${this.provider}]`
    );
  }

  async setCommitStatus(sha, state, description) {
    const req = nr.startBackgroundTransaction(
      `setCommitStatus/${this.className}-setCommitStatus`,
      'provider',
      () => this.updateCommitStatus(sha, state, description)
    );
    return Promise.resolve(req);
  }

  async getPullRequestStartCommitSha() {
    throw new Error(
      `getPullRequestStartCommitSha must be implemented on children class of provider [${this.provider}]`
    );
  }

  async checkPullRequestStartCommitStatusSkippedSuccess() {
    throw new Error(
      `checkPullRequestStartCommitStatusSkippedSuccess must be implemented on children class of provider [${this.provider}]`
    );
  }

  async updateCommitStatus() {
    throw new Error(
      `updateCommitStatus must be implemented on children class of provider [${this.provider}]`
    );
  }

  async determineIsPushPartOfPR() {
    throw new Error(
      `determineIsPushPartOfPR must be implemented on children class of provider [${this.provider}]`
    );
  }

  async getTarSourceCode(sha) {
    const req = nr.startBackgroundTransaction(
      `getTarSource/${this.className}-getTarSource`,
      'provider',
      () => this.getSourceCode(sha)
    );
    return Promise.resolve(req);
  }

  async getSourceCode() {
    throw new Error(
      `getSourceCode must be implemented on children class of provider [${this.provider}]`
    );
  }

  async getSourceCodeSizeInKB() {
    throw new Error(
      `getSourceCodeSize must be implemented on children class of provider [${this.provider}]`
    );
  }

  async getPullRequestDiffContent() {
    throw new Error(
      `getPullRequestDiffContent must be implemented on children class of provider [${this.provider}]`
    );
  }

  async setPRComment(commentId, prNumber, body) {
    const req = nr.startBackgroundTransaction(
      `setPRComment/${this.className}-setPRComment`,
      'provider',
      () => this.setPullRequestComment(commentId, prNumber, body)
    );
    return Promise.resolve(req);
  }

  async setPullRequestComment() {
    throw new Error(
      `setPullRequestComment must be implemented on children class of provider [${this.provider}]`
    );
  }

  async getHistoryCommitSha() {
    return [];
  }

  generateLinkToCodeInSha() {
    throw new Error(
      `generateLinkToCodeInSha must be implemented on children class of provider [${this.provider}]`
    );
  }

  async getConfigFiles(sha) {
    const files = await this.getFiles([ignoreFileName, configFileName, ruleOverrideFileName], sha);
    return {
      configFileName: files[configFileName],
      ignoreFileName: files[ignoreFileName],
      ruleOverrideFileName: files[ruleOverrideFileName]
    };
  }

  async assignReviewersByTeamSlug() {
    // this feature temporary support only for github
    return false;
  }

  getDashboardScanUrl(sha) {
    return dashboardScanUrl(this.account, this.repository.idRepository, sha);
  }
}

module.exports = BaseProvider;
