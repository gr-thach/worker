const md = require('./markdown-helper');
const { env } = require('../../../config');
const { capitalizeLang } = require('../common');

const DEFAULT_LAYOUT_TEMPLATE = `{{mainContent}}\n{{footer}}`;

const DEFAULT_MAIN_TEMPLATE = `:warning: We detected {{count}} security issue{{s}} in this pull request:\n{{paranoidMode}}\n{{categories}}`;

const DEFAULT_CATEGORY_TEMPLATE = `<details>\n{{title}}<br>\n\n{{firstColumnThText}} | Details\n----- | --------\n{{vulnerabilitiesDetail}}{{languagesDetail}}{{separator}}</details>`;

const DEFAULT_CATEGORY_TITLE_TEMPLATE = `<summary>{{title}} ({{totalVulnerabilities}})</summary>`;

const DEFAULT_VULNERABILITY_TEMPLATE = `[:bulb:]({{linkToDocs}}) | Title: **{{title}}**, Severity: {{severity}} <br> {{linkToCode}}\n`;

// const DEFAULT_DEPENDENCY_TEMPLATE = `{{severity}} | [{{dependency}}]({{linkToCode}}) {{solution}}. References: {{references}}`;
const DEFAULT_DEPENDENCY_TEMPLATE = `{{severity}} | [{{dependency}}]({{linkToCode}}) {{solution}}\n`; // removed references for now

const DEFAULT_NO_VULNS_FOUND_TEMPLATE = md`
All previously detected findings have been fixed. Good job! 👍🎉

We will keep this comment up-to-date as you go along and notify you of any security issues that we identify.
`;

const DEFAULT_LANG_TEMPLATE = `\n\nMore info on how to fix {{category}} in {{linkToLangDocs}}.\n`;

const DEFAULT_FOOTER_TEMPLATE = md`
---

👉 Go to the [dashboard]({{dashboardScanUrl}}) for detailed results.

📥 Happy? Share your [feedback](https://guardrails.typeform.com/to/BCgBkB) with us.
`;

const DEFAULT_PARANOID_MODE_TEMPLATE = `\nMode: paranoid | Total findings: {{count}} | Considered vulnerability: {{vulnerabilityCount}}\n`;

const LIMIT_REACHED_MESSAGE = `\n\nThis comment has been **truncated** due to comment length limitations, please go to the dashboard for further details.\n`;

const MARGIN_CHARS = 300; // just in case some calculations are not accounted, we avoid errors by having some margin

class GitProviderCommentRenderer {
  constructor(groupedVulnerabilities, generateLinkToCodeInShaFunc, dashboardScanUrl) {
    this.groupedVulnerabilities = groupedVulnerabilities;
    this.dashboardScanUrl = dashboardScanUrl;
    this.limitLength = Number.MAX_SAFE_INTEGER;
    this.generateLinkToCodeInShaFunc = generateLinkToCodeInShaFunc;
    this.trackingParams = 'utm_source=ghpr';
    this.docBaseUrl = 'https://docs.guardrails.io/docs/en/vulnerabilities';

    // templates
    this.layoutTemplate = DEFAULT_LAYOUT_TEMPLATE;
    this.mainTemplate = DEFAULT_MAIN_TEMPLATE;
    this.categoryTemplate = DEFAULT_CATEGORY_TEMPLATE;
    this.categoryTitleTemplate = DEFAULT_CATEGORY_TITLE_TEMPLATE;
    this.vulnerabilityTemplate = DEFAULT_VULNERABILITY_TEMPLATE;
    this.dependencyTemplate = DEFAULT_DEPENDENCY_TEMPLATE;
    this.noVulnsTemplate = DEFAULT_NO_VULNS_FOUND_TEMPLATE;
    this.langTemplate = DEFAULT_LANG_TEMPLATE;
    this.footerTemplate = DEFAULT_FOOTER_TEMPLATE;
    this.paranoidModeTemplate = DEFAULT_PARANOID_MODE_TEMPLATE;

    this.remainingChars = 0;
  }

  // This function will return empty string if there are no enought remaining chars for the desired content
  calculateRemainingChars(content, removeTemplateVars = false) {
    const contentToCheck = removeTemplateVars ? content.replace(/{{[a-zA-Z]+}}/g, '') : content;
    if (contentToCheck.length < this.remainingChars) {
      this.remainingChars -= contentToCheck.length;
      return content;
    }

    this.remainingChars = 0; // this way we put a limit and say: ok, we can't add more things

    return '';
  }

  initRemainingChars() {
    const toExtract = [this.layoutTemplate, this.mainTemplate, LIMIT_REACHED_MESSAGE];
    this.remainingChars = this.limitLength - MARGIN_CHARS;
    toExtract.forEach(e => {
      this.remainingChars -= e.replace(/{{[a-zA-Z]+}}/, '').length;
    });
  }

  render(paranoidMode, consideredVulnerabilityCount) {
    let mainContent = '';

    this.initRemainingChars();

    // first get the footer, so we already count the chars for it (for the remaining chars logic)
    const footer = this.renderFooter();

    const categories = Object.keys(this.groupedVulnerabilities);
    if (categories.length) {
      mainContent = this.renderMainContent(paranoidMode, consideredVulnerabilityCount);
    } else {
      mainContent = this.renderNoVulnerabilitiesFound();
    }

    if (this.remainingChars === 0) {
      mainContent = `${mainContent}${LIMIT_REACHED_MESSAGE}`;
    }

    return this.layoutTemplate
      .replace('{{mainContent}}', mainContent)
      .replace('{{footer}}', footer);
  }

  renderFooter() {
    if (env.DISABLE_PR_COMMENT_FOOTER) {
      return '';
    }
    return this.calculateRemainingChars(
      this.footerTemplate.replace('{{dashboardScanUrl}}', this.dashboardScanUrl)
    );
  }

  renderMainContent(paranoidMode, consideredVulnerabilityCount) {
    return this.mainTemplate
      .replace('{{count}}', consideredVulnerabilityCount)
      .replace('{{s}}', consideredVulnerabilityCount === 1 ? '' : 's')
      .replace(
        '{{paranoidMode}}',
        this.renderParanoidMode(paranoidMode, consideredVulnerabilityCount)
      )
      .replace('{{categories}}', this.renderCategories());
  }

  renderNoVulnerabilitiesFound() {
    return this.calculateRemainingChars(this.noVulnsTemplate);
  }

  renderCategories() {
    const categories = Object.keys(this.groupedVulnerabilities);
    return categories
      .map((category, index) =>
        this.renderCategory(
          category,
          this.groupedVulnerabilities[category],
          index === categories.length - 1
        )
      )
      .join('');
  }

  renderCategory(category, vulnerabilities, isLast) {
    const languagesInCategory = [];
    const totalVulnerabilities = vulnerabilities.length;

    if (this.remainingChars === 0 || !vulnerabilities.length) {
      return '';
    }

    this.calculateRemainingChars(this.categoryTemplate, true);

    const title = this.renderCategoryTitle(category, totalVulnerabilities);

    const isDependencyRule = vulnerabilities.some(e => e.engineRule.rule === 'GR0013');

    let detail = '';
    let ruleDocs = null;
    for (let i = 0; i < totalVulnerabilities && this.remainingChars > 0; i += 1) {
      const { language, engineRule } = vulnerabilities[i];

      if (!languagesInCategory.includes(language)) {
        languagesInCategory.push(language);
      }

      if (engineRule.ruleDocs) {
        ruleDocs = engineRule.ruleDocs;
      }

      if (isDependencyRule) {
        detail += this.renderDependency(vulnerabilities[i]);
      } else {
        detail += this.renderVulnerability(vulnerabilities[i]);
      }
    }

    const languagesDetail = this.renderLanguagesDetail(languagesInCategory, category, ruleDocs);

    return this.categoryTemplate
      .replace('{{title}}', title)
      .replace('{{firstColumnThText}}', isDependencyRule ? 'Severity' : 'Docs')
      .replace('{{vulnerabilitiesDetail}}', detail)
      .replace('{{languagesDetail}}', languagesDetail)
      .replace('{{separator}}', isLast ? '' : '\n---\n');
  }

  renderCategoryTitle(category, totalVulnerabilities) {
    const title = category || 'Not categorized';
    const titleDetail = this.categoryTitleTemplate
      .replace('{{title}}', title)
      .replace('{{totalVulnerabilities}}', totalVulnerabilities);

    return this.calculateRemainingChars(titleDetail);
  }

  renderVulnerability(vulnerability) {
    const { engineRule, rule, path, lineNumber, severity, language } = vulnerability;

    const linkToCode = this.generateLinkToCodeInShaFunc(path, lineNumber);

    const pathWithLink = `File: [${path}](${linkToCode})`;

    const vulnDetail = this.vulnerabilityTemplate
      .replace('{{linkToDocs}}', this.getRuleDocsLink(rule.docs, language))
      .replace('{{title}}', engineRule.engineRuleTitle || engineRule.name)
      .replace('{{severity}}', engineRule.grSeverity || severity.name)
      .replace('{{path}}', path)
      .replace('{{linkToCode}}', lineNumber ? linkToCode : pathWithLink)
      .replace('{{pathWithLink}}', pathWithLink);

    return this.calculateRemainingChars(vulnDetail);
  }

  renderDependency(vulnerability) {
    const {
      path,
      lineNumber,
      metadata: { dependencyName, currentVersion, patchedVersions },
      severity
    } = vulnerability;

    const linkToCode = this.generateLinkToCodeInShaFunc(path, lineNumber);

    const dependency = `${dependencyName}${currentVersion ? `@${currentVersion}` : ''}`;
    const hasLineNumber = Boolean(Number(lineNumber) > 0);
    const isTransitiveDependency = Boolean(
      !path.endsWith('.js') &&
        (path.endsWith('package-lock.json') ||
          path.endsWith('yarn.lock') ||
          path.endsWith('npm-shrinkwrap.json') ||
          !hasLineNumber)
    );
    const transitiveDependency = isTransitiveDependency ? ' (t) ' : '';

    let solution = '';
    if (!patchedVersions) {
      solution = ' - **no details available**';
    } else if (patchedVersions === '<0.0.0') {
      solution = ' - **no patch available**';
    } else {
      solution = `upgrade to: *${patchedVersions.split('||').join('&#124;&#124;')}*`;
    }
    solution = `${transitiveDependency}${solution}`;

    const vulnDetail = this.dependencyTemplate
      .replace('{{severity}}', severity.name)
      .replace('{{dependency}}', dependency)
      .replace('{{linkToCode}}', linkToCode)
      .replace('{{solution}}', solution)
      .replace('{{references}}', '--');

    return this.calculateRemainingChars(vulnDetail);
  }

  renderLanguagesDetail(languages, category, ruleDocs) {
    let languagesLinks = '';

    languages.forEach((lang, index) => {
      const docsLink = this.getRuleDocsLink(ruleDocs, lang);

      const formattedLang = capitalizeLang(lang);
      languagesLinks += `[${formattedLang}](${docsLink})`;
      if (index < languages.length - 2) {
        languagesLinks += ', ';
      } else if (index === languages.length - 2) {
        languagesLinks += ' and ';
      }
    });

    const languagesDetail = this.langTemplate
      .replace('{{category}}', category)
      .replace('{{linkToLangDocs}}', languagesLinks);

    return this.calculateRemainingChars(languagesDetail);
  }

  renderParanoidMode(paranoidMode, count) {
    if (!paranoidMode) {
      return '';
    }

    const vulnerabilityCount = Object.values(this.groupedVulnerabilities).reduce(
      (sum, x) => sum + x.filter(v => v.status !== null).length,
      0
    );
    const paranoidModeDetail = this.paranoidModeTemplate
      .replace('{{count}}', count)
      .replace('{{vulnerabilityCount}}', vulnerabilityCount);

    return this.calculateRemainingChars(paranoidModeDetail);
  }

  // Extra helper functions
  getRuleDocsLink(docs, lang) {
    let link = docs || '404.html';
    const [baseURL, anchor] = link.split('#');
    const paramsSeparator = link.includes('?') ? '&' : '?';
    link = [baseURL + paramsSeparator + this.trackingParams, anchor].join('#');
    if (link.toLowerCase().startsWith('http')) {
      return `${link}`;
    }
    return `${this.docBaseUrl}/${lang}/${link}`;
  }
}

module.exports = GitProviderCommentRenderer;
