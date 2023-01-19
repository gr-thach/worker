const fs = require('fs');
const path = require('path');
const { SCAN_TYPE } = require('../../helper/core-api/enums');

const preprocess = (enginesOutputs, pullRequestDiffContent, config, scanType) => {
  const { ignore, report } = config || {};
  const result = runEnginesPreprocessors(
    runGlobalPreprocessors(enginesOutputs, {
      'filter-findings-outside-of-pull-request-diff': {
        enableIf:
          scanType === SCAN_TYPE.PRE_HOOK ||
          (scanType === SCAN_TYPE.PULL && report && report.pullRequest.findings !== 'onAllFiles'),
        additionalParameter: {
          pullRequestDiffContent,
          reportRule: report && report.pullRequest.findings
        }
      },
      'filter-findings-matching-ignore-file': {
        enableIf: ignore && ignore.length,
        additionalParameter: { ignoreFile: ignore }
      }
    })
  );
  return result;
};

module.exports = preprocess;

const runGlobalPreprocessors = (enginesOutputs, conditionalPreprocessors) => {
  const globalPreprocessorsFolder = path.join(__dirname, './preprocessors');
  const globalPreprocessorsFiles = fs.readdirSync(globalPreprocessorsFolder);
  globalPreprocessorsFiles.forEach(file => {
    const filename = path.parse(file).name;
    const condition = conditionalPreprocessors[filename];
    if (!condition || (condition && condition.enableIf)) {
      const globalPreprocessor = require(path.join(globalPreprocessorsFolder, filename));
      enginesOutputs = !condition
        ? globalPreprocessor(enginesOutputs)
        : globalPreprocessor(enginesOutputs, condition.additionalParameter); // TODO: { ...condition.additionalParameters });
    }
  });
  return enginesOutputs;
};

const runEnginesPreprocessors = enginesOutputs => {
  // IMPORTANT-NOTE: engineOutputs is use as reference variable somewhere else beside this function
  // so any modify/update need to update to engineOutputs directly, otherwise the final scan result might be not as expected

  // TODO: check and remove the side effect

  enginesOutputs = enginesOutputs || {};
  for (const engineKey in enginesOutputs) {
    let engineOutput = enginesOutputs[engineKey];
    const engineName = engineKey.replace('@guardrailsio', '').replace('@guardrails', '');
    const [language, ...rest] = engineName.split('-').slice(2);
    const toolName = rest.join('-');
    const enginePreprocessorsFolder = path.join(
      __dirname,
      `./engines/${language}/${toolName}/preprocessors`
    );
    if (fs.existsSync(enginePreprocessorsFolder)) {
      const enginePreprocessorsFiles = fs.readdirSync(enginePreprocessorsFolder);
      if (enginePreprocessorsFiles.length > 0) {
        const initialFilters = enginePreprocessorsFiles.filter(
          f => f === 'initial-filtering.js' || f === 'todo-initial-filtering.js'
        );
        if (initialFilters.length) {
          // separate engine.output from db and from engine because of hashed-lineContent
          // only run initial-filtering against output from engine where still have raw-lineContent
          // result is the combine of initial-filtering result and output from db, as output form db must passed initial-filtering before it store in db
          const vulnerabilityFromDb = [];
          const vulnerabilityFromEngine = [];
          if (engineOutput.output && engineOutput.output.length) {
            for (let i = 0; i < engineOutput.output.length; i += 1) {
              // finding output from db is a vulnerability
              if (engineOutput.output[i].fromDb && engineOutput.output[i].isVulnerability) {
                vulnerabilityFromDb.push(engineOutput.output[i]);
              }
              // finding output from engine
              if (!engineOutput.output[i].fromDb) {
                vulnerabilityFromEngine.push(engineOutput.output[i]);
              }
            }
          }

          // run initial-filtering.js/todo-initial-filtering.js which is the filter base on lineContent against output from engine
          engineOutput.output = vulnerabilityFromEngine;
          initialFilters.forEach(file => {
            const preprocessor = require(path.join(enginePreprocessorsFolder, file));
            engineOutput = preprocessor(engineOutput);
          });
          // combine initial-filtering on output from engine and vulnerability output from db
          for (let i = 0; i < vulnerabilityFromDb.length; i += 1) {
            engineOutput.output.push(vulnerabilityFromDb[i]);
          }
        }

        enginePreprocessorsFiles
          .filter(f => f !== 'initial-filtering.js' && f !== 'todo-initial-filtering.js') // do not want to run initial-filtering again
          .forEach(file => {
            if (file !== '.gitkeep') {
              const preprocessor = require(path.join(enginePreprocessorsFolder, file));
              engineOutput = preprocessor(engineOutput);
            }
          });
      }
    }
    const { output, notInMapping, onDisabledLines, notInPRDiffs, matchIgnoreFile } = engineOutput;
    if (
      (!output || !output.length) &&
      (!notInMapping || !notInMapping.length) &&
      (!onDisabledLines || !onDisabledLines.length) &&
      (!notInPRDiffs || !notInPRDiffs.length) &&
      (!matchIgnoreFile || !matchIgnoreFile.length)
    ) {
      delete enginesOutputs[engineKey];
    }
  }

  return enginesOutputs;
};
