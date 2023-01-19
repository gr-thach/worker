const GitProviderCommentRenderer = require('./renderer');

const BITBUCKET_MERGE_REQUEST_COMMENT_LENGTH_LIMIT = 32768;

class BitbucketDataCenterCommentRenderer extends GitProviderCommentRenderer {
  constructor(groupedVulnerabilities, generateLinkToCodeInShaFunc, dashboardScanUrl) {
    super(groupedVulnerabilities, generateLinkToCodeInShaFunc, dashboardScanUrl);

    this.limitLength = BITBUCKET_MERGE_REQUEST_COMMENT_LENGTH_LIMIT;
    this.categoryTemplate = `{{title}}\n\n{{firstColumnThText}} | Details\n----- | --------\n{{vulnerabilitiesDetail}}{{languagesDetail}}\n{{separator}}\n`;
    this.categoryTitleTemplate = `#### {{title}} ({{totalVulnerabilities}})`;
    this.vulnerabilityTemplate = `[:bulb:]({{linkToDocs}}) | Title: **{{title}}**; Severity: {{severity}}; {{pathWithLink}}\n`; // removed severity for now
  }
}

module.exports = BitbucketDataCenterCommentRenderer;
