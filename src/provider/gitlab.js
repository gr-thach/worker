const axios = require('axios');
const _ = require('lodash');
const {
  ACCOUNT_PROVIDER: { GITLAB }
} = require('../helper/core-api/enums');
const BaseProvider = require('./baseProvider');
const { env, constants } = require('../../config');

const gitlabStates = {
  pending: 'running',
  success: 'success',
  failure: 'failed',
  error: 'canceled'
};

class Gitlab extends BaseProvider {
  constructor(account, repository) {
    super(account, repository, GITLAB, env.GITLAB_URL);

    this.client = Gitlab.newClient();

    this.projectId = repository.providerInternalId;
  }

  getShortName() {
    return 'gl';
  }

  async getProject() {
    const { data } = await this.client.get(`/projects/${this.projectId}`);
    return data;
  }

  async updateCommitStatus(sha, state, description) {
    try {
      const params = new URLSearchParams({
        state: gitlabStates[state],
        context: `${constants.botDisplayName}/scan`,
        description
      });
      await this.client.post(`/projects/${this.projectId}/statuses/${sha}?${params}`);

      return true;
    } catch (e) {
      this.logger.error(`Error when trying to update the status on [${this.provider}].`, e);
      return false;
    }
  }

  async getPullRequests() {
    try {
      const { data: mergeRequests } = await this.client.get(
        `/projects/${this.projectId}/merge_requests?state=opened`
      );
      return mergeRequests;
    } catch (e) {
      this.logger.error(`Error when trying to get pull requests on [${this.provider}].`, e);
      return [];
    }
  }

  async determineIsPushPartOfPR(branch, sha) {
    const prList = await this.getPullRequests();
    const pullRequest = prList.find(merge => merge.source_branch === branch && merge.sha === sha);
    return !!pullRequest;
  }

  // TODO: handle pagination
  async getPullRequestStartCommitSha(prNumber) {
    if (!prNumber) {
      return '';
    }
    try {
      const { data } = await this.client.get(
        `/projects/${this.projectId}/merge_requests/${prNumber}/commits?&per_page=100`
      );
      const dataSize = data && data.length;
      return _.get(data, `[${dataSize - 1}].id`, '');
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

      const { data } = await this.client.get(
        `/projects/${this.projectId}/repository/commits/${sha}/statuses`
      );
      return _.get(data, '', []).some(
        d =>
          d.name === `${constants.botDisplayName}/scan` &&
          d.status === gitlabStates.success &&
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

  async getSourceCode(sha, ext = 'tar.gz') {
    const { data } = await this.client.get(
      `/projects/${this.projectId}/repository/archive.${ext}?sha=${sha}`,
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

    try {
      const {
        data: { diffs }
      } = await this.client.get(
        `/projects/${this.projectId}/repository/compare/?from=${beforeSha}&to=${sha}`
      );

      const diff = diffs
        .map(
          x => `--- ${x.new_file ? '/dev/null' : `a/${x.old_path}`}\n+++ b/${x.new_path}\n${x.diff}`
        )
        .join('');

      return diff;
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
      const versions = await this.client.get(
        `/projects/${this.projectId}/merge_requests/${prNumber}/versions`
      );
      const version = _.get(versions, 'data[0].id');

      const result = await this.client.get(
        `/projects/${this.projectId}/merge_requests/${prNumber}/versions/${version}`
      );

      const diff = _.get(result, 'data.diffs', [])
        .map(
          x => `--- ${x.new_file ? '/dev/null' : `a/${x.old_path}`}\n+++ b/${x.new_path}\n${x.diff}`
        )
        .join('');

      return diff;
    } catch (e) {
      this.logger.error(`Error while trying to get PR diff content for PR #${prNumber}`, e);
      return undefined;
    }
  }

  async setPullRequestComment(commentId, prNumber, body) {
    try {
      const apiEndpoint = `/projects/${this.projectId}/merge_requests/${prNumber}/notes${
        commentId ? `/${commentId}` : ''
      }`;
      const headers = { 'Content-Type': 'application/json' };

      const { data: commentDoc } = commentId
        ? await this.client.put(apiEndpoint, { body }, headers)
        : await this.client.post(apiEndpoint, { body }, headers);

      return commentDoc;
    } catch (e) {
      this.logger.error(`Error while trying to set PR comment for PR #${prNumber}`, e);
      return false;
    }
  }

  async getHistoryCommitSha(sha, branch, limit = 50) {
    const { data } = await this.client.get(
      `/projects/${this.projectId}/repository/commits/?ref_name=${branch}&per_page=${limit}`
    );
    const history = data.map(x => x.id);

    return history;
  }

  async generateLinkToCodeInSha(sha) {
    const project = await this.getProject();
    return (path, line) =>
      `${this.url}/${project.path_with_namespace}/blob/${sha}/${path}${
        line === 0 ? '' : `#L${line}`
      }`;
  }

  async getSourceCodeSizeInKB() {
    const { data } = await this.client.get(`/projects/${this.projectId}/?statistics=true`);
    const size = _.get(data, 'statistics.repository_size', 0);
    return size / 1000;
  }

  // eslint-disable-next-line class-methods-use-this
  getToken() {
    return env.GUARDRAILS_GITLAB_OWN_USER_TOKEN;
  }

  async getRepositoryFullPath() {
    const project = await this.getProject();
    return project.path_with_namespace;
  }

  static newClient() {
    const client = axios.create({
      baseURL: env.GITLAB_API_URL,
      timeout: env.GITPROVIDER_GET_SOURCECODE_TIMEOUT_IN_SECOND * 1000
    });
    client.defaults.headers.common['PRIVATE-TOKEN'] = env.GUARDRAILS_GITLAB_OWN_USER_TOKEN;
    return client;
  }

  async getFiles(files, ref) {
    const filesRequested = await Promise.all(
      files.map(
        path =>
          // eslint-disable-next-line no-async-promise-executor
          new Promise(async resolve => {
            try {
              const filePath = encodeURIComponent(path);
              const { data } = await this.client.get(
                `/projects/${this.projectId}/repository/files/${filePath}/raw?ref=${ref}`
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
}

module.exports = Gitlab;
