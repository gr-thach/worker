jest.mock('../../src/helper/fs', () => ({
  ...jest.requireActual('../../src/helper/fs'),
  getSubDir: jest.fn()
}));

const { getSubDir } = require('../../src/helper/fs');
const {
  buildRepoConfig,
  getRepoConfig,
  makeEngineRunRepoConfigs
} = require('../../src/helper/engineConfig');

beforeEach(async () => {
  jest.resetAllMocks();
  getSubDir.mockReturnValue(['mock1', 'mock2', 'mock3']);
});

describe('repoConfig helper', () => {
  it('build config correctly', () => {
    const config = {
      ignore: '',
      bundles: 'auto',
      report: {
        pullRequest: { findings: 'onAllFiles', comment: true, paranoid: false }
      },
      notifications: { slack: { enabled: false } },
      useGitClone: false,
      excludeBundles: [],
      monorepo: [
        '/DeleteMe',
        { '/railsgoat': { bundles: 'auto' } },
        { '/railsgoat/app/*': { bundles: [{ java: ['spotbugs'] }] } }
      ]
    };

    const expected = [
      {
        name: '',
        fullpath: '',
        config: {
          bundles: 'auto',
          excludeBundles: [],
          ignore: [],
          notifications: {
            slack: {
              enabled: false
            }
          },
          report: {
            pullRequest: {
              comment: true,
              findings: 'onAllFiles',
              paranoid: false
            }
          },
          ruleOverride: undefined
        },
        children: { DeleteMe: [], railsgoat: [] }
      },
      {
        name: 'DeleteMe',
        fullpath: 'DeleteMe/',
        config: {
          bundles: 'auto',
          excludeBundles: [],
          ignore: [],
          notifications: {
            slack: {
              enabled: false
            }
          },
          report: {
            pullRequest: {
              comment: true,
              findings: 'onAllFiles',
              paranoid: false
            }
          },
          ruleOverride: undefined
        },
        children: {}
      },
      {
        name: 'railsgoat',
        fullpath: 'railsgoat/',
        config: {
          bundles: 'auto',
          excludeBundles: [],
          ignore: [],
          notifications: {
            slack: {
              enabled: false
            }
          },
          report: {
            pullRequest: {
              comment: true,
              findings: 'onAllFiles',
              paranoid: false
            }
          },
          ruleOverride: undefined
        },
        children: { app: [] }
      },
      {
        name: 'app',
        fullpath: 'railsgoat/app/',
        config: undefined,
        children: { '*': [] }
      },
      {
        name: '*',
        fullpath: 'railsgoat/app/*/',
        config: {
          bundles: [{ java: ['spotbugs'] }],
          excludeBundles: [],
          ignore: [],
          notifications: {
            slack: {
              enabled: false
            }
          },
          report: {
            pullRequest: {
              comment: true,
              findings: 'onAllFiles',
              paranoid: false
            }
          },
          ruleOverride: undefined
        },
        children: {}
      }
    ];

    const configs = buildRepoConfig(config);
    const actual = getRepoConfig(configs);

    for (let i = 0; i < expected.length; i += 1) {
      expect(actual[i].name).toEqual(expected[i].name);
      expect(actual[i].fullpath).toEqual(expected[i].fullpath);
      expect(actual[i].config).toEqual(expected[i].config);
      expect(Object.keys(actual[i].children)).toEqual(Object.keys(expected[i].children));
    }
  });

  it('makeEngineRunRepoConfigs config correctly', () => {
    const config = {
      ignore: '',
      bundles: 'auto',
      report: {
        pullRequest: { findings: 'onAllFiles', comment: true, paranoid: false }
      },
      notifications: { slack: { enabled: false } },
      useGitClone: false,
      excludeBundles: [],
      monorepo: [
        { '/railsgoat/app/*': { bundles: [{ java: ['spotbugs'] }] } },
        '/DeleteMe',
        { '/railsgoat': { bundles: 'auto' } }
      ]
    };

    const expected = [
      {
        path: '',
        excluded: ['railsgoat/', 'DeleteMe/'],
        index: 0,
        config: {
          bundles: 'auto',
          excludeBundles: [],
          ignore: [],
          notifications: {
            slack: {
              enabled: false
            }
          },
          report: {
            pullRequest: {
              comment: true,
              findings: 'onAllFiles',
              paranoid: false
            }
          },
          ruleOverride: undefined
        }
      },
      {
        path: 'DeleteMe/',
        excluded: [],
        index: 1,
        config: {
          bundles: 'auto',
          excludeBundles: [],
          ignore: [],
          notifications: {
            slack: {
              enabled: false
            }
          },
          report: {
            pullRequest: {
              comment: true,
              findings: 'onAllFiles',
              paranoid: false
            }
          },
          ruleOverride: undefined
        }
      },
      {
        path: 'railsgoat/',
        excluded: ['railsgoat/app/mock3/', 'railsgoat/app/mock2/', 'railsgoat/app/mock1/'],
        index: 2,
        config: {
          bundles: 'auto',
          excludeBundles: [],
          ignore: [],
          notifications: {
            slack: {
              enabled: false
            }
          },
          report: {
            pullRequest: {
              comment: true,
              findings: 'onAllFiles',
              paranoid: false
            }
          },
          ruleOverride: undefined
        }
      }
    ];

    const configs = buildRepoConfig(config);
    const diffs = [
      '.guardrails/config.yml',
      'root.yaml',
      'railsgoat/file1.txt',
      'DeleteMe/file2.txt',
      'DeleteMe/app/a/file3.txt',
      'DeleteMe/app/b/file4.txt'
    ];

    const actual = makeEngineRunRepoConfigs(configs, diffs);

    expect(actual).toEqual(expected);
  });
});
