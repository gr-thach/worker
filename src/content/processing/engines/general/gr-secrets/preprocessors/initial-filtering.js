const matchToFilterPath = [
  /tests?\/?/i,
  /\.html\/?/i,
  /examples?\//i,
  /dummy/i,
  /demo/i,
  /samples?/i,
  /\.phar/i,
  /examples?/i,
  /schemas?/i,
  /xcscheme/i,
  /benchmarks\//i,
  /Godeps\.json/i,
  /Gopkg\.toml/i,
  /Gopkg\.lock/i,
  /gitleaks\.toml/i,
  /go\.sum/i,
  /\.lock$/i,
  /package-lock\.json$/,
  /mix\.lock$/,
  /\/?ui\//i,
  /\/?static\//i,
  /\/?vendor\//i,
  /\/?dist\//i,
  /\/?public\//i,
  /\/?assets?\//i,
  /\/?packages?\//i,
  /browser\.js$/i,
  /\/?coverage\//i,
  /\/?mocks?\//i,
  /specs?(\.|\/)/i,
  /fake\-/i,
  /\.hpp$/i,
  /\.csv$/i,
  /\.css$/i,
  /\.scss$/i,
  /\.min\.js/i,
  /\.js\.map/i,
  /\.css\.map/i,
  /bundle\./i,
  /lang\//i,
  /languages\//i,
  /i18n\//i,
  /locales\//i,
  /translations\//i,
  /npm\-shrinkwrap\.json/i,
  /WORKSPACE/,
  /yarn\.lock/i,
  /docs?\//i,
  /deps?\//i,
  /changelog/i,
  /\/?templates?\//i,
  /Cartfile\.resolved/i,
  /datasets?\//i,
  /release.?notes/i,
  /\.rst$/i,
  /\.md$/i,
  /\.sol$/,
  // Caused false positives for Loft47, thus removing it.
  /\.svg$/,
  /node_modules/,
  /(locale|LC_MESSAGES)\//i,
  /\/?lib\//i,
  /generated/i
];

const whiteList = [/\.mtf$/i, /Gemfile.lock/];

const matchToFilterLineContent = [
  /1234567890/,
  /0123456789/,
  /0123456789ABCDEF/i,
  /abcdefgh/i,
  /abcde12345/i,
  /public.?key/i,
  /pubkey/i,
  /test/i,
  /sk_test_[a-zA-Z0-9]{24}/,
  /^\s*\/\//,
  /^\s*#\s?/,
  /^\s*\*/,
  /^\s*\/\*/,
  /",\s*$/,
  /"\);\s*$/,
  /^\s*\+/,
  /example/i,
  /imagePath/i,
  /classpathentry/i,
  /e\.g\./i,
  // Slack URL can be ignored
  /https?:\/\/hooks\.slack\.com\/services\//i,
  /https?:\/\/user:password@127\.0\.0\.1:/i,
  // https://$user:$pass...
  /https?:\/\/[\$\#]\{.+\}:[\$|\#]\{.+\}@/i,
  // https://{{user}}:{{pass}}
  /https?:\/\/\{\{.+\}\}:\{\{.+\}\}@/i,
  // https://username:${pass}
  /https?:\/\/.+?:[\$\#]\{[\w-]+\}@/i,
  // mysql://{username}:{password}@{host}:{port}/{database}
  /(https?|mysql):\/\/\{?.+?:\{.+\}@/i,
  // https://DEPS_GITHUB_USER:$DEPS_GITHUB_TOKEN@github.com
  // https://xxx-integrations:$GITHUB_TOKEN@github.com/$CF_REPO_OWNER/$CF_REPO_NAME.git
  /https?:\/\/\$?[\w-]+?:\$\w+?@/i,
  // https://$GITHUB_TOKEN:x-oauth-basic@api.github.com/repos/pantheon-systems/hermes/statuses/$sha
  /https:\/\/\$\w+?:x-oauth-basic@api\.github\.com/i,
  // ssh://git@github.com .. ref = "ecf1f86...2e"
  // git@github.com:guardrailsio/devops.git
  /(ssh:\/\/)?git@github.com/i,
  /\w:\/\/%s:%s@/,
  /ObjectId\("/i,
  /^\s*file.?hash\s*?=/i,
  /^\s*"(md5|guid|sha256|id|href|imageTag|integrity|commit)":/i,
  /^\s*"docker_\w+?":/i,
  /^\s*(revision|ref):/,
  /AccountRef"\s*?=/i,
  /'?(default|version|placeholder)'?[:=]\s?/i,
  /CLIENT_SECRET_NAME\s*[:=]/i,
  /assert/i,
  /data:.+?;base64,/,
  // False Positive reported by recurly
  /BooleanValidationOperator/i,
  // env variables
  /(environ|getenv|process\.env|get_env|env\[)/i
];

const file_and_content_filter = {
  '.travis.yml': [/secure:/],
  Gemfile: [/gem.*?,\s*?git:.*?,\s*?(revision|ref|branch|tag):.*/]
};

module.exports = (engineReport) => {
  const filteredOutput = [];

  for (let i = 0; i < engineReport.output.length; i++) {
    const finding = engineReport.output[i];
    let found = false;

    matchToFilterPath.forEach(function (element) {
      if (finding.location.path.match(element)) {
        found = true;
      }
    });

    // Add whitelist that works regardless of the above.
    whiteList.forEach(function (element) {
      if (finding.location.path.match(element)) {
        found = false;
      }
    });

    // File Matching was ok
    if (!found) {
      if (finding && finding.metadata && finding.metadata.lineContent) {
        const lineContent = finding.metadata.lineContent
          .replace(/\%27/g, '\'')
          .replace(/\%22/g, '"');
        // Let's check if the lineContent is ok too.
        matchToFilterLineContent.forEach(function (element) {
          if (lineContent.match(element)) {
            found = true;
          }
        });

        if (!found && finding.location.path in file_and_content_filter) {
          file_and_content_filter[finding.location.path].forEach(function (
            element
          ) {
            if (lineContent.match(element)) {
              found = true;
            }
          });
        }

        if (!found && lineContent.match(/(=|:|:=|==|===|=>)+\s*(''|""|" "|' '|\*\*\*|{|\$\(|\${)/i)) {
          found = true;
        }
        if (!found && lineContent.match(/(=|:|:=|==|===|=>)+.*(\$\(|\${)/i)) {
          found = true;
        }
        if (!found && lineContent.match(/(=|:|:=|==|===|=>)+.*env[\.(]/i)) {
          found = true;
        }
        if (!found && lineContent.match(/(HKEY_LOCAL_MACHINE|<dgm|\.xml\.|xs:|thumbprint|BigInteger|header|chksum|etag|_sum|decode|encode)/i)) {
          found = true;
        }
        if (!found && lineContent.match(/:(passwd|password|pass)@/i)) {
          found = true;
        }
        if (!found && lineContent.match(/(secrets?manager|name|path|driver|class|prefix|postfix).*["']?.*(=|:|:=|==|===|=>)/i)) {
          found = true;
        }
        if (!found && lineContent.match(/(name|id|forgot|forget|error|invalid|failed|success|type|form|reset|prefix|stop|remember|suffix|test|public_?key|filter|length|hidden|empty|env|input|demo|error|temporary|annotation|file|info|resource|label|dialog|title|incorrect|analytic|_db|event|recognition).*(=|:|:=|=>)/i)) {
          found = true;
        }
      }
      // If it made it this far, then we like it!
      if (!found) {
        filteredOutput.push(finding);
      }
    }
    finding.matchEngineFilterOut |= found;
  }
  // engineReport.output = filteredOutput;
  return engineReport;
};
