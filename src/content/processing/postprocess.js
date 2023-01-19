const lodashGet = require('lodash/get');
const lodashUniqBy = require('lodash/uniqBy');

const processFindings = (findingsByGrId, engineOutput) => {

  for (const grId in engineOutput) {

    findingsByGrId[grId] = findingsByGrId[grId] || [];
    findingsByGrId[grId] = findingsByGrId[grId].concat(engineOutput[grId]);

    if (grId !== 'GR0013') {
      findingsByGrId[grId] = lodashUniqBy(findingsByGrId[grId], f =>
        [f.location.path, lodashGet(f, 'location.positions.begin.line')].join()
      );
    }
  }
};

module.exports = processedEnginesOutputs => {
  const vulnerabilities = {};
  const notInPRDiffs = {};
  const matchIgnoreFile = {};
  const onDisabledLines = {};
  const notInMapping = {};
  for (const engineOutput of Object.values(processedEnginesOutputs)) {
    const {
      vulnerabilitiesByGrId,
      notInPRDiffsByGrId,
      matchIgnoreFileByGrId,
      onDisabledLinesByGrId,
      notInMappingByGrId
    } = engineOutput;

    processFindings(vulnerabilities, vulnerabilitiesByGrId);
    processFindings(notInPRDiffs, notInPRDiffsByGrId);
    processFindings(onDisabledLines, onDisabledLinesByGrId);
    processFindings(matchIgnoreFile, matchIgnoreFileByGrId);
    processFindings(notInMapping, notInMappingByGrId);
  }

  return { vulnerabilities, notInPRDiffs, onDisabledLines, matchIgnoreFile, notInMapping };
};
