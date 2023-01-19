const uniqBy = require('lodash/uniqBy');
const isArray = require('lodash/isArray');
const fs = require('fs');
const sysPath = require('path');
const yaml = require('js-yaml');
const orderBy = require('lodash/orderBy');

const reportError = require('../utils/sentry');
const { getSubDir } = require('./fs');
const { archiveSrc } = require('./sourceCode');
const { isK8s } = require('../../config');
const { getEngineAccountConfig } = require('./core-api/engines');
const { analyzeSmartScanDiffNew, generateFullScanDiffNew } = require('./smartScan');

class ScanConfigNode {
  constructor(name, fullpath, config) {
    this.name = name;
    this.fullpath = fullpath;
    this.config = config;
    this.children = {};
  }

  getNode() {
    return {
      name: this.name,
      fullpath: this.fullpath,
      config: this.config,
      children: this.children
    };
  }
}

// generate config from global configs and monoRepo configs (if any)
const generateConfig = (parentConfig, monorepoConfig) => {
  const allowOverrideAttributes = ['bundles', 'excludeBundles', 'report', 'notifications'];
  const config = {};
  for (const attr of allowOverrideAttributes) {
    config[attr] =
      !monorepoConfig || !monorepoConfig[attr] ? parentConfig[attr] : monorepoConfig[attr];
  }
  return { ...config, ignore: parentConfig.ignore, ruleOverride: parentConfig.ruleOverride };
};

const buildRepoConfig = (configs, rootPath = '', excludeSubRepo = []) => {
  const ignore = (configs.ignore && configs.ignore.split('\n')) || [];
  const root = new ScanConfigNode('', rootPath, generateConfig({ ...configs, ignore }));

  // support repositoryV2 and backward compatible with old-monorepo
  // add skipScan child node in order to generate excludePaths
  if (isArray(excludeSubRepo)) {
    excludeSubRepo.map(r => addChild(root, r.fullpath, { ignoreScan: true }));
  }

  if (!configs.monorepo) {
    return root;
  }

  configs.monorepo.map(monorepoConfig => appendRepoConfig(root, monorepoConfig));

  return root;
};

const appendRepoConfig = (root, monorepoConfig) => {
  if (typeof monorepoConfig === 'string') {
    addChild(root, monorepoConfig, generateConfig(root.config));
  } else if (typeof monorepoConfig === 'object') {
    Object.entries(monorepoConfig).map(([path, config]) =>
      addChild(root, path, generateConfig(root.config, config))
    );
  }
};

const addChild = (root, path, config = null) => {
  const paths = getPaths(path);

  let current = root;
  for (let i = 0, l = paths.length; i < l; i += 1) {
    const dir = paths[i];
    if (current.children[dir]) {
      current = current.children[dir];
    } else {
      const child = new ScanConfigNode(dir, `${current.fullpath}${dir}/`);
      current.children[dir] = child;
      current = child;
    }
  }
  current.config = config;
};

const groupAndSort = configs => orderBy(uniqBy(configs, 'path'), 'path');

const makeEngineRunRepoConfigs = (root, paths, src) => {
  const configs = groupAndSort(paths.map(path => parseRepoDiff(root, path)));
  return configs.map((config, index) => ({
    ...config,
    excluded: populateExcludedPaths(config.excluded, src),
    index
  }));
};

const parseRepoDiff = (root, path) => {
  const parts = getDirPaths(path);
  const wildcardReplacements = [];

  let current = root;
  let result = current;
  let i = 0;

  while (i < parts.length && current) {
    const pivot = i;

    if (current.children[parts[i]]) {
      current = current.children[parts[i]];
      i += 1;
    } else if (current.children['*']) {
      current = current.children['*'];
      wildcardReplacements.push(parts[i]);
      i += 1;
    }

    if (i === pivot) {
      break;
    } else if (current.config) {
      result = current;
    }
  }

  return {
    path: fillWildcardPath(result.fullpath, wildcardReplacements),
    excluded: getNearestSubPaths(result),
    config: result.config
  };
};

const getNearestSubPaths = node => {
  const result = [];
  if (!node) {
    return result;
  }

  const stack = getChildren(node);
  while (stack.length) {
    const n = stack.pop();

    if (n.config) {
      result.push(n.fullpath);
    } else {
      stack.push(...getChildren(n));
    }
  }
  return result;
};

// normalize path to prevent path traversal
const getPaths = path =>
  sysPath
    .normalize(`/${path}`)
    .split('/')
    .filter(p => p !== '');

const getDirPaths = path => getPaths(path).slice(0, -1); // remove the filename part

const fillWildcardPath = (path, replacements) => path.replace(/\*/g, () => replacements.shift());

const populateExcludedPaths = (paths, srcPath) => fillWildcardPaths(paths, srcPath);

const fillWildcardPaths = (paths = [], srcPath) => {
  const result = [];
  const stack = [...paths];
  while (stack.length) {
    const path = stack.pop();
    if (path.indexOf('*') === -1) {
      result.push(path);
    } else {
      const subPath = path.substring(0, path.indexOf('*'));
      const subdirs = getSubDir(`${srcPath}/${subPath}`);
      stack.push(...subdirs.map(dir => path.replace('*', dir)));
    }
  }
  return result;
};

const getChildren = node => Object.values(node.children || {}).map(n => n);

const getRepoConfig = root => {
  const result = [];
  if (!root) {
    return result;
  }
  const stack = [root];
  while (stack.length) {
    const n = stack.shift();
    result.push(n.getNode());
    Object.values(n.children || {}).map(child => stack.push(child));
  }
  return result;
};

// customRuleConfig base path must manually update according to srcCode base path
const baseFilePath = '/tmp/scan';

const getCustomRulesConfig = async (engineId, accountId) => {
  const accountConfig = await getEngineAccountConfig(engineId, accountId);
  return accountConfig;
};

const generateConfigFolder = async (engineName, scanId, customConfig, isArchive) => {
  if (!customConfig) {
    return undefined;
  }
  const { rules, envVars, spec, accountId } = customConfig;
  if (!envVars && !rules) {
    return undefined;
  }
  const currentTime = new Date().getTime().toString();
  const dirPath = `${baseFilePath}/config-${engineName}-${accountId}-${scanId}-${currentTime}`;

  // https://sentry.io/organizations/guardrails/issues/2382308676/?project=1190080&referrer=slack
  // to handle current conflict error when folder already exists in some case before of race condition (?)
  // simple ignore and use the created config
  if (fs.existsSync(dirPath)) {
    return isArchive ? `${dirPath}.tar` : dirPath;
  }

  fs.mkdirSync(dirPath);

  if (rules) {
    const nameArr = spec.filename.split('.');
    const ext = nameArr[nameArr.length - 1] || 'json';
    checkContentFormat(rules, ext);
    const customRulesFileName = `engine-${engineName}-rules.${ext}`;
    fs.writeFileSync(`${dirPath}/${customRulesFileName}`, rules);
  }

  if (envVars) {
    const customConfigFileName = `engine-${engineName}-config.json`;
    fs.writeFileSync(`${dirPath}/${customConfigFileName}`, JSON.stringify(envVars));
  }

  if (isArchive) {
    const archived = await archiveSrc(`${dirPath}`, `${dirPath}.tar`);
    return archived;
  }
  return dirPath;
};

const CONFIG_FILE_FORMAT = {
  YAML: 'yaml',
  JSON: 'json',
  XML: 'xml'
};

/**
 *
 * @param {*} config
 * @param {string} format
 */
const checkContentFormat = (config, format) => {
  switch (format) {
    case CONFIG_FILE_FORMAT.YAML:
      checkContentIsYaml(config);
      break;
    case CONFIG_FILE_FORMAT.JSON:
      checkContentIsJson(config);
      break;
    default:
      throw new Error(`config file format ${format} is not supported`);
  }
};

const checkContentIsJson = content => {
  if (!['[', '{'].includes(content.trim()[0])) {
    throw new Error('content is not json');
  }
  JSON.parse(content);
};

const checkContentIsYaml = content => {
  // this is a weak way to check that the string is not of yaml format
  // but of json or xml format
  if (['[', '{', '<'].includes(content.trim()[0])) {
    throw new Error('content is not yaml');
  }
  // here we assert the yaml content and make sure
  // it is formatted properly
  try {
    yaml.safeLoad(content);
  } catch (e) {
    throw new Error(`error with yaml content ${e}`);
  }
};

const generateEngineCustomConfig = async (engine, accountId, scanId) => {
  try {
    const customRules = await getCustomRulesConfig(engine.idEngine, accountId);
    const src = await generateConfigFolder(engine.name, scanId, customRules, !isK8s);
    return src;
  } catch (e) {
    reportError(e);
    return undefined;
  }
};

const getConfigForEngineRunNew = async (scanConfig, diffContent, isFullScan) =>
  scanConfig.map((cfg, index) => ({
    ...cfg,
    index,
    ...(isFullScan
      ? generateFullScanDiffNew()
      : analyzeSmartScanDiffNew(cfg.path, cfg.excluded, diffContent))
  }));

const getScanConfigs = (config, rootPath, excludeSubRepo) => {
  const root = buildRepoConfig(config, rootPath, excludeSubRepo);
  return getAllNodes(root);
};

const getAllNodes = root => {
  const result = [];
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    (Object.values(node.children) || []).forEach(child => stack.push(child));

    if (node.config && !node.config.ignoreScan) {
      result.push({
        path: node.fullpath,
        excluded: getNearestSubPaths(node),
        config: node.config
      });
    }
  }
  return result;
};

module.exports = {
  buildRepoConfig,
  makeEngineRunRepoConfigs,
  getRepoConfig,
  getCustomRulesConfig,
  checkContentFormat,
  generateConfigFolder,
  generateEngineCustomConfig,
  populateExcludedPaths,
  fillWildcardPaths,
  getConfigForEngineRunNew,
  getScanConfigs,
  ScanConfigNode
};
