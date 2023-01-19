const GitProviderCommentRenderer = require('./renderer');

const GITLAB_MERGE_REQUEST_COMMENT_LENGTH_LIMIT = 1000000;

class GitlabCommentRenderer extends GitProviderCommentRenderer {
  constructor(groupedVulnerabilities, generateLinkToCodeInShaFunc, dashboardScanUrl) {
    super(groupedVulnerabilities, generateLinkToCodeInShaFunc, dashboardScanUrl);

    this.limitLength = GITLAB_MERGE_REQUEST_COMMENT_LENGTH_LIMIT;
    this.vulnerabilityTemplate = `[:bulb:]({{linkToDocs}}) | Title: **{{title}}**, Severity: {{severity}} <br /> {{pathWithLink}}\n`; // removed severity for now
  }
}

module.exports = GitlabCommentRenderer;
