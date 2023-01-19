const _ = require('lodash');
const axios = require('axios');
const jwt = require('jwt-simple');
const {
  ACCOUNT_PROVIDER: { BITBUCKET }
} = require('../helper/core-api/enums');
const BaseProvider = require('./baseProvider');
const { env, constants } = require('../../config');

const bitbucketStates = {
  pending: 'INPROGRESS',
  success: 'SUCCESSFUL',
  failure: 'FAILED',
  error: 'STOPPED'
};

class Bitbucket extends BaseProvider {
  constructor(account, repository) {
    super(account, repository, BITBUCKET, env.BITBUCKET_URL);

    this.installationToken = '';

    this.client = Bitbucket.newClient(this.account.providerInternalId);
    this.pId = `${encodeURIComponent(account.providerInternalId)}/${encodeURIComponent(
      repository.providerInternalId
    )}`;
  }

  getShortName() {
    return 'bb';
  }

  async updateCommitStatus(sha, state, description) {
    try {
      const body = {
        state: bitbucketStates[state],
        key: `${constants.botDisplayName}/scan`,
        url: super.getDashboardScanUrl(sha),
        description
      };

      await this.client.post(`/2.0/repositories/${this.pId}/commit/${sha}/statuses/build`, body, {
        headers: { 'Content-Type': 'application/json' }
      });

      return true;
    } catch (e) {
      this.logger.error(`Error when trying to update the status on [${this.provider}].`, e);
      return false;
    }
  }

  _hasNextPage(data) {
    // The 'next' property in the paginated api response contains the url to the next page.
    // That property only exists if there is a next page.
    return Boolean(data.next);
  }

  _getNextPage(data) {
    // The 'next' property in the paginated api response contains the url to the next page.
    const url = data.next;
    return this.client.get(url);
  }

  async _getAll(req) {
    const {
      data,
      data: { values }
    } = await req;

    if (!this._hasNextPage(data)) {
      return values;
    }

    // Get data for the rest of the pages.
    const nextPageValues = await this._getAll(this._getNextPage(data));

    return values.concat(nextPageValues);
  }

  async getPullRequests() {
    try {
      return this._getAll(this.client.get(`/2.0/repositories/${this.pId}/pullrequests?state=OPEN`));
    } catch (e) {
      this.logger.error(`Error when trying to get pull requests on [${this.provider}].`, e);
      return [];
    }
  }

  async determineIsPushPartOfPR(branch, sha) {
    const prList = await this.getPullRequests();
    const pullRequest = prList.find(
      merge => sha.includes(merge.source.commit.hash) && merge.source.branch.name === branch
    );
    return !!pullRequest;
  }

  // TODO: handle pagination
  async getPullRequestStartCommitSha(prNumber) {
    if (!prNumber) {
      return '';
    }
    try {
      const { data } = await this.client.get(
        `/2.0/repositories/${this.pId}/pullrequests/${prNumber}/commits?pagelen=100`
      );
      const dataSize = data && data.values && data.values.length;
      return _.get(data, `values.[${dataSize - 1}].hash`, '');
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

      const buildKey = encodeURIComponent(`${constants.botDisplayName}/scan`);
      const { data } = await this.client.get(
        `/2.0/repositories/${this.pId}/commit/${sha}/statuses/build/${buildKey}`,
        null,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      return (
        data &&
        data.key === `${constants.botDisplayName}/scan` &&
        data.state === bitbucketStates.success &&
        data.description === 'skipped'
      );
    } catch (e) {
      // 404 if buildKey not found
      const status = _.get(e, 'response.status');
      if (status !== 404) {
        this.logger.error(`Error when trying to get the status on [${this.provider}].`, e);
      }
      return false;
    }
  }

  async getSourceCode(sha, ext = 'tar.gz') {
    const { data } = await this.client.get(`${this.url}/${this.pId}/get/${sha}.${ext}`, {
      responseType: 'stream'
    });
    return data;
  }

  async getCommitDiffContent(sha, before) {
    if (!sha) {
      return undefined;
    }

    const beforeSha = before || `${sha}^`;

    try {
      const { data } = await this.client.get(
        `/2.0/repositories/${this.pId}/diff/${sha}..${beforeSha}`
      );
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
      const { data: diff } = await this.client.get(
        `/2.0/repositories/${this.pId}/pullrequests/${prNumber}/diff`
      );
      return diff;
    } catch (e) {
      this.logger.error(`Error while trying to get PR diff content for PR #${prNumber}`, e);
      return undefined;
    }
  }

  async setPullRequestComment(commentId, prNumber, body) {
    try {
      const content = { raw: body.replace(/<[^>]*>?/gm, '') };

      const apiEndpoint = `/2.0/repositories/${this.pId}/pullrequests/${prNumber}/comments${
        commentId ? `/${commentId}` : ''
      }`;

      const { data: commentDoc } = commentId
        ? await this.client.put(apiEndpoint, { content })
        : await this.client.post(apiEndpoint, { content });

      return commentDoc;
    } catch (e) {
      this.logger.error(`Error while trying to set PR comment for PR #${prNumber}`, e);
      return false;
    }
  }

  async getHistoryCommitSha(sha, branch, limit = 50) {
    const {
      data: { values }
    } = await this.client.get(`/2.0/repositories/${this.pId}/commits/${branch}?pagelen=${limit}`);
    const history = values.map(x => x.hash);

    return history;
  }

  async getSourceCodeSizeInKB() {
    const { data } = await this.client.get(`/2.0/repositories/${this.pId}/`);
    const size = _.get(data, 'size', 0);
    return size / 1000;
  }

  generateLinkToCodeInSha(sha) {
    // Fixes a rendering issue with lineNumber 0.
    return (path, line) =>
      `${this.url}/${this.pId}/src/${sha}/${path}${line === 0 ? '' : `#lines-${line}`}`;
  }

  getToken() {
    return this.installationToken;
  }

  getRepositoryFullPath() {
    return this.pId;
  }

  static newClient(userOrTeamUuid) {
    const appName = env.BITBUCKET_APP_NAME;
    const clientKey = `ari:cloud:bitbucket::app/${userOrTeamUuid}/${appName}`;
    const now = new Date();
    const payload = {
      iss: appName,
      sub: clientKey,
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(now.setHours(now.getHours() + 1) / 1000)
    };
    const token = jwt.encode(payload, env.BITBUCKET_APP_SECRET);

    const client = axios.create({
      baseURL: env.BITBUCKET_API_URL,
      headers: {
        Authorization: `JWT ${token}`
      },
      timeout: env.GITPROVIDER_GET_SOURCECODE_TIMEOUT_IN_SECOND * 1000
    });
    this.installationToken = token;
    return client;
  }

  async getFiles(files, sha) {
    const filesRequested = await Promise.all(
      files.map(
        path =>
          // eslint-disable-next-line no-async-promise-executor
          new Promise(async resolve => {
            try {
              const { data } = await this.client.get(
                `/2.0/repositories/${this.pId}/src/${sha}/${path}`
              );
              resolve({ path, content: data });
            } catch (e) {
              // TODO:
              // {
              //   data: { key: 'INSUFFICIENT_RIGHTS' },
              //   type: 'error',
              //   error: {
              //     message: 'Access denied. You must have write or admin access.',
              //     data: { key: 'INSUFFICIENT_RIGHTS' }
              //   }
              // }
              // tried: projects read/write, repos read/write, prs read/write
              resolve({ path, content: false });
            }
          })
      )
    );
    return _(filesRequested)
      .keyBy(file => file.path)
      .mapValues(file => file.content)
      .value();
  }
}

module.exports = Bitbucket;
