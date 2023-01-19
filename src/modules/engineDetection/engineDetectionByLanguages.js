class EngineDetectionByLanguages {
  constructor(engines) {
    this.engines = engines;
    this.languages = [];
  }

  setLanguages(lang) {
    if (Array.isArray(lang)) {
      this.languages = lang;
    }
  }

  detect() {
    return this.engines.filter(e => this.languages.includes(e.language)).map(e => e.idEngine);
  }
}

module.exports = EngineDetectionByLanguages;
