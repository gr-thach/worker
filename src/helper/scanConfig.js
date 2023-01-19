const _ = require('lodash');
const Joi = require('@hapi/joi');
const yaml = require('js-yaml');

const configFileName = '.guardrails/config.yml';
const ignoreFileName = '.guardrails/ignore';
const ruleOverrideFileName = '.guardrails/ruleOverride.json';

const guardRailsDefaultConfig = {
  ignore: '',
  bundles: 'auto',
  report: {
    pullRequest: {
      findings: 'onChangedLinesOnly',
      comment: true,
      paranoid: false
    }
  },
  notifications: {
    slack: {
      enabled: false
    }
  },
  useGitClone: false,
  excludeBundles: [],
  monorepo: false
};

const guardRailsDefaultOverride = {
  engineRules: {},
  GuardRailsRules: {}
};

const allowedLanguages = [
  'apex',
  'c',
  'detect',
  'elixir',
  'general',
  'go',
  'java',
  'javascript',
  'mobile',
  'php',
  'python',
  'ruby',
  'rust',
  'solidity',
  'terraform',
  'typescript',
  'dotnet'
];

const bundlesSchema = Joi.alternatives().try(
  Joi.string().valid('auto'),
  Joi.array()
    .min(1)
    .items(
      Joi.valid(...allowedLanguages),
      Joi.object().pattern(
        Joi.string().valid(...allowedLanguages),
        Joi.array()
          .min(1)
          .items(Joi.string().regex(/[-_0-9a-zA-Z]+/))
      )
    )
);

const excludeBundlesSchema = Joi.alternatives().try(
  Joi.array()
    .min(1)
    .items(
      Joi.valid(...allowedLanguages),
      Joi.object().pattern(
        Joi.string().valid(...allowedLanguages),
        Joi.array()
          .min(1)
          .items(Joi.string().regex(/[-_0-9a-zA-Z]+/))
      )
    )
);

const reportSchema = Joi.object().keys({
  pullRequest: Joi.object().keys({
    findings: Joi.string()
      .valid('onAllFiles', 'onChangedFilesOnly', 'onChangedLinesOnly')
      .failover('onChangedLinesOnly'),
    comment: Joi.boolean().failover(true),
    paranoid: Joi.boolean().failover(false),
    showPublicReposChecks: Joi.boolean().failover(true)
  })
});

const notificationsSchema = Joi.object().keys({
  slack: Joi.object().keys({
    enabled: Joi.boolean().required(),
    notify: Joi.any().when('enabled', {
      is: Joi.boolean()
        .valid(true)
        .required(),
      then: Joi.valid('onAllScans', 'whenScanHasFindingsOnly', 'whenPRHasFindingsOnly').required()
    }),
    webhookUrl: Joi.any().when('enabled', {
      is: Joi.boolean()
        .valid(true)
        .required(),
      then: Joi.string()
        .uri()
        .required()
    })
  })
});

const monorepoSchema = Joi.array()
  .min(1)
  .items(
    Joi.alternatives().try(
      Joi.string(),
      Joi.object().pattern(
        Joi.string(),
        Joi.object().keys({
          bundles: bundlesSchema.failover(null),
          excludeBundles: excludeBundlesSchema.failover(null),
          report: reportSchema.failover(null),
          notifications: notificationsSchema.failover(null)
        })
      )
    )
  );

const configSchema = Joi.object()
  .keys({
    ignore: Joi.string().failover(''),
    useGitClone: Joi.boolean().failover(false),
    bundles: bundlesSchema.failover('auto'),
    report: reportSchema.failover({
      pullRequest: { findings: 'onChangedFilesOnly', comment: true, paranoid: false }
    }),
    notifications: notificationsSchema.failover({ slack: { enabled: false } }),
    excludeBundles: excludeBundlesSchema.failover([]),
    monorepo: monorepoSchema.failover(false)
  })
  .failover(guardRailsDefaultConfig);

const ruleOverrideSchema = Joi.object()
  .keys({
    engineRules: Joi.object()
      .pattern(
        Joi.string(),
        Joi.object()
          .pattern(
            Joi.string(),
            Joi.object()
              .keys({ enable: Joi.boolean().required(), docs: Joi.string() })
              .failover({})
          )
          .failover({})
      )
      .required()
      .failover({}),
    GuardRailsRules: Joi.object()
      .pattern(
        Joi.string(),
        Joi.object()
          .keys({
            enable: Joi.boolean().required(),
            title: Joi.string(),
            languages: Joi.object().pattern(
              Joi.string().valid(...allowedLanguages),
              Joi.boolean().failover(true)
            )
          })
          .failover({})
      )
      .required()
      .failover({})
  })
  .failover(guardRailsDefaultOverride);

const validateConfigYamlFile = yamlFile => {
  try {
    const config = _.pick(
      yaml.safeLoad(yamlFile, {
        schema: yaml.JSON_SCHEMA
      }),
      ['bundles', 'report', 'notifications', 'useGitClone', 'excludeBundles', 'monorepo']
    );
    return configSchema.validate(config).value;
  } catch (e) {
    return guardRailsDefaultConfig;
  }
};

const validateRuleOverrideFile = ruleOverrideFile => {
  try {
    const config = JSON.parse(ruleOverrideFile);
    return ruleOverrideSchema.validate(config).value;
  } catch (e) {
    return guardRailsDefaultOverride;
  }
};

const mergeHelper = (objValue, srcValue, key) => {
  if (key === 'ignore') {
    if (!srcValue) {
      return objValue;
    }
    return [objValue, srcValue].join('\n');
  }

  if (key === 'bundles' || key === 'excludeBundles') {
    if (!srcValue || !srcValue.length) {
      return objValue;
    }
    return srcValue;
  }

  // mutate the key to `ignore` if something is set to ignoreFile
  // This is a temporary patch until all configuration get updated to use `ignore`
  // For all repository accounted, ignoreFile usually has more relevant content than `ignore`
  // so we can simply override it
  if (key === 'ignoreFile') {
    if (srcValue && srcValue.length) {
      return { ignore: srcValue };
    }
  }

  return undefined;
};

const getConfigForRepository = (
  files,
  accountDefaultConfig = {},
  repositoryDefaultConfig = {},
  scanConfiguration = {}
) => {
  let baseConfig = _.mergeWith({}, guardRailsDefaultConfig, accountDefaultConfig, mergeHelper);
  if (files && files.ignoreFileName) {
    const ignoreArray = baseConfig.ignore
      .concat('\n', files.ignoreFileName)
      .split('\n')
      .map(x => x.trim());
    const ignoreFileContent = _.remove(_.uniq(ignoreArray), x => !!x).join('\n');
    baseConfig = _.merge(baseConfig, {
      ignore: ignoreFileContent
    });
  }
  // the repo settings for ignoreYml files always has priority, so it is not necessary to check at global level
  if (repositoryDefaultConfig.ignoreYmlConfig) {
    return _.mergeWith(baseConfig, repositoryDefaultConfig, scanConfiguration, mergeHelper);
  }

  let repoConfig = {};
  if (files && files.configFileName) {
    repoConfig = validateConfigYamlFile(files.configFileName);
  }

  if (files && files.ruleOverrideFileName) {
    baseConfig = _.merge(baseConfig, {
      ruleOverride: validateRuleOverrideFile(files.ruleOverrideFileName)
    });
  }

  return _.mergeWith(
    baseConfig,
    repositoryDefaultConfig,
    repoConfig,
    scanConfiguration,
    mergeHelper
  );
};

const getRepositoryV2Config = repositoryV2 =>
  _.mergeWith(...repositoryV2.getConfigs(), mergeHelper);

const getRepositoryConfig = async (
  providerService,
  scan,
  repositoryV2,
  sha,
  isMonorepoSupported
) => {
  const fileCfg = await providerService.getConfigFiles(sha);
  const accountCfg = providerService.account.configuration;
  const repoCfg = getRepositoryV2Config(repositoryV2);
  const scanCfg = scan.githookMetadata && scan.githookMetadata.config;
  const repoConfig = getConfigForRepository(fileCfg, accountCfg, repoCfg, scanCfg);

  // since using monorepoV2, the legacy monorepo config inside the repoConfig should be removed
  // to prevent conflict/duplicate logic as we still support monorepoV1 and V2
  // this check is not require when monorepoV1 is completely migrate to V2
  if (isMonorepoSupported) {
    repoConfig.monorepo = null;
  }
  return repoConfig;
};

module.exports = {
  getRepositoryConfig,
  configSchema,
  ruleOverrideSchema,
  guardRailsDefaultConfig,
  guardRailsDefaultOverride,
  validateConfigYamlFile,
  validateRuleOverrideFile,
  configFileName,
  ignoreFileName,
  ruleOverrideFileName,

  // export for tests
  getConfigForRepository
};
