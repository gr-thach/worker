const GitProviderCommentRenderer = require('./renderer');

const BITBUCKET_MERGE_REQUEST_COMMENT_LENGTH_LIMIT = 1000000;

class BitbucketCommentRenderer extends GitProviderCommentRenderer {
  constructor(groupedVulnerabilities, generateLinkToCodeInShaFunc, dashboardScanUrl) {
    super(groupedVulnerabilities, generateLinkToCodeInShaFunc, dashboardScanUrl);

    this.limitLength = BITBUCKET_MERGE_REQUEST_COMMENT_LENGTH_LIMIT;
    this.categoryTemplate = `{{title}}\n\n{{firstColumnThText}} | Details\n----- | --------\n{{vulnerabilitiesDetail}}{{languagesDetail}}\n{{separator}}\n`;
    this.categoryTitleTemplate = `#### {{title}} ({{totalVulnerabilities}})`;
    this.vulnerabilityTemplate = `:bulb: [Docs]({{linkToDocs}}) | Title: **{{title}}**; Severity: {{severity}}; {{pathWithLink}}\n`; // removed severity for now
    this.dependencyTemplate = `{{severity}} | Name: [{{dependency}}]({{linkToCode}}); Solution: {{solution}}\n`; // removed references for now
  }
}

module.exports = BitbucketCommentRenderer;
