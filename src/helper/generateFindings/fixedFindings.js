const findingStatus = {
  VULNERABILITY: 'vulnerability',
  FIXED: 'fixed',
  WONT_FIX: 'wont_fix',
  FALSE_POSITIVE: 'false_positive',
  MARK_AS_FIXED: 'mark_as_fixed',
  MARK_AS_VULNERABILITY: 'mark_as_vulnerability'
};

const generateFixedFindings = ({ findingData, sender, now }) => {
  const status =
    findingData.status === findingStatus.VULNERABILITY.toUpperCase() ||
    findingData.status === findingStatus.MARK_AS_VULNERABILITY.toUpperCase() // ? also consider MARK_AS_VULNERABILITY?
      ? findingStatus.FIXED
      : findingData.status;

  return {
    ...findingData,
    status,
    fixedBy: sender,
    fixedAt: now,
    updatedAt: now,
    isVulnerability: false
  };
};

module.exports = generateFixedFindings;
