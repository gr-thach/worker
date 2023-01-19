const { v4: uuid } = require('uuid');

const { shouldReport } = require('./utils');

const generateNewFinding = ({
  findingData,
  idRepository,
  branch,
  status,
  sender,
  now,
  idEngineRun
}) => ({
  ...findingData,
  idFinding: uuid(),
  fkRepository: idRepository,
  branch,
  status,
  isVulnerability: shouldReport(findingData.filterReason),
  fkRule: findingData.rule,
  introducedBy: sender,
  introducedAt: now,
  fixedBy: null,
  fixedAt: null,
  createdAt: now,
  updatedAt: now,
  idEngineRun
});

module.exports = generateNewFinding;
