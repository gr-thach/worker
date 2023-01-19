const _ = require('lodash');
const axios = require('axios');
const {
  ACCOUNT_PROVIDER: { BITBUCKET_DATA_CENTER }
} = require('../helper/core-api/enums');
const BaseProvider = require('./baseProvider');
const { env, constants } = require('../../config');

const bitbucketStates = {
  pending: 'INPROGRESS',
  success: 'SUCCESSFUL',
  failure: 'FAILED',
  error: 'STOPPED'
};

class BitbucketDataCenter extends BaseProvider {
  constructor(account, repository) {
    super(account, repository, BITBUCKET_DATA_CENTER, env.BITBUCKET_DATA_CENTER_SITE_URL);

    this.client = BitbucketDataCenter.newClient(env.BITBUCKET_DATA_CENTER_OWN_USER_TOKEN);

    this.projectKey = account.providerMetadata.projectKey;
  }

  getShortName() {
    return 'bbdc';
  }

  async updateCommitStatus(sha, state, description) {
    try {
      const version = await this._getServerVersion();

      // Creating build status is only available on version 7.4 and greater of Bitbucket server.
      if (version.major < 7 || (version.major === 7 && version.minor < 4)) {
        // eslint-disable-next-line no-console
        console.log(
          `Creating queued status (i.e. build status) is not supported on this version of Bitbucket server (${version.major}.${version.minor}.${version.patch}), skipping...`
        );
        return null;
      }

      const body = {
        state: bitbucketStates[state],
        key: `${constants.botDisplayName}/scan`,
        url: super.getDashboardScanUrl(sha),
        description
      };

      await this.client.post(
        `/projects/${this.projectKey}/repos/${this.repository.name}/commits/${sha}/builds`,
        body
      );

      return true;
    } catch (e) {
      this.logger.error(`Error when trying to update the status on [${this.provider}].`, e);
      return false;
    }
  }

  async getPullRequests() {
    try {
      const {
        data: { values }
      } = await this.client.get(
        `/projects/${this.projectKey}/repos/${this.repository.name}/pull-requests?state=OPEN`
      );
      return values;
    } catch (e) {
      this.logger.error(`Error when trying to get pull requests on [${this.provider}].`, e);
      return [];
    }
  }

  async determineIsPushPartOfPR(branch, sha) {
    const prList = await this.getPullRequests();
    const pullRequest = prList.find(
      merge => merge.fromRef.latestCommit === sha && merge.fromRef.displayId === branch
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
        `/projects/${this.projectKey}/repos/${this.repository.name}/pull-requests/${prNumber}/commits?limit=100`
      );
      const dataSize = data && data.values && data.values.length;
      return _.get(data, `values.[${dataSize - 1}].id`, '');
    } catch (e) {
      this.logger.error(`Error while trying to get PR start commit #${prNumber}`, e);
      return '';
    }
  }

  async checkPullRequestStartCommitStatusSkippedSuccess() {
    // Bitbucket data center API does not support GET /builds
    // https://docs.atlassian.com/bitbucket-server/rest/7.11.1/bitbucket-rest.html
    return false;
  }

  async getSourceCode(sha) {
    // The prefix is needed because when we untar the file we expect the source code to be inside a single folder.
    const { data } = await this.client.get(
      `/projects/${this.projectKey}/repos/${this.repository.name}/archive?format=tar.gz&at=${sha}&prefix=repo`,
      {
        responseType: 'stream'
      }
    );
    return data;
  }

  async getCommitDiffContent(sha, before) {
    if (!sha) {
      return undefined;
    }

    const beforeSha = before || `${sha}^`;

    const version = await this._getServerVersion();

    // Raw diff (i.e. text/plain) is only available in version 6.7 and higher of Bitbucket server.
    // https://developer.atlassian.com/server/bitbucket/reference/api-changelog/#bitbucket-server-6-7
    if (version.major < 6 || (version.major === 6 && version.minor < 7)) {
      // eslint-disable-next-line no-console
      console.log(
        `Raw diff is not supported on this version of Bitbucket server (${version.major}.${version.minor}.${version.patch}), skipping...`
      );
      return undefined;
    }

    try {
      const { data } = await this.client.get(
        `/projects/${this.projectKey}/repos/${this.repository.name}/diff?since=${beforeSha}&until=${sha}&whitespace=ignore-all&contextLines=0`,
        {
          headers: {
            accept: 'text/plain'
          }
        }
      );
      return data.replace(/src:\//g, 'a').replace(/dst:\//g, 'b');
    } catch (e) {
      this.logger.error(`Error while trying to get commit diff content for sha ${sha}`, e);
      return undefined;
    }
  }

  async getPullRequestDiffContent(prNumber) {
    if (!prNumber) {
      return undefined;
    }

    const version = await this._getServerVersion();

    // Raw diff (i.e. text/plain) is only available in version 6.7 and higher of Bitbucket server.
    // https://developer.atlassian.com/server/bitbucket/reference/api-changelog/#bitbucket-server-6-7
    if (version.major < 6 || (version.major === 6 && version.minor < 7)) {
      // eslint-disable-next-line no-console
      console.log(
        `Raw diff is not supported on this version of Bitbucket server (${version.major}.${version.minor}.${version.patch}), skipping...`
      );
      return undefined;
    }

    try {
      // NOTE: Raw diff (i.e. text/plain) is only available in version 6.7 and higher of Bitbucket server.
      // https://developer.atlassian.com/server/bitbucket/reference/api-changelog/#bitbucket-server-6-7
      const { data } = await this.client.get(
        `/projects/${this.projectKey}/repos/${this.repository.name}/pull-requests/${prNumber}/diff?whitespace=ignore-all&contextLines=0`,
        {
          headers: {
            accept: 'text/plain'
          }
        }
      );
      return data.replace(/src:\//g, 'a').replace(/dst:\//g, 'b');
    } catch (e) {
      this.logger.error(`Error while trying to get PR diff content for PR #${prNumber}`, e);
      return undefined;
    }
  }

  async setPullRequestComment(commentId, prNumber, body) {
    try {
      const content = { text: body.replace(/<[^>]*>?/gm, '') };

      let commentDoc;
      if (commentId) {
        const { version } = await this._getComment(prNumber, commentId);
        commentDoc = await this._updateComment(prNumber, commentId, version, content);
      } else {
        commentDoc = await this._createComment(prNumber, content);
      }

      return commentDoc;
    } catch (e) {
      this.logger.error(
        `Error while trying to set PR comment for PR #${prNumber}`,
        e.response.data
      );
      return false;
    }
  }

  async getHistoryCommitSha(sha, branch, limit = 50) {
    const {
      data: { values }
    } = await this.client.get(
      `/projects/${this.projectKey}/repos/${this.repository.name}/commits/?until=${sha}&limit=${limit}`
    );
    const history = values.map(x => x.id);

    return history;
  }

  async getSourceCodeSizeInKB() {
    // Bitbucket data center only support /browse api which return size of each file in repository
    // but need to manually fetch every existing folder and also deal with pagination
    // that is too much costly to implement and to use
    // So this getSourceCodeSize function for BBDC always force to return 0

    return 0;
  }

  generateLinkToCodeInSha(sha) {
    return (path, line) =>
      `${this.url}/projects/${encodeURIComponent(this.projectKey)}/repos/${encodeURIComponent(
        this.repository.name
      )}/browse/${path}?at=${sha}${line === 0 ? '' : `#${line}`}`;
  }

  async _createComment(prNumber, content) {
    const { data } = await this.client.post(
      `/projects/${this.projectKey}/repos/${this.repository.name}/pull-requests/${prNumber}/comments`,
      content
    );

    return data;
  }

  async _getComment(prNumber, commentId) {
    const { data } = await this.client.get(
      `/projects/${this.projectKey}/repos/${this.repository.name}/pull-requests/${prNumber}/comments/${commentId}`
    );

    return data;
  }

  async _updateComment(prNumber, commentId, version, content) {
    const {
      data
    } = await this.client.put(
      `/projects/${this.projectKey}/repos/${this.repository.name}/pull-requests/${prNumber}/comments/${commentId}`,
      { version, ...content }
    );

    return data;
  }

  // eslint-disable-next-line class-methods-use-this
  getToken() {
    return env.BITBUCKET_DATA_CENTER_OWN_USER_TOKEN;
  }

  getRepositoryFullPath() {
    return `${encodeURIComponent(this.projectKey)}/${this.repository.name}`;
  }

  static newClient(PAT) {
    const instance = axios.create({
      baseURL: `${env.BITBUCKET_DATA_CENTER_API_URL}/rest/api/1.0`,
      headers: {
        Authorization: `Bearer ${PAT}`
      },
      timeout: env.GITPROVIDER_GET_SOURCECODE_TIMEOUT_IN_SECOND * 1000
    });
    return instance;
  }

  async getFiles(files, sha) {
    const filesRequested = await Promise.all(
      files.map(
        path =>
          // eslint-disable-next-line no-async-promise-executor
          new Promise(async resolve => {
            try {
              const { data } = await this.client.get(
                `/projects/${this.projectKey}/repos/${this.repository.name}/raw/${path}?at=${sha}`
              );
              resolve({ path, content: data });
            } catch (e) {
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

  async _getServerVersion() {
    const { data } = await this.client.get(`/application-properties`);

    const { version } = data;

    if (!version) {
      throw new Error(`Failed to get server version, got ${JSON.stringify(data, null, 2)}.`);
    }

    const parts = version.split('.');

    const major = Number(parts[0]);
    let minor = 0;
    let patch = 0;

    if (parts.length > 1) {
      minor = Number(parts[1]);
    }

    if (parts.length > 2) {
      patch = Number(parts[2]);
    }

    return {
      major,
      minor,
      patch
    };
  }
}

module.exports = BitbucketDataCenter;
