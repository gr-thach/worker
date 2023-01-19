const get = require('lodash/get');

const { getFindingStatus, findingStatus } = require('../findingStatus');
const {
  NOT_VULNERABILITY_BY_ENGINE_MASK,
  IS_USER_ACTION_SET_MASK,
  NOT_VULNERABILITY_BY_USER_ACTION_MASK,
  IGNORE_REPORT_MASK
} = require('../filterReasonMask');
const { stripAllSpace } = require('../findings');

const parseScaIdentity = d =>
  get(d, 'lineNumber', 0) > 0
    ? get(d, 'lineNumber', 0)
    : `${get(d, 'metadata.dependencyName', '')}_${get(d, 'metadata.currentVersion', 'null')}`;

const compareFinding = (a, b) => {
  const aType = get(a, 'type');
  const bType = get(b, 'type');

  if (aType !== bType || get(a, 'path') !== get(b, 'path')) {
    return false;
  }

  // finding unique characteristics by type
  // https://docs.google.com/document/d/1_uADMXrIXRJk9W20xuxLNOTVbhgoHK6Jstrr6lNDZ5o/edit
  switch (aType) {
    case 'sca':
      return (
        get(a, 'fkEngineRule') === get(b, 'fkEngineRule') &&
        get(a, 'fkCustomEngineRule') === get(b, 'fkCustomEngineRule') &&
        get(a, 'fkSeverity') === get(b, 'fkSeverity') &&
        parseScaIdentity(a) === parseScaIdentity(b)
      );
    case 'secret':
    case 'sast':
    default:
      return (
        get(a, 'fkEngineRule') === get(b, 'fkEngineRule') &&
        get(a, 'fkCustomEngineRule') === get(b, 'fkCustomEngineRule') &&
        get(a, 'lineNumber') === get(b, 'lineNumber') &&
        stripAllSpace(get(a, 'lineContent')) === stripAllSpace(get(b, 'lineContent'))
      );
  }
};

const containsFinding = (list, finding, findingId = undefined) =>
  !!list.find(f => (findingId && f.idFinding === findingId) || compareFinding(f, finding));

const getIsVulnerability = filterReason => {
  let isVulnerability = !(filterReason & NOT_VULNERABILITY_BY_ENGINE_MASK);
  if (filterReason & IS_USER_ACTION_SET_MASK) {
    isVulnerability = !(filterReason & NOT_VULNERABILITY_BY_USER_ACTION_MASK);
  }
  return isVulnerability;
};

const getStatus = (filterReason, userAction, existedFindingStatus) => {
  const isVulnerability = getIsVulnerability(filterReason);
  let status = getFindingStatus(isVulnerability, existedFindingStatus);
  if (filterReason & IS_USER_ACTION_SET_MASK) {
    status = status !== findingStatus.FIXED ? userAction : status;
  }
  return status;
};

const shouldReport = filterReason =>
  getIsVulnerability(filterReason) && !(filterReason & IGNORE_REPORT_MASK);

module.exports = {
  compareFinding,
  containsFinding,
  getIsVulnerability,
  getStatus,
  shouldReport
};
