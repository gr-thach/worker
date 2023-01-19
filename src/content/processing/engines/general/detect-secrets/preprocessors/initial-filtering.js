const path = require('path');

const matchToFilterPath = [
  /tests?\/?/i,
  /\.html\/?/i,
  /(dummy|debug|demo)\//i,
  /amples?/i,
  /schemas?/i,
  /xcscheme/i,
  /yarn\.lock/i,
  /spec\.rb/i,
  /Godeps\.json/i,
  /Gopkg\.toml/i,
  /gitleaks\.toml/i,
  /\.lock$/i,
  /go\.sum/i,
  /package-lock\.json$/,
  /mix\.lock$/,
  /\/?ui\//i,
  /\/?static\//i,
  /\/?vendor\//i,
  /Cartfile\.resolved/i,
  /\/?dist\//i,
  /\/?distribution\//i,
  /\/?public\//i,
  /\/?frontend\//i,
  /\/?assets?\//i,
  /\/?packages?\//i,
  /browser\.js$/i,
  /\/?coverage\//i,
  // /src/features/blogDetails/components/blogContent/Carousel/_mock.js
  /\/?(mocks|mock)\/?/i,
  /\/?specs?\/?/i,
  /fake\-/i,
  /\.hpp$/i,
  /\.csv$/i,
  /\.css$/i,
  /\.scss$/i,
  /\.min\.js/i,
  /bundle\./i,
  /lang\//i,
  /languages\//i,
  /i18n\//i,
  /locales\//i,
  /translations\//i,
  /npm\-shrinkwrap\.json/i,
  /WORKSPACE/,
  /docs?\//i,
  /deps?\//i,
  /changelog/i,
  /datasets?\//i,
  /templates?/i,
  /release.?notes/i,
  /\.rst$/i,
  /__tests__/i,
  /benchmarks\//i,
  /\.md$/i,
  /\.sol$/,
  /\.adoc$/i,
  /\.log$/i,
  /node_modules/,
  /int\/.*\.json$/i,
  /(locale|LC_MESSAGES)\//i,
  /\/?(lib|backends)\//i,
  // Caused false positives for Loft47, thus removing it.
  /\.svg$/,
  // Mode Analytics specific exclusions
  /flamingo\/server\/gulpfile\.ts/,
  /credguard\/bin\/setup/,
  /directconnect\/bin\/setup/,
  /generated/i
];

const whiteList = [/\.mtf$/i, /Gemfile.lock/];

const matchToFilterLineContent = [
  /1234567890/,
  /0123456789/,
  /0123456789ABCDEF/i,
  /qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM/,
  /123456abcdef/i,
  /abcdefgh/i,
  /abcde12345/i,
  /abcdef123456/i,
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
  /redacted/i,
  /imagePath/i,
  /classpathentry/i,
  /https?:\/\/[\$\#]\{.+\}:[\$|\#]\{.+\}@/i,
  /https?:\/\/\{\{.+\}\}:\{\{.+\}\}@/i,
  /https?:\/\/.+?:[\$\#]\{[\w-]+\}@/i,
  // <Rule Id="CS0126ReturnMustBeFollowedByAnyExpression" Action="None" />
  /\<Rule Id(\ |\t)*?=(\s|\t)*?\"/i,
  // "cksum = %2760d1db2...e024cb95f76daa%27",
  // "default[%27bats%27][%27checksum%27] = %27bee2365079aa3bafb...f96227fb1c%27
  // down_revision = '%27'ad6a8262173e',
  // revision = '3bf3ecd2619d'
  /(checksum|cksum|revision|down_revision|chk_sum|certificate_hash|image\/|new\-from\-rev|docker|image|tag|commithash|ledger|from_secret).*?(=|:)/i,
  // checksum 'b7f5b08c0e6fa6dcce9c3e0174aad3605cae15dd9f806341bb9da9152248edd3'
  /(\ |\t)*?checksum\ \'\w+?\'/i,
  // "%27consul_0.6.4_linux_amd64.zip%27 => %27abdf0e1856292468e2c9971420d73b805e93888e006c76324ae39416edcf0627%27,",
  /(\ |\t)*?\'consul[\w\.]+?\.zip\'/i,
  /\w:\/\/%s:%s@/,
  /ObjectId\("/i,
  /^\s*file.?hash\s*?=/i,
  // message_id: 'e9cc839f78dd4226999f032060bd6ad4',
  /(hash|sha|sha256|sha1|message_id)[:=]\s*["|\']\w{18,}["|\']/i,
  // when '0.10.0' then '416835b2e83e520c3c413b4b4e4ae34bca20704f085b435f4c200010dd1ac3b7'
  /(\ |\t)*?when\ \'(\d|\.)*?\'\ then\ /i,
  // Auth0 Client Id
  // client_id: '9DhThQVVxH7V5UfSCc0zPnsmI5I9JBXR'",
  // config.auth0.clients.terminus.client_id = 'zNm5pNVeczBHaSFGnOMFTfQK1PUOXLrh'",
  /client_id\ *?(:|=)\s*?\'\w{32}\'/i,
  /^\s*"?(md5|guid|sha256|id|href|imageTag|integrity|commit)"?\s*(:|=)/i,
  /^\s*"docker_\w+?":/i,
  /^\s*['\"]?(revision|ref|url)['\"]?\s*:/i,
  /^\s*\+?\s*["\'][-\w\/+]{20,}[=]{0,2}["\']\s*[)]?\s*[,;\]]?\s*\+?\s*$/i,
  /pattern:\s*?["\']/i,
  /sha256\s*["\'][a-z0-9]{64}["\']/i,
  /'?(default|version|placeholder)'?[:=]\s?/i,
  /assert/i,
  /data:.+?;base64,/,
  // 17 verbose headers   etag: 'W/"5efed7279747fd5399e7745a28083016"',
  /etag:/i,
  // Pantheon reported false positives
  /_ancestor = u\"/i,
  // False positive filtering to remove variable assignments from the new secret rules
  // ClientSecret: external.AuthClientSecret
  // @"new_password": newPassword}}
  // This removes all instances of secret keywords that start with a letter, a number, "<","&",".","_" or "-"
  /(apikey|api_key|aws_secret_access_key|db_pass|password|passwd|private_key|secret|secrete)("|')?\s*(=|:|:=)+\s*[A-Z0-9_.<&-]+/i,
  // $headerCSP = "Content-Security-Policy: script-src 'self' 'unsafe-inline' 'nonce-TmV2ZXIgZ29pbmcgdG8gZ2l2ZSB5b3UgdXA=';";
  /content\-security\-policy/i,
  /unsafe-\inline/i,
  // env variables
  /(environ|getenv|process\.env|get_env|env\[)/i
];

const file_and_content_filter = {
  '.travis.yml': [/secure:/],
  '.travis.yaml': [/secure:/],
  'appveyor.yml': [/secure:/],
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

        if (!found && path.basename(finding.location.path) in file_and_content_filter) {
          file_and_content_filter[path.basename(finding.location.path)].forEach(function (
            element
          ) {
            if (lineContent.match(element)) {
              found = true;
            }
          });
        }
        // Specific go issue https://github.com/streichsbaer/bascule/blob/main/basculehttp/errorresponsereason_string.go#L21
        if (!found && finding.location.path.match(/\.go$/)) {
          if (lineContent.match(/error/i)) {
            found = true;
          }
        }
        // Improve false positives for Secret Keyword
        if (!found && finding.metadata && finding.metadata.secretType === "Secret Keyword"){
          if (lineContent.match(/(=|:|:=)+\s*@?("|'){1}("|'){1}/i)){
            found = true;
          }
          if (!found && lineContent.match(/(secrets?manager|name|path|driver|class|prefix|postfix).*["']?.*(=|:|:=|==|===|=>)/i)) {
            found = true;
          }
          // Todo: ["']?[A-Z_]+["'] -> For constant values
          // This is for entries not starting with ",',@
          if (!found && lineContent.match(/(=|:|:=|==|===|=>)+\s*[^"'@]+[a-zA-Z0-9]/i)) {
            found = true;
          }
          if (!found && lineContent.match(/(name|id|forgot|forget|error|invalid|failed|success|type|form|reset|prefix|stop|remember|suffix|test|public_?key|filter|length|hidden|empty|env|input|demo|error|temporary|annotation|file|info|resource|label|dialog|title|incorrect|analytic|_db|event|recognition).*(=|:|:=|=>)/i)) {
            found = true;
          }
          // = true
          if (!found && lineContent.match(/(=|:|:=|==|!=|===|=>)+\s*(true|false|nil|null)/i)) {
            found = true;
          }
          //: key
          if (!found && lineContent.match(/(=|:|:=|==|===|=>)+\s*["']?(key|token|module\.|apikey|api_key|minio|password|null|\$password|required|secret|!!options\.|options\.|sharedSecret|noSecret|isSecret|boundary|xxx|question|Basic |development|kubernetes)/i)) {
            found = true;
          }
          if (!found && lineContent.match(/(=|:|:=|==|===|=>)+.*(\${|var\.|suffix)/i)) {
            found = true;
          }
          // => '', : '', = '', = "", = ****, = ${ = {{, {
          if (!found && lineContent.match(/(=|:|:=|==|===|=>)+\s*("')?(''|""|" "|' '|\*\*\*|{|\$\(|\${|\$this|\$input)/i)) {
            found = true;
          }
          // 'password' => Hash::make(env('SUPERADMIN_PASSWORD', 'superadmin'))
          if (!found && lineContent.match(/(=|:|:=|==|===|=>)+.*env[\.(]/i)) {
            found = true;
          }
          // 'password' => ['string', 'asd', '']
          if (!found && lineContent.match(/(=|:|:=|==|===|=>)+\s*\[\s*["'].+,/i)) {
            found = true;
          }
          // 'password' = {\n
          if (!found && lineContent.match(/(=|:|:=|==|===|=>)+\s*(\[|\(|\{)\s*$/i)) {
            found = true;
          }
          if (!found && lineContent.match(/(secrets?manager|arn|pullsecret)/i)) {
            found = true;
          }
          if (!found && finding.location.path.match(/\.sql$/) && lineContent.match(/=\s*@/i)) {
            found = true;
          }
        }
        if (!found && finding.metadata && finding.metadata.secretType && finding.metadata.secretType.match(/High\sEntropy\sString/i)){
          if (lineContent.match(/(Find|commit|md5|HKEY_LOCAL_MACHINE|<dgm|\.xml\.|xs:|thumb|BigInteger|header|etag|_sum|toxenv|env\(|\.env|equals\(|abcdefghi|public_?key|filter|length|<input|hidden|<apex:|<c:|stop|schema|remember|validator|attribute|serialization|seed|instance|_id|ref:|widget|code)/i)) {
            found = true;
          }
          if (!found && lineContent.match(/(deviceNumber|che?c?ksum|serial|version|aarch64|arm|i686|x86_64|digest|fallback)/i)){
            found = true;
          }
          // TODO: IMPROVE THAT ONE
          // e.g MYSQL_ROOT_PASSWORD: xxxxxx
          if (!found && finding.location.path.match(/\.ya?ml$/)) {
            found = true;
          }
        }
        if (!found && finding.metadata && finding.metadata.secretType === "Twilio API Key"){
          if (finding.location.path.match(/\.sql$/)) {
              found = true;
          }
        }
        // Leave that for now and test it properly
        // if(lineContent.trim().length > 500){
        //   // we don't like trimmed lines that are longer than that.
        //   found = true;
        // }
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
