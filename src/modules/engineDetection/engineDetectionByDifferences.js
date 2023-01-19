const minimatch = require('minimatch');

const MATCH_ALL_WILDCARD = '**';

class EngineDetectionByDifferences {
  constructor(engines, diffs) {
    this.engines = engines;
    this.diffs = diffs || [];
  }

  setDiffs(diffs) {
    this.diffs = diffs;
  }

  generateEngineMapping() {
    return this.engines.reduce(
      (r, engine) =>
        engine.triggerFiles.split(';').reduce((v, f) => {
          if (f === '') {
            return r;
          }
          const file = f.toLowerCase();
          return v[file]
            ? { ...v, [file]: [...v[file], engine.idEngine] }
            : { ...v, [file]: [engine.idEngine] };
        }, r),
      {}
    );
  }

  detect() {
    const mapping = this.generateEngineMapping();
    const keys = Object.keys(mapping);

    const engineThatAlwaysRun = [
      ...(mapping[MATCH_ALL_WILDCARD] ? mapping[MATCH_ALL_WILDCARD] : [])
    ];
    const enginesToRun = [];

    if (!this.diffs || this.diffs.length === 0) {
      return engineThatAlwaysRun;
    }

    this.diffs.forEach(file => {
      const found = [];
      for (const k of keys) {
        if (minimatch(file, k)) {
          found.push(...mapping[k]);
        }
      }
      enginesToRun.push(...engineThatAlwaysRun, ...found);
    });
    return enginesToRun;
  }
}

module.exports = EngineDetectionByDifferences;
