const get = require('lodash/get');

const hardcodedSeverityIds = {
  NA: 1000,
  INFO: 1001,
  LOW: 1002,
  MEDIUM: 1003,
  HIGH: 1004,
  CRITICAL: 1005
};

const map = {
  na: hardcodedSeverityIds.NA,
  low: hardcodedSeverityIds.LOW,
  medium: hardcodedSeverityIds.MEDIUM,
  high: hardcodedSeverityIds.HIGH,
  critical: hardcodedSeverityIds.CRITICAL,
  moderate: hardcodedSeverityIds.MEDIUM,
  '5': hardcodedSeverityIds.MEDIUM,
  '12': hardcodedSeverityIds.CRITICAL,
  '10': hardcodedSeverityIds.CRITICAL,
  informational: hardcodedSeverityIds.INFO,
  info: hardcodedSeverityIds.INFO,
  '15': hardcodedSeverityIds.CRITICAL,
  unknown: hardcodedSeverityIds.NA
  // Add more mapping words based on engines that return non-standard severity values
};

const mapMetadataToSeverityId = (metadata, type, engineRule) => {
  const { cvssSeverity, severity } = metadata;

  let severityFromFinding;
  if (type && type.toLowerCase() === 'sca') {
    if (cvssSeverity && get(map, cvssSeverity.toLowerCase())) {
      severityFromFinding = cvssSeverity.toLowerCase();
    } else if (severity && get(map, severity.toLowerCase())) {
      severityFromFinding = severity.toLowerCase();
    }
  } else if (engineRule.cvssSeverity) {
    severityFromFinding = engineRule.cvssSeverity.toLowerCase();
  }

  return get(map, severityFromFinding, hardcodedSeverityIds.NA);
};

module.exports = {
  mapMetadataToSeverityId
};
