const GitProviderCommentRenderer = require('./renderer');

const GITHUB_PULL_REQUEST_COMMENT_LENGTH_LIMIT = 65536;

class GithubCommentRenderer extends GitProviderCommentRenderer {
  constructor(groupedVulnerabilities, generateLinkToCodeInShaFunc, dashboardScanUrl) {
    super(groupedVulnerabilities, generateLinkToCodeInShaFunc, dashboardScanUrl);

    this.limitLength = GITHUB_PULL_REQUEST_COMMENT_LENGTH_LIMIT;
  }
}

module.exports = GithubCommentRenderer;
