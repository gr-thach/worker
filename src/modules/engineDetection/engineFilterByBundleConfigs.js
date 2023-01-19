const lodashGet = require('lodash/get');

class EngineFilterByBundleConfigs {
  constructor(engines) {
    this.engines = engines;
    this.configs = {};
  }

  setScanConfigs(configs) {
    this.configs = configs;
  }

  generateEngineMapping() {
    return this.engines.reduce((r, e) => ({ ...r, [e.idEngine]: e }), {});
  }

  filter(enginesToRun) {
    const mapping = this.generateEngineMapping();
    const bundles = lodashGet(this.configs, 'bundles', []);

    if (bundles === 'auto') {
      return enginesToRun;
    }

    let result = [];
    bundles.forEach(bundle => {
      if (typeof bundle === 'string') {
        result = result.concat(
          enginesToRun.filter(idEngine => mapping[idEngine].language === bundle)
        );
      } else if (typeof bundle === 'object') {
        const bundleLanguage = Object.keys(bundle)[0];
        const bundleEngines = bundle[bundleLanguage];
        // bundles come with engine names without the language. When having a custom engine, we shouldn't concat the language.
        result = result.concat(
          enginesToRun.filter(idEngine => {
            const engine = mapping[idEngine];
            const isCustom = !!engine.fkAccount;
            return (
              bundleEngines.includes(
                isCustom ? engine.name : engine.name.replace(`${engine.language}-`, '')
              ) && engine.language === bundleLanguage
            );
          })
        );
      }
    });

    return result;
  }
}

module.exports = EngineFilterByBundleConfigs;
