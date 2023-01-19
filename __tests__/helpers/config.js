/* eslint-disable global-require */
describe('repository utils', () => {
  describe('validation configSchema', () => {
    const { configSchema, guardRailsDefaultConfig } = require('../../src/helper/scanConfig');
    test('should return default config if config structure is not similar', () => {
      expect(
        configSchema.validate({
          ...guardRailsDefaultConfig,
          unknownField: '',
          report: { unknownInnerField: '' }
        }).value
      ).toEqual(guardRailsDefaultConfig);
    });

    test('should return default bundles', () => {
      expect(
        configSchema.validate({
          ...guardRailsDefaultConfig,
          bundles: 'someGibberish'
        }).value
      ).toEqual(guardRailsDefaultConfig);

      expect(
        configSchema.validate({
          ...guardRailsDefaultConfig,
          bundles: ['someLanguage']
        }).value
      ).toEqual(guardRailsDefaultConfig);

      expect(
        configSchema.validate({
          ...guardRailsDefaultConfig,
          bundles: { someLanguage: 'unknowEngine' }
        }).value
      ).toEqual(guardRailsDefaultConfig);

      expect(
        configSchema.validate({
          ...guardRailsDefaultConfig,
          notifications: { slack: { webhookUrl: 'url', enabled: true } }
        }).value
      ).toEqual(guardRailsDefaultConfig);
    });

    test('should default useGitClone', () => {
      expect(
        configSchema.validate({
          ...guardRailsDefaultConfig,
          useGitClone: 'something'
        }).value
      ).toEqual({
        ...guardRailsDefaultConfig,
        useGitClone: false
      });
    });

    test('should not default useGitClone', () => {
      expect(
        configSchema.validate({
          ...guardRailsDefaultConfig,
          useGitClone: true
        }).value
      ).toEqual({
        ...guardRailsDefaultConfig,
        useGitClone: true
      });
    });

    test('should default paranoid mode', () => {
      expect(
        configSchema.validate({
          ...guardRailsDefaultConfig,
          report: {
            pullRequest: {
              findings: 'onChangedFilesOnly',
              comment: false,
              paranoid: 'paranoid'
            }
          }
        }).value
      ).toEqual({
        ...guardRailsDefaultConfig,
        report: {
          pullRequest: {
            findings: 'onChangedFilesOnly',
            comment: false,
            paranoid: false
          }
        }
      });
    });

    test('should not default paranoid mode', () => {
      expect(
        configSchema.validate({
          ...guardRailsDefaultConfig,
          report: {
            pullRequest: {
              findings: 'onChangedFilesOnly',
              comment: false,
              paranoid: true
            }
          }
        }).value
      ).toEqual({
        ...guardRailsDefaultConfig,
        report: {
          pullRequest: {
            findings: 'onChangedFilesOnly',
            comment: false,
            paranoid: true
          }
        }
      });
    });

    test('should not return default values', () => {
      const passedConfig = {
        ignore: 'tests/**/*',
        bundles: [
          'javascript',
          {
            rust: ['cargo-audit']
          },
          {
            terraform: ['tfsec']
          },
          {
            typescript: ['tslint']
          },
          {
            java: ['dependency-check', 'spotbugs']
          }
        ],
        report: {
          pullRequest: {
            comment: true,
            findings: 'onAllFiles',
            paranoid: false
          }
        },
        notifications: {
          slack: {
            enabled: false
          }
        }
      };

      expect(configSchema.validate(passedConfig).value).toEqual(passedConfig);
    });

    test('should properly handle retro `report.pullRequest`', () => {
      const passedConfig = {
        bundles: ['javascript', { go: ['someEngine'] }],
        report: {
          pullRequest: 'onChangedFilesOnly'
        },
        notifications: {
          slack: {
            enabled: true,
            webhookUrl: 'https://slack.com/webhookUrl',
            notify: 'whenScanHasFindingsOnly'
          }
        }
      };

      const expectedConfig = {
        bundles: ['javascript', { go: ['someEngine'] }],
        report: {
          pullRequest: {
            findings: 'onChangedFilesOnly',
            comment: true,
            paranoid: false
          }
        },
        notifications: {
          slack: {
            enabled: true,
            webhookUrl: 'https://slack.com/webhookUrl',
            notify: 'whenScanHasFindingsOnly'
          }
        }
      };

      expect(configSchema.validate(passedConfig).value).toEqual(expectedConfig);
    });

    test('should properly handle retro `report.pullRequest` with not string', () => {
      const passedConfig = {
        bundles: ['javascript', { go: ['someEngine'] }],
        report: {
          pullRequest: 123
        },
        notifications: {
          slack: {
            enabled: true,
            webhookUrl: 'https://slack.com/webhookUrl',
            notify: 'whenScanHasFindingsOnly'
          }
        }
      };

      const expectedConfig = {
        bundles: ['javascript', { go: ['someEngine'] }],
        report: {
          pullRequest: {
            findings: 'onChangedFilesOnly',
            comment: true,
            paranoid: false
          }
        },
        notifications: {
          slack: {
            enabled: true,
            webhookUrl: 'https://slack.com/webhookUrl',
            notify: 'whenScanHasFindingsOnly'
          }
        }
      };

      expect(configSchema.validate(passedConfig).value).toEqual(expectedConfig);
    });

    test('should return default excludeBundles on "auto"', () => {
      expect(
        configSchema.validate({
          ...guardRailsDefaultConfig,
          excludeBundles: 'auto'
        }).value
      ).toEqual(guardRailsDefaultConfig);
    });
  });

  describe('ruleOverride validation', () => {
    const { ruleOverrideSchema } = require('../../src/helper/scanConfig');
    it('should properly validate ruleOverride.engineRules', () => {
      const passedConfig = {
        engineRules: {
          'elixir-sobelow': {
            'Config.Secrets': { enable: false, docs: 'https://lolcat.omg/secrets.html' },
            1: { enable: false, docs: 'https://lolcat.omg/secrets.html' },
            'DOS.BinToAtom1': 'empty',
            'DOS.BinToAtom2': true,
            'DOS.BinToAtom3': [],
            'DOS.BinToAtom4': {
              wrongKey: 'whatever'
            }
          }
        }
      };

      const expectedConfig = {
        engineRules: {
          'elixir-sobelow': {
            'Config.Secrets': { enable: false, docs: 'https://lolcat.omg/secrets.html' },
            1: { enable: false, docs: 'https://lolcat.omg/secrets.html' },
            'DOS.BinToAtom1': {},
            'DOS.BinToAtom2': {},
            'DOS.BinToAtom3': {},
            'DOS.BinToAtom4': {}
          }
        },
        GuardRailsRules: {}
      };

      expect(ruleOverrideSchema.validate(passedConfig).value).toEqual(expectedConfig);
    });

    it('should properly validate ruleOverride.GuardRailsRules', () => {
      const passedConfig = {
        GuardRailsRules: {
          GR0012: {
            enable: true,
            title: 'Whatever the company calls it internally',
            languages: { javascript: false, ruby: false }
          },
          unknown: {
            enable: false,
            languages: { javascript: 'true', ruby: {} }
          },
          GR0010: 'empty',
          GR0009: true,
          GR0008: [],
          GR0007: {
            wrongKey: 'whatever'
          }
        }
      };

      const expectedConfig = {
        engineRules: {},
        GuardRailsRules: {
          GR0012: {
            enable: true,
            title: 'Whatever the company calls it internally',
            languages: { javascript: false, ruby: false }
          },
          unknown: {
            enable: false,
            languages: { javascript: true, ruby: true }
          },
          GR0010: {},
          GR0009: {},
          GR0008: {},
          GR0007: {}
        }
      };

      expect(ruleOverrideSchema.validate(passedConfig).value).toEqual(expectedConfig);
    });
  });

  describe('validateConfigYamlFile', () => {
    const {
      guardRailsDefaultConfig,
      validateConfigYamlFile
    } = require('../../src/helper/scanConfig');
    test('should return default config if could not be parsed', () => {
      expect(validateConfigYamlFile('"bundles": "')).toEqual(guardRailsDefaultConfig);
    });

    test('should properly parse YAMl', () => {
      expect(
        validateConfigYamlFile(
          JSON.parse(
            '"bundles: \\n  - javascript\\nreport:\\n  pullRequest: \\n    findings: \\"onAllFiles\\"\\n    comment: true\\nnotifications:\\n  slack:\\n    enabled: true\\n    webhookUrl: http://localhost\\n    notify: onAllScans\\n"'
          )
        )
      ).toEqual({
        bundles: ['javascript'],
        notifications: {
          slack: {
            enabled: true,
            notify: 'onAllScans',
            webhookUrl: 'http://localhost'
          }
        },
        report: {
          pullRequest: {
            findings: 'onAllFiles',
            comment: true
          }
        }
      });
    });
  });

  describe('getConfigForRepository', () => {
    const {
      guardRailsDefaultConfig,
      getConfigForRepository
    } = require('../../src/helper/scanConfig');

    it('should return default config', async () => {
      expect(getConfigForRepository({})).toEqual(guardRailsDefaultConfig);
    });

    it('should properly merge ignoreFile', async () => {
      const configIngore = 'tests/**/*\nconfig';
      const ignoreFileName = 'tests/**/*\n.something';
      const mergedIgnoreFile = 'tests/**/*\nconfig\n.something';
      expect(
        getConfigForRepository(
          { ignoreFileName },
          {
            ...guardRailsDefaultConfig,
            ignore: configIngore
          }
        )
      ).toEqual({ ...guardRailsDefaultConfig, ignore: mergedIgnoreFile });
    });

    it('should return ruleOverride', async () => {
      const ruleOverride = `{
        "engineRules": {
          "elixir-sobelow": {
            "Config.Secrets": { "enable": false, "docs": "https://lolcat.omg/secrets.html" }
          }
        }
      }`;

      const expected = {
        engineRules: {
          'elixir-sobelow': {
            'Config.Secrets': { enable: false, docs: 'https://lolcat.omg/secrets.html' }
          }
        },
        GuardRailsRules: {}
      };

      expect(getConfigForRepository({ ruleOverrideFileName: ruleOverride })).toEqual({
        ...guardRailsDefaultConfig,
        ruleOverride: expected
      });
    });

    describe('configuration scoped', () => {
      it('should ignore yml file if set to true in repo config', () => {
        const globalSettings = {
          ignoreYmlConfig: false,
          report: { pullRequest: { findings: 'onChangedLinesOnly' } }
        };
        const repoSettings = {
          ignoreYmlConfig: true,
          report: { pullRequest: { findings: 'onChangedLinesOnly' } }
        };
        const configFiles = {
          configFileName:
            'report:                                                 \n' +
            '  pullRequest:                                          \n' +
            '    findings:  "onAllFiles"\n' +
            '        \n' +
            '\n'
        };

        const config = getConfigForRepository(configFiles, globalSettings, repoSettings);

        expect(config.report.pullRequest.findings).toEqual('onChangedLinesOnly');
      });

      it('should set bundles only from global if repo bundles are not set in repo settings', () => {
        const globalSettings = { bundles: [{ go: ['nancy', 'gosec'] }] };
        const repoSettings = {};

        const config = getConfigForRepository({}, globalSettings, repoSettings);

        expect(config.bundles).toEqual([{ go: ['nancy', 'gosec'] }]);
      });

      it('should overrides global bundles set to auto by repo bundles', () => {
        const globalSettings = { bundles: 'auto' };
        const repoSettings = { bundles: [{ go: ['nancy', 'gosec'] }] };

        const config = getConfigForRepository({}, globalSettings, repoSettings);

        expect(config.bundles).toEqual([{ go: ['nancy', 'gosec'] }]);
      });

      it('should override global bundles when repo bundles is set to auto', () => {
        const globalSettings = { bundles: [{ go: ['nancy', 'gosec'] }] };
        const repoSettings = { bundles: 'auto' };

        const config = getConfigForRepository({}, globalSettings, repoSettings);

        expect(config.bundles).toEqual('auto');
      });

      it('should overrides global bundles by repo bundles', () => {
        const globalSettings = { bundles: [{ javascript: ['eslint'] }] };
        const repoSettings = { bundles: [{ go: ['nancy', 'gosec'] }] };

        const config = getConfigForRepository({}, globalSettings, repoSettings);

        expect(config.bundles).toEqual([{ go: ['nancy', 'gosec'] }]);
      });

      it('should overrides global and repo bundles by yml bundles if set to auto', () => {
        const globalSettings = { bundles: [{ javascript: ['eslint'] }] };
        const repoSettings = {
          bundles: [{ go: ['kubesec', 'ossecret'] }],
          ignoreYmlConfig: false
        };
        const files = {
          configFileName: 'bundles: auto'
        };

        const config = getConfigForRepository(files, globalSettings, repoSettings);

        expect(config.bundles).toEqual('auto');
      });

      it('should overrides global and repo bundles by yml bundles if set to auto', () => {
        const globalSettings = { bundles: [{ javascript: ['eslint'] }] };
        const repoSettings = {
          bundles: [{ go: ['kubesec', 'ossecret'] }],
          ignoreYmlConfig: false
        };
        const files = {
          configFileName:
            'bundles: \n' +
            '  - go:\n' +
            '    - "gosec"\n' +
            '    - "nancy"      \n' +
            'report:                                                 \n' +
            '  pullRequest:  "onAllFiles"\n' +
            '        \n' +
            '\n'
        };

        const config = getConfigForRepository(files, globalSettings, repoSettings);

        expect(config.bundles).toEqual([{ go: ['gosec', 'nancy'] }]);
      });
      it('should set excludeBundles only from global if repo excludeBundles are not set on repository settings', () => {
        const globalSettings = { excludeBundles: [{ go: ['nancy', 'gosec'] }] };
        const repoSettings = {};

        const config = getConfigForRepository({}, globalSettings, repoSettings);

        expect(config.excludeBundles).toEqual([{ go: ['nancy', 'gosec'] }]);
      });

      it('should overrides global excludeBundles set to auto by repo excludeBundles', () => {
        const globalSettings = { excludeBundles: 'auto' };
        const repoSettings = { excludeBundles: [{ go: ['nancy', 'gosec'] }] };

        const config = getConfigForRepository({}, globalSettings, repoSettings);

        expect(config.excludeBundles).toEqual([{ go: ['nancy', 'gosec'] }]);
      });

      it('should overrides global excludeBundles by repo excludeBundles', () => {
        const globalSettings = { excludeBundles: [{ javascript: ['eslint'] }] };
        const repoSettings = { excludeBundles: [{ go: ['nancy', 'gosec'] }] };

        const config = getConfigForRepository({}, globalSettings, repoSettings);

        expect(config.excludeBundles).toEqual([{ go: ['nancy', 'gosec'] }]);
      });

      it('should not overrides global and repo excludeBundles by yml excludeBundles if set to auto', () => {
        const globalSettings = { excludeBundles: [{ javascript: ['eslint'] }] };
        const repoSettings = {
          excludeBundles: [{ go: ['kubesec', 'ossecret'] }],
          ignoreYmlConfig: false
        };
        const files = {
          configFileName: 'excludeBundles: auto'
        };

        const config = getConfigForRepository(files, globalSettings, repoSettings);

        expect(config.excludeBundles).toEqual([{ go: ['kubesec', 'ossecret'] }]);
      });

      it('should overrides global and repo excludeBundles by yml excludeBundles if set to auto', () => {
        const globalSettings = { excludeBundles: [{ javascript: ['eslint'] }] };
        const repoSettings = {
          excludeBundles: [{ go: ['kubesec', 'ossecret'] }],
          ignoreYmlConfig: false
        };
        const files = {
          configFileName:
            'excludeBundles: \n' +
            '  - go:\n' +
            '    - "gosec"\n' +
            '    - "nancy"      \n' +
            'report:                                                 \n' +
            '  pullRequest:  "onAllFiles"\n' +
            '        \n' +
            '\n'
        };

        const config = getConfigForRepository(files, globalSettings, repoSettings);

        expect(config.excludeBundles).toEqual([{ go: ['gosec', 'nancy'] }]);
      });
    });
  });
});
