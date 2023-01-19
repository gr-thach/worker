const softMatching = require('./softMatching');
const { containsFinding, getIsVulnerability, getStatus } = require('./utils');
const generateNewFinding = require('./newFindings');
const generateExistedFinding = require('./existedFindings');
const generateFixedFindings = require('./fixedFindings');

const sortParsedEngineOutput = parsedEngineOutput =>
  parsedEngineOutput.sort((a, b) => {
    // sort by isVulnerability
    const aVulnerability = getIsVulnerability(a.filterReason);
    const bVulnerability = getIsVulnerability(b.filterReason);
    if (aVulnerability && !bVulnerability) {
      return -2;
    }
    if (!aVulnerability && bVulnerability) {
      return 2;
    }
    // sort by isCustomRule
    if (a.fkCustomEngineRule && !b.fkCustomEngineRule) {
      return -1;
    }
    if (!a.fkCustomEngineRule && b.fkCustomEngineRule) {
      return 1;
    }
    return 0;
  });

const processFindings = async ({
  idRepository,
  branch,
  parsedEngineOutput,
  allFindings,
  diffContent,
  sender,
  rootPath,
  excludedPaths,
  idEngineRun
}) => {
  const now = new Date().toJSON();
  const findingsResult = { fixed: [], existed: [], new: [] };

  // sort parsedEngineOutput: place isVulnerability and isCustomRule on top of the list
  sortParsedEngineOutput(parsedEngineOutput);

  for (const output of parsedEngineOutput) {
    if (!output.rule) {
      // remove sentry log for this error - https://guardrails.atlassian.net/browse/SS-180
      // reportError(new Error(`engineRule not found for ${idEngine}_${output.ruleId}`));
      continue; // eslint-disable-line no-continue
    }

    const { filterReason, userAction } = output;
    const existedFinding = softMatching(allFindings, output, diffContent);

    const status = getStatus(filterReason, userAction, existedFinding && existedFinding.status);

    // existing findings
    if (
      existedFinding &&
      !containsFinding(findingsResult.existed, output, existedFinding.idFinding)
    ) {
      findingsResult.existed.push(
        generateExistedFinding({
          findingData: output,
          existedFinding,
          status,
          sender,
          now,
          idEngineRun
        })
      );
    }

    // new findings
    if (
      output.rule &&
      output.path &&
      !existedFinding &&
      !containsFinding(findingsResult.new, output)
    ) {
      findingsResult.new.push(
        generateNewFinding({
          findingData: output,
          idRepository,
          branch,
          status,
          sender,
          now,
          idEngineRun
        })
      );
    }
  }

  // fixed findings
  const fixedFindings = allFindings.filter(
    f =>
      f.path.indexOf(rootPath || '') === 0 && // rootPath
      !excludedPaths.find(excludedPath => f.path.indexOf(excludedPath) === 0) && // excludedPaths
      findingsResult.existed.map(e => e.idFinding).indexOf(f.idFinding) === -1
  );

  for (const fixedFinding of fixedFindings) {
    findingsResult.fixed.push(
      generateFixedFindings({
        findingData: fixedFinding,
        sender,
        now
      })
    );
  }

  return findingsResult;
};

module.exports = processFindings;
