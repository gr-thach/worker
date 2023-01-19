const semver = require('semver');

const SIGMA_PATHS = [
  'cloud-functions/checkEmail/package.json',
  'cloud-functions/sendgrid_slack_webhook/package.json',
  'cloud-functions/parse_datafile/package.json',
  'cloud-functions/internal_sigma_slackbot/package.json'];

const SIGMA_DEPENDENCIES = [
  'https-proxy-agent'
];

const fixedOverride = [
  // Outdated DB resulting in false positive for grainbridge
  // This was actually updated by npm in the meantime
  // GuardRails detected it correctly, before information was
  // available. As such the line will be commented below.
  // { 'dependencyName': 'http-proxy', 'fixedVersion': '0.7.0' }
];
    
module.exports = (engineReport) => {
  if (engineReport.output) {
    let found = true;
    for (let i = 0; i < engineReport.output.length; i += 1) {
      const vulnerability = engineReport.output[i];
      if (
        vulnerability &&
        vulnerability.location &&
        vulnerability.location.path &&
        vulnerability.metadata &&
        vulnerability.metadata.dependencyName &&
        vulnerability.metadata.currentVersion
      ) {
        // Edge case for SigmaComputing (Todo: mark as false positive later)
        if (
          SIGMA_DEPENDENCIES.includes(vulnerability.metadata.dependencyName) &&
          SIGMA_PATHS.includes(vulnerability.location.path)
        ) {
          vulnerability.matchEngineFilterOut |= 1;
        } else {
          fixedOverride.forEach((dependency) => {
            if (
              vulnerability.metadata.dependencyName ===
              dependency.dependencyName &&
              semver.gt(
                vulnerability.metadata.currentVersion,
                dependency.fixedVersion
              )
            ){
              found = false;
            }
          });
          vulnerability.matchEngineFilterOut |= !found;
        }
      } else {
        vulnerability.matchEngineFilterOut |= 1;
      }
    };
  } else {
    // engineReport.output = [];
  }
  return engineReport;
};
