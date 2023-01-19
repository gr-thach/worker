const lodashGet = require('lodash/get');

const log = require('../utils/logger');

const parseLanguageFromEnryOutput = (languageOutputs, allLanguages) => {
  try {
    const repoLanguages = JSON.parse(languageOutputs);
    // in case of Enry output handle by engine-wrapper, result output would be an object instead of array
    // catch it here to prevent error in parseLanguageFromEnryOutputV2
    if (lodashGet(repoLanguages, 'status') === 'use-engine-wrapper') {
      return [];
    }
    return parseLanguageFromEnryOutputV2(repoLanguages, allLanguages);
  } catch (e) {
    log.error('could not parse enry output', e, e.stack);
    return [];
  }
};

const parseLanguageFromEnryOutputV2 = (languageOutputs, allLanguages) => {
  const languagesToRun = new Set(['general']);
  const mobileLanguages = ['apk', 'ipa', 'objective-c', 'objective-c++', 'swift', 'android', 'ios'];
  const dotNetLanguages = ['c#', 'asp.net', 'visual basic .net'];
  const cLanguages = ['c++', 'cmake', 'c'];

  try {
    languageOutputs.forEach(repoLanguage => {
      if (allLanguages.includes(repoLanguage)) {
        languagesToRun.add(repoLanguage);
      } else if (repoLanguage === 'hcl') {
        if (allLanguages.includes('terraform')) {
          languagesToRun.add('terraform');
        }
      } else if (mobileLanguages.includes(repoLanguage)) {
        if (allLanguages.includes('mobile')) {
          languagesToRun.add('mobile');
        }
      } else if (dotNetLanguages.includes(repoLanguage)) {
        if (allLanguages.includes('dotnet')) {
          languagesToRun.add('dotnet');
        }
      } else if (cLanguages.includes(repoLanguage)) {
        if (allLanguages.includes('c')) {
          languagesToRun.add('c');
        }
      }
    });
    return [...languagesToRun];
  } catch (e) {
    log.error('could not detect repo language', e, e.stack);
    return [];
  }
};

module.exports = {
  parseLanguageFromEnryOutput,
  parseLanguageFromEnryOutputV2
};
