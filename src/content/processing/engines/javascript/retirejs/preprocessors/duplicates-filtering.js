const semver = require('semver');

module.exports = (engineReport) => {
  if (
    engineReport &&
    engineReport.process &&
    engineReport.process.name === 'retirejs'
  ) {
    let modOutput = [];
    for (let j = 0; j < engineReport.output.length; j += 1) {
      const item = engineReport.output[j];
      if (modOutput.length == 0) {
        modOutput.push(item);
      } else {
        let found = false;
        for (var i = 0; i < modOutput.length; i++) {
          if (
            modOutput[i].location.path === item.location.path &&
            modOutput[i].metadata.dependencyName ===
              item.metadata.dependencyName
          ) {
            // If same location/dependency exists, but the patchedVersion is lower
            // replace the element with the new one.
            if (
              modOutput[i].metadata.patchedVersions &&
              item.metadata.patchedVersions
            ) {
              let cleanCurrent = modOutput[i].metadata.patchedVersions.replace(
                '>',
                ''
              );
              let cleanCandidate = item.metadata.patchedVersions.replace(
                '>',
                ''
              );
              if (
                semver.lt(
                  semver.coerce(cleanCurrent),
                  semver.coerce(cleanCandidate)
                )
              ) {
                modOutput[i].matchEngineFilterOut |= 1;
                modOutput[i] = item;
              } else {
                item.matchEngineFilterOut |= 1;
              }
            }
            // If the item was found, then we can skip the rest of the loop
            found = true;
            break;
          }
        }
        if (!found) modOutput.push(item);
      }
    };
    // engineReport.output = modOutput;
  }
  return engineReport;
};
