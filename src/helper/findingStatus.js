const findingStatus = {
  VULNERABILITY: 'VULNERABILITY',
  FIXED: 'FIXED',
  WONT_FIX: 'WONT_FIX',
  FALSE_POSITIVE: 'FALSE_POSITIVE',
  MARK_AS_FIXED: 'MARK_AS_FIXED',
  MARK_AS_VULNERABILITY: 'MARK_AS_VULNERABILITY'
};

const findFindingActionByDependency = (
  { path, lineNumber, fkRule, dependencyName, currentVersion },
  actions
) => {
  const transitiveDependency = lineNumber === 0;

  return actions.find(
    action =>
      action.fkRule === fkRule &&
      action.path === path &&
      (String(action.dependencyVersion) === String(currentVersion) ||
        (!action.dependencyVersion && !currentVersion)) &&
      action.dependencyName === dependencyName &&
      action.transitiveDependency === transitiveDependency
  );
};

const findFindingActionByLineContent = ({ path, lineContent, fkRule }, actions) => {
  const content = lineContent.trim();

  return actions.find(
    // We trim spaces in the line content on the action before we store them in the database,
    // so there is no need to trim the spaces on the line content on the action here.
    action => action.fkRule === fkRule && action.path === path && action.lineContent === content
  );
};

const getActionFindingStatus = (
  { path, lineNumber, fkRule, lineContent, dependencyName, currentVersion },
  actions
) => {
  let findingAction;

  if (dependencyName) {
    findingAction = findFindingActionByDependency(
      { path, lineNumber, fkRule, dependencyName, currentVersion },
      actions
    );
  } else if (lineContent) {
    findingAction = findFindingActionByLineContent({ path, lineContent, fkRule }, actions);
  } else {
    return null;
  }

  return findingAction ? findingAction.action : null;
};

const getExistingFindingStatus = (isVulnerability, existingStatus) => {
  if (isVulnerability && existingStatus !== findingStatus.VULNERABILITY) {
    return findingStatus.VULNERABILITY;
  }
  if (!isVulnerability && existingStatus !== findingStatus.FIXED) {
    return findingStatus.FIXED;
  }
  return existingStatus;
};

const getFindingStatus = (isVulnerability, existingStatus) => {
  let newStatus = isVulnerability ? findingStatus.VULNERABILITY : null;

  if (existingStatus) {
    newStatus = getExistingFindingStatus(isVulnerability, existingStatus);
  }

  return newStatus;
};

module.exports = {
  getFindingStatus,
  findingStatus,
  getActionFindingStatus
};
