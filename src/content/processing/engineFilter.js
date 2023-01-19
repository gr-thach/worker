const fs = require('fs');
const path = require('path');

const { MATCH_ENGINE_FILTER_OUT } = require('../../helper/filterReasonFlag');

// Note: from https://github.com/guardrailsio/worker/blob/873f6f96aa488d133562b55250f598ec59d5319e/src/content/processing/preprocess.js#L45
const enginesFilter = (engineOutput = {}, engineName, engineLanguage) => {
  const enginePreprocessorsFolder = path.join(
    __dirname,
    `./engines/${engineLanguage}/${engineName}/preprocessors`
  );

  if (fs.existsSync(enginePreprocessorsFolder)) {
    const enginePreprocessorsFiles = fs.readdirSync(enginePreprocessorsFolder);
    if (enginePreprocessorsFiles.length > 0) {
      enginePreprocessorsFiles.forEach(file => {
        const preprocessor = require(path.join(enginePreprocessorsFolder, file));
        preprocessor(engineOutput);
      });
    }
  }

  // calculate and set filterReason base on matchEngineFilterOut
  for (let i = 0; i < engineOutput.output.length; i += 1) {
    const finding = engineOutput.output[i];

    if (finding.fromDb) {
      const isVulnerability = finding.filterReasonFromDb & MATCH_ENGINE_FILTER_OUT;
      if (isVulnerability) {
        finding.filterReason |= MATCH_ENGINE_FILTER_OUT;
      } else {
        finding.filterReason &= ~MATCH_ENGINE_FILTER_OUT;
      }
    } else if (finding.matchEngineFilterOut) {
      finding.filterReason |= MATCH_ENGINE_FILTER_OUT;
    }
  }
};

module.exports = enginesFilter;
