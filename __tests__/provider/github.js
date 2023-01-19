const nock = require('nock');
const stream = require('stream');
const scan = require('../mocks/scan.json');
const Github = require('../../src/provider/github');

const generateLinkToCodeInShaFunc = () => {};
let githubProvider;
let pId;

describe('GithubProvider', () => {
  beforeAll(async () => {
    pId = `${scan.repository.account.login}/${scan.repository.name}`;

    nock('https://api.github.com')
      .post(`/app/installations/${scan.repository.account.installationId}/access_tokens`)
      .reply(200, { token: 'some-token', permissions: { checks: 'write' } });

    githubProvider = new Github(scan.repository.account, scan.repository);
    await githubProvider.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();

    const mockGenerateLinkToCodeInSha = jest.spyOn(Github.prototype, 'generateLinkToCodeInSha');
    mockGenerateLinkToCodeInSha.mockReturnValueOnce(generateLinkToCodeInShaFunc);
  });

  test('updateCommitStatus returns true when response is 200', async () => {
    // Valid states: error, failure, pending, or success
    const state = 'error'; // TODO: unit test with wrong state like: 'some state' ?
    const description = 'some description';

    nock('https://api.github.com')
      .post(`/repos/${pId}/check-runs`)
      .reply(200, { state: 'success' });

    const result = await githubProvider.updateCommitStatus(scan.sha, state, description, scan.type);

    expect(result).toBe(true);
  });

  test('updateCommitStatus returns false when response is not 200', async () => {
    // Valid states: error, failure, pending, or success
    const state = 'error'; // TODO: unit test with wrong state like: 'some state' ?
    const description = 'some description';

    nock('https://api.github.com')
      .post(`/repos/${pId}/statuses/${scan.sha}`)
      .reply(401, { message: 'Forbidden' });

    const result = await githubProvider.updateCommitStatus(scan.sha, state, description, scan.type);

    expect(result).toBe(false);
  });

  test('getSourceCode', async () => {
    const archiveLink = 'test';
    nock('https://api.github.com')
      .get(`/repos/${pId}/tarball/${scan.sha}`)
      .reply(200, archiveLink);

    const result = await githubProvider.getSourceCode(scan.sha);
    expect(result).not.toBeNull();
    expect(result instanceof stream.Readable).toBe(true);

    const data = [];
    for await (const chunk of result) {
      data.push(chunk);
    }
    expect(Buffer.concat(data).toString('utf-8')).toBe('test');
  });

  test('getSourceCode throws exception if fails to get the code from github', async () => {
    nock('https://api.github.com')
      .get(`/repos/${pId}/tarball/${scan.sha}`)
      .reply(500, { message: 'error 500 from github' });

    let error;
    try {
      await githubProvider.getSourceCode(scan.sha);
    } catch (e) {
      error = e;
    }

    expect(error.message).toBe('Request failed with status code 500');
  });

  test('getPullRequestDiffContent returns the diff when response is 200', async () => {
    nock('https://api.github.com', {
      reqheaders: { accept: 'application/vnd.github.v3.diff' }
    })
      .get(`/repos/${pId}/pulls/${scan.prNumber}`)
      .reply(200, { some: 'diff' });

    const result = await githubProvider.getPullRequestDiffContent(scan.prNumber);

    expect(result).toEqual({ some: 'diff' });
  });

  test('getPullRequestDiffContent returns anything when response is 200', async () => {
    nock('https://api.github.com', {
      reqheaders: { accept: 'application/vnd.github.v3.diff' }
    })
      .get(`/repos/${pId}/pulls/${scan.prNumber}`)
      .reply(200, false);

    const result = await githubProvider.getPullRequestDiffContent(scan.prNumber);

    expect(result).toBe(false);
  });

  test('getPullRequestDiffContent returns undefined when response is not 200', async () => {
    nock('https://api.github.com', {
      reqheaders: { accept: 'application/vnd.github.v3.diff' }
    })
      .get(`/repos/${pId}/pulls/${scan.prNumber}`)
      .reply(401);

    const result = await githubProvider.getPullRequestDiffContent(scan.prNumber);

    expect(result).toBe(undefined);
  });

  test('setPullRequestComment returns the comment document', async () => {
    nock('https://api.github.com')
      .patch(`/repos/${pId}/issues/comments/${scan.commentId}`)
      .reply(200, { id: scan.commentId });

    const result = await githubProvider.setPullRequestComment(
      scan.commentId,
      scan.prNumber,
      'Comment content'
    );

    expect(result).toEqual({ id: scan.commentId });
  });

  test('setPullRequestComment without commentId should post a new comment instead of patch existing', async () => {
    nock('https://api.github.com')
      .post(`/repos/${pId}/issues/${scan.prNumber}/comments`)
      .reply(200, { id: 123 });

    const result = await githubProvider.setPullRequestComment(
      null,
      scan.prNumber,
      'Edited comment content'
    );

    expect(result).toEqual({ id: 123 });
  });

  test('setPullRequestComment returns false response is not 200', async () => {
    nock('https://api.github.com')
      .patch(`/repos/${pId}/issues/comments/${scan.commentId}`)
      .reply(401);

    const result = await githubProvider.setPullRequestComment(
      null,
      scan.prNumber,
      'Some comment content'
    );

    expect(result).toBe(false);
  });
});
