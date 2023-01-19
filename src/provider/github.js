const axios = require('axios');
const _ = require('lodash');
const { App } = require('@octokit/app');
const { Octokit } = require('@octokit/rest');
const retry = require('@octokit/plugin-retry');
const { throttling } = require('@octokit/plugin-throttling');

const {
  ACCOUNT_PROVIDER: { GITHUB }
} = require('../helper/core-api/enums');
const BaseProvider = require('./baseProvider');
const { env, constants } = require(' ../../../config');
const pkg = require('../../package.json');
const logger = require('../utils/logger');

const GithubAPI = Octokit.plugin(retry, throttling);

const userAgent = `GuardRails-${pkg.version}`;

const GITHUB_PERMISSIONS = {
  CHECKS: 'checks'
};

const GITHUB_PERMISSIONS_ACCESS = {
  READ: 'read',
  WRITE: 'write'
};

const GITHUB_CHECK_STATUS = {
  COMPLETED: 'completed',
  INPROGRESS: 'in_progress'
};

const GITHUB_CHECK_CONCLUSION = {
  NEUTRAL: 'neutral'
};

class Github extends BaseProvider {
  constructor(account, repository) {
    super(account, repository, GITHUB, env.GITHUB_URL);

    this.client = undefined;
    this.appClient = Github.newClient(env.isTest && 'testToken');

    this.installationId = account.installationId;
    this.installationPermissions = {};
    this.installationToken = '';
  }

  async init() {
    if (!this.installationId) {
      return;
    }

    const {
      data: { token, permissions }
    } = await this.appClient.apps.createInstallationAccessToken({
      installation_id: this.installationId
    });
    this.client = Github.newClient(token);
    // Work around to disable retry on Octokit, using in get config file where retry is not necessary
    this.clientWithoutRetry = Github.newClient(token, 0);
    this.installationToken = token;
    this.installationPermissions = permissions;
  }

  getShortName() {
    return 'gh';
  }

  async updateCommitStatus(sha, state, description) {
    try {
      if (this.hasPermission(GITHUB_PERMISSIONS.CHECKS, GITHUB_PERMISSIONS_ACCESS.WRITE)) {
        let conclusion = state;
        let status = GITHUB_CHECK_STATUS.COMPLETED;

        if (state === 'error') {
          status = GITHUB_CHECK_STATUS.COMPLETED;
          conclusion = GITHUB_CHECK_CONCLUSION.NEUTRAL;
        } else if (state === 'pending') {
          status = GITHUB_CHECK_STATUS.INPROGRESS;
          conclusion = undefined;
        }

        await this.client.checks.create({
          owner: this.account.login,
          repo: this.repository.name,
          name: `${constants.botDisplayName}/scan`,
          head_sha: sha,
          details_url: super.getDashboardScanUrl(sha),
          status,
          conclusion,
          output: {
            title: description,
            summary: ''
          }
        });
      } else {
        await this.client.repos.createCommitStatus({
          owner: this.account.login,
          repo: this.repository.name,
          sha,
          state,
          context: `${constants.botDisplayName}/scan`,
          description,
          target_url: super.getDashboardScanUrl(sha)
        });
      }

      return true;
    } catch (e) {
      this.logger.error(`Error when trying to update the status on [${this.provider}].`, e);
      return false;
    }
  }

  async getPullRequests() {
    try {
      const data = await this.client.paginate(
        this.client.pulls.list.endpoint.merge({
          owner: this.account.login,
          repo: this.repository.name,
          state: 'open'
        }),
        res => res.data
      );
      return data;
    } catch (e) {
      this.logger.error(`Error when trying to get pull requests on [${this.provider}].`, e);
      return [];
    }
  }

  async determineIsPushPartOfPR(branch, sha) {
    const prList = await this.getPullRequests();
    const pr = prList.find(pull => pull.head && pull.head.ref === branch && pull.head.sha === sha);
    return !!pr;
  }

  async getPullRequestStartCommitSha(prNumber) {
    if (!prNumber) {
      return '';
    }
    try {
      const { data } = await this.client.pulls.listCommits({
        owner: this.account.login,
        repo: this.repository.name,
        pull_number: prNumber
      });
      return _.get(data, '[0].sha', '');
    } catch (e) {
      this.logger.error(`Error while trying to get PR start commit #${prNumber}`, e);
      return '';
    }
  }

  async checkPullRequestStartCommitStatusSkippedSuccess(prNumber) {
    if (!prNumber) {
      return false;
    }

    try {
      const sha = await this.getPullRequestStartCommitSha(prNumber);

      if (this.hasPermission(GITHUB_PERMISSIONS.CHECKS, GITHUB_PERMISSIONS_ACCESS.WRITE)) {
        const { data } = await this.client.checks.listForRef({
          owner: this.account.login,
          repo: this.repository.name,
          ref: sha
        });
        return _.get(data, 'check_runs', []).some(
          d =>
            d.name === `${constants.botDisplayName}/scan` &&
            d.status === 'completed' &&
            d.output.title === 'skipped'
        );
      }

      const { data } = await this.client.repos.getCombinedStatusForRef({
        owner: this.account.login,
        repo: this.repository.name,
        ref: sha
      });
      return _.get(data, 'statuses', []).some(
        d =>
          d.context === `${constants.botDisplayName}/scan` &&
          d.state === 'success' &&
          d.description === 'skipped'
      );
    } catch (e) {
      const status = _.get(e, 'response.status');
      if (status !== 404) {
        this.logger.error(`Error when trying to get the status on [${this.provider}].`, e);
      }
      return false;
    }
  }

  async getSourceCode(sha, ext = 'tarball') {
    const { url } = await this.client.repos.downloadArchive.endpoint({
      owner: this.account.login,
      repo: this.repository.name,
      archive_format: ext === 'zip' ? 'zipball' : ext,
      ref: sha
    });

    const { data } = await axios({
      url,
      method: 'get',
      responseType: 'stream',
      headers: {
        Authorization: `token ${this.installationToken}`
      },
      timeout: env.GITPROVIDER_GET_SOURCECODE_TIMEOUT_IN_SECOND * 1000
    });

    return data;
  }

  async getCommitDiffContent(sha, before) {
    if (!sha) {
      return undefined;
    }

    const beforeSha = before || `${sha}^`;

    try {
      const { data } = await this.client.repos.compareCommits({
        owner: this.account.login,
        repo: this.repository.name,
        base: beforeSha,
        head: sha,
        headers: { accept: 'application/vnd.github.v3.diff' }
      });
      return data;
    } catch (e) {
      this.logger.error(`Error while trying to get commit diff content for sha ${sha}`, e);
      return undefined;
    }
  }

  async getPullRequestDiffContent(prNumber) {
    if (!prNumber) {
      return undefined;
    }
    try {
      const { data: diff } = await this.client.pulls.get({
        owner: this.account.login,
        repo: this.repository.name,
        pull_number: prNumber,
        headers: { accept: 'application/vnd.github.v3.diff' }
      });
      return diff;
    } catch (e) {
      this.logger.error(`Error while trying to get PR diff content for PR #${prNumber}`, e);
      return undefined;
    }
  }

  async setPullRequestComment(commentId, prNumber, body) {
    try {
      const prComment = {
        owner: this.account.login,
        repo: this.repository.name,
        body,
        ...(commentId ? { comment_id: commentId } : { issue_number: prNumber })
      };

      const { data: commentDoc } = commentId
        ? await this.client.issues.updateComment(prComment)
        : await this.client.issues.createComment(prComment);

      return commentDoc;
    } catch (e) {
      this.logger.error(`Error while trying to set PR comment for PR #${prNumber}`, e);
      return false;
    }
  }

  async getHistoryCommitSha(sha, branch, limit = 50) {
    const { data } = await this.client.repos.listCommits({
      owner: this.account.login,
      repo: this.repository.name,
      sha,
      per_page: limit
    });
    const history = data.map(x => x.sha);

    return history;
  }

  async getSourceCodeSizeInKB() {
    const { data } = await this.client.repos.get({
      owner: this.account.login,
      repo: this.repository.name
    });
    const sizeInKB = _.get(data, 'size', 0);
    return sizeInKB;
  }

  async assignReviewersByTeamSlug(prNumber, teamSlug) {
    try {
      const request = {
        owner: this.account.login,
        repo: this.repository.name,
        pull_number: prNumber,
        team_reviewers: [teamSlug]
      };
      await this.client.pulls.requestReviewers(request);
      return true;
    } catch (e) {
      this.logger.error(
        `Error while trying to assign reviewers by team_lug [${teamSlug}] for PR [${prNumber}] by user_login [${this.account.login}], repo_name [${this.repository.name}]: ${e}`
      );
      return false;
    }
  }

  generateLinkToCodeInSha(sha) {
    // Fixes a rendering issue with lineNumber 0.
    return (path, line) =>
      `${this.url}/${this.account.login}/${this.repository.name}/blob/${sha}/${path}${
        line === 0 ? '' : `#L${line}`
      }`;
  }

  getToken() {
    return this.installationToken;
  }

  getRepositoryFullPath() {
    return `${this.account.login}/${this.repository.name}`;
  }

  static newClient(token, retryTime = 3) {
    let auth = token;
    if (!token) {
      auth = new App({
        id: env.GITHUB_APP_ISSUER_ID,
        privateKey: Buffer.from(env.GITHUB_APP_PRIVATE_KEY_BASE64, 'base64').toString(),
        baseUrl: `${env.GITHUB_API_URL}`
      }).getSignedJsonWebToken();
    }
    return new GithubAPI({
      userAgent,
      auth,
      baseUrl: env.GITHUB_API_URL,
      retry: {
        doNotRetry: constants.octokit.doNotRetry,
        retries: env.isTest ? 0 : retryTime
      },
      throttle: {
        onRateLimit: (retryAfter, options) => {
          logger.warn(`Request quota exhausted for request ${options.method} ${options.url}`);

          if (options.request.retryCount === 0) {
            // only retries once
            logger.info(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
          return false;
        },
        onAbuseLimit: (retryAfter, options) => {
          // does not retry, only logs a warning
          logger.warn(`Abuse detected for request ${options.method} ${options.url}`);
        }
      }
    });
  }

  async getFiles(files, ref) {
    const filesRequested = await Promise.all(
      files.map(
        path =>
          // eslint-disable-next-line no-async-promise-executor
          new Promise(async resolve => {
            try {
              const { data } = await this.clientWithoutRetry.repos.getContent({
                path,
                owner: this.account.login,
                repo: this.repository.name,
                ...(ref && { ref })
              });
              resolve(data);
            } catch (e) {
              resolve({ path, content: false });
            }
          })
      )
    );

    return _(filesRequested)
      .keyBy(file => file.path)
      .mapValues(file => file.content && Buffer.from(file.content, 'base64').toString())
      .value();
  }

  hasPermission(permission, accessLevel) {
    return this.installationPermissions[permission] === accessLevel;
  }
}

module.exports = Github;
