const { checkIsVulnerability, generateFixedValue } = require('../findings');
const { getIsVulnerability, shouldReport } = require('./utils');

const generateExistedFinding = ({
  findingData,
  existedFinding,
  status,
  sender,
  now,
  idEngineRun
}) => {
  const isVulnerability = getIsVulnerability(findingData.filterReason);
  const currentIsVuln = checkIsVulnerability(existedFinding.status);
  const { fixedBy: currentFixedBy, fixedAt: currentFixedAt } = existedFinding;
  const fixedBy = generateFixedValue(isVulnerability, currentIsVuln, currentFixedBy, sender);
  const fixedAt = generateFixedValue(isVulnerability, currentIsVuln, currentFixedAt, now);

  return {
    ...existedFinding,
    ...findingData,
    fkRule: findingData.rule,
    status,
    fixedBy,
    fixedAt,
    updatedAt: now,
    isVulnerability: shouldReport(findingData.filterReason),
    idEngineRun
  };
};

module.exports = generateExistedFinding;
