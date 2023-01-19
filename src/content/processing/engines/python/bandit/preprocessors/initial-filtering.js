let matchToFilterPath = [
  /\/?assets?\/?/i,
  /\/?deps\/?/i,
  /\/?docs?\//i,
  /\/?tests?\/?/i,
  /lib\/ansible\//i,
  /contrib\/inventory\//i
];

let whiteList = [];

let matchToFilterLineContent = [];

module.exports = (engineReport) => {
  let filteredOutput = [];

  for (let i = 0; i < engineReport.output.length; i++) {
    let finding = engineReport.output[i];
    let found = false;

    matchToFilterPath.forEach(function(element) {
      if (finding.location.path.match(element)) {
        found = true;
      }
    });

    let decodedLineContent;
    if (finding.metadata.lineContent) {
      decodedLineContent = finding.metadata.lineContent
        .replace(/\%27/g, '\'')
        .replace(/\%22/g, '"');
    }

    // Rule based filtering
    if (finding.ruleId) {
      // Hardcoded Password String
      // https://docs.openstack.org/bandit/latest/plugins/b105_hardcoded_password_string.html
      if (finding.ruleId === 'B105' && decodedLineContent) {
        // DUMMY_HOOK_TOKEN = 'dummy'
        // PASSWORD_TOO_SHORT_ERROR = "Invalid Password: Passwords must be "\\
        if (decodedLineContent.match(/(dummy|test|example|error)/i)) {
          found = true;
        }
        // token = ""
        // password: ''
        else if (decodedLineContent.match(/(:|=)\s*(\"\"|\'\')/i)) {
          found = true;
          // special case that may be a true positive
          // if encryption_passphrase == '':
          if (decodedLineContent.match(/==/)) {
            found = false;
          }
        }
      }
      // Hardcoded SQL Expressions
      // https://docs.openstack.org/bandit/latest/plugins/b608_hardcoded_sql_expressions.html
      if (
        finding.ruleId === 'B608' &&
        finding.location.path &&
        decodedLineContent
      ) {
        // Specifically reported false positives by Syapse
        // delete_sql = "delete from %s where %s = '%s'" % (
        // "insert into %s (%s) values (%s)"
        // get_column_names_sql = f"select column_name from information_schema.columns where table_name = '{table_name}'"
        if (finding.location.path.match(/minerva\/store\/data_access/i)) {
          if (
            decodedLineContent.match(
              /(delete_sql =|insert into %s \(%s\)|get_column_names_sql =)/i
            )
          ) {
            found = true;
          }
        } else if (decodedLineContent.match(/print\s*\(/i)) {
          found = true;
        }
      }
      // Test for use of popen with shell equals true
      // https://docs.openstack.org/bandit/latest/plugins/b602_subprocess_popen_with_shell_equals_true.html
      if (
        finding.ruleId === 'B602' &&
        finding.metadata.severity &&
        finding.metadata.severity === 'LOW'
      ) {
        found = true;
      }
    }

    // Add whitelist that works regardless of the above.
    whiteList.forEach(function(element) {
      if (finding.location.path.match(element)) {
        found = false;
      }
    });

    // File Matching was ok
    if (!found) {
      // Let's check if the lineContent is ok too.
      matchToFilterLineContent.forEach(function(element) {
        if (decodedLineContent.match(element)) {
          found = true;
        }
      });
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
