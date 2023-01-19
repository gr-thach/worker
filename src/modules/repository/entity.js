const lodashGet = require('lodash/get');
const lodashIsArray = require('lodash/isArray');

class RepositoryEntity {
  constructor(repositories) {
    this.self = {};
    this.ancestors = [];
    this.children = [];

    if (!lodashIsArray(repositories)) {
      this.self = null;
      return;
    }

    repositories.sort((a, b) => a.level - b.level);

    for (const r of repositories) {
      const level = lodashGet(r, 'level', 0);

      if (level < 0) {
        this.ancestors.push(r);
      }
      if (level === 0) {
        this.self = r;
      }
      if (level > 0) {
        this.children.push(r);
      }
    }
  }

  get() {
    return this.self;
  }

  getAncestors() {
    return this.ancestors;
  }

  getChildren() {
    return this.children;
  }

  getConfigs() {
    const ancestorsCfg = this.ancestors.map(r => r.configuration);
    const selfCfg = this.getConfiguration();
    return [...ancestorsCfg, selfCfg];
  }

  getConfiguration() {
    return this.self && this.self.configuration;
  }

  getSourcePath() {
    return this.self && this.self.path;
  }

  getExcludePaths() {
    return this.children.map(r => r.path);
  }
}

module.exports = RepositoryEntity;
