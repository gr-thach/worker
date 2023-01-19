class EngineFilterByAccount {
  constructor(engines, account, subscriptionFeatures) {
    this.engines = engines;
    this.account = account;
    this.subscriptionFeatures = subscriptionFeatures;
  }

  generateEngineMapping() {
    return this.engines.reduce((r, e) => ({ ...r, [e.idEngine]: e }), {});
  }

  filter(enginesToRun) {
    const mapping = this.generateEngineMapping();
    const { allowCustomEngines, excludedLanguages } = this.subscriptionFeatures;

    return enginesToRun.filter(idEngine => {
      const engine = mapping[idEngine];
      if (!idEngine || !engine || excludedLanguages.includes(engine.language)) {
        return false;
      }
      const isCustom = !!engine.fkAccount;
      if (isCustom) {
        return allowCustomEngines && (engine.allowFor || []).includes(this.account.idAccount);
      }
      return true;
    });
  }
}

module.exports = EngineFilterByAccount;
