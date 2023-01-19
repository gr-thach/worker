const lodashUniq = require('lodash/uniq');

const EngineDetectionByLanguages = require('./engineDetectionByLanguages');
const EngineDetectionByDifferences = require('./engineDetectionByDifferences');
const EngineFilterByAccount = require('./engineFilterByAccount');
const EngineFilterByBundleConfigs = require('./engineFilterByBundleConfigs');
const EngineFilterByExcludeBundleConfigs = require('./engineFilterByExcludeBundleConfigs');
const EngineFilterByEnvironmentVariables = require('./engineFilterByEnvironmentVariables');

class EngineDetection {
  constructor(account, subscriptionFeatures, engines) {
    this.detectionByDiffs = new EngineDetectionByDifferences(engines);
    this.detectionByLanguages = new EngineDetectionByLanguages(engines);
    this.filterByAccount = new EngineFilterByAccount(engines, account, subscriptionFeatures);
    this.filterByBundle = new EngineFilterByBundleConfigs(engines);
    this.filterByExcludeBundle = new EngineFilterByExcludeBundleConfigs(engines);
    this.filterByEnvironmentVariables = new EngineFilterByEnvironmentVariables(engines);

    this.detector = [this.detectionByDiffs, this.detectionByLanguages];
    this.filterer = [
      this.filterByEnvironmentVariables,
      this.filterByAccount,
      this.filterByBundle,
      this.filterByExcludeBundle
    ];
  }

  setLanguages(langs) {
    this.detectionByLanguages.setLanguages(langs);
  }

  setScanConfigs(config) {
    this.filterByBundle.setScanConfigs(config.config);
    this.filterByExcludeBundle.setScanConfigs(config.config);
    this.detectionByDiffs.setDiffs(config.diffs);
  }

  detect({ config, languages }) {
    if (config) {
      this.setScanConfigs(config);
    }
    if (languages) {
      this.setLanguages(languages);
    }

    const detectedEngines = this.detector.reduce((r, p) => [...r, ...p.detect()], []);
    const filteredEngines = this.filterer
      .reduce((r, p) => p.filter(r), detectedEngines)
      .filter(e => e);
    return lodashUniq(filteredEngines);
  }
}

module.exports = EngineDetection;
