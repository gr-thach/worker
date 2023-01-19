const { createScansData } = require('../core-api/scans');
const {
  modifyAllFindingWithFileRenameDiffs,
  modifyAllFindingWithHashLineContent
} = require('../findings');
const generateResult = require('./generateResult');
const processFindings = require('./processFindings');

const generateFindings = async ({
  idEngine,
  idRepository,
  idEngineRun,
  branch,
  parsedEngineOutput,
  allFindings,
  engineRules,
  customEngineRules,
  sender,
  diffContent,
  rootPath,
  excludedPaths,
  hashLineContentFn,
  engine,
  ruleOverride
}) => {
  if (!idRepository || !branch) {
    return [];
  }
  // Hash lineContent allFindings data from db
  // NOTE: need to run this since db is not migrate/update since HashLineContent introduce
  modifyAllFindingWithHashLineContent(allFindings, hashLineContentFn);

  // Rename existing findings in case the file got moved
  modifyAllFindingWithFileRenameDiffs(allFindings, diffContent);

  const findingsResult = await processFindings({
    idRepository,
    branch,
    parsedEngineOutput: parsedEngineOutput.output,
    allFindings,
    diffContent,
    sender,
    rootPath,
    excludedPaths,
    idEngineRun
  });

  await createScansData(findingsResult);

  return generateResult(
    findingsResult.existed,
    findingsResult.new,
    engineRules,
    customEngineRules,
    idEngineRun,
    idEngine,
    engine,
    ruleOverride
  );
};

module.exports = {
  generateFindings
};
