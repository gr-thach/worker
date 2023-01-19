const mockGetEngineAccountConfig = jest.fn();
const mockGetEngineRepositoryConfig = jest.fn();
const mockWriteFileSync = jest.fn();
const yaml = require('js-yaml');
const {
  getCustomRulesConfig,
  checkContentFormat,
  generateConfigFolder
} = require('../../src/helper/engineConfig');

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: mockWriteFileSync,
  mkdirSync: jest.fn()
}));
jest.mock('../../src/helper/core-api/engines', () => ({
  getEngineAccountConfig: mockGetEngineAccountConfig
}));

describe('engine config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });
  describe('getCustomRulesConfig', () => {
    test('it returns an account configuration', async () => {
      const engineId = 1;
      const accountId = 1;
      const want = {
        rules: JSON.stringify({ property: 'account' }),
        spec: { filename: 'test.json' }
      };

      mockGetEngineAccountConfig.mockReturnValueOnce({
        rules: JSON.stringify({ property: 'account' }),
        spec: { filename: 'test.json' }
      });
      mockGetEngineRepositoryConfig.mockReturnValueOnce(undefined);

      const got = await getCustomRulesConfig(engineId, accountId);

      expect(got).toEqual(want);
    });

    test('it returns null config and ext if there is no accountConfig', async () => {
      const engineId = 1;
      const accountId = 1;
      const repositoryId = 1;
      mockGetEngineAccountConfig.mockReturnValueOnce(undefined);
      mockGetEngineRepositoryConfig.mockReturnValueOnce(undefined);
      const got = await getCustomRulesConfig(engineId, accountId, repositoryId);
      expect(got).toBeUndefined();
    });
  });

  describe('check config format', () => {
    test('it does not throw if config format and ext corresponds to json', () => {
      const config = `{"test": "ok"}`;
      const ext = 'json';

      expect(() => checkContentFormat(config, ext)).not.toThrow();
    });

    test('it does throw if config format and ext does not correspond to json', () => {
      const config = yaml.dump({ test: 'not_ok' });
      const ext = 'json';

      expect(() => checkContentFormat(config, ext)).toThrow();
    });
    test('it does not throw if config format and ext corresponds to yaml', () => {
      const config = yaml.dump({ test: 'not_ok' });
      const ext = 'yaml';

      expect(() => checkContentFormat(config, ext)).not.toThrow();
    });

    test('it does throw if config format and ext correspond to xml or json but expected yaml', () => {
      const config = `<xml>`;
      const ext = 'yaml';

      expect(() => checkContentFormat(config, ext)).toThrow('content is not yaml');
    });
  });

  describe('generate config folder', () => {
    test('it generates two files, one for rules and one for envVars', async () => {
      const engineName = 'testEngine';
      const language = 'javascript';
      const customConfig = {
        rules: '{"rule1": "there is no rule"}',
        envVars: '{"var1": "value"}',
        spec: { filename: 'test.json' }
      };
      await generateConfigFolder(engineName, language, customConfig);
      expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
    });

    test('it does not write any rules file if ext and content format are incorrect', async () => {
      const engineName = 'testEngine';
      const language = 'javascript';
      const customConfig = {
        rules: '<xml!>nope</xml>',
        spec: { filename: 'test.json' }
      };
      await expect(generateConfigFolder(engineName, language, customConfig)).rejects.toThrow();
      expect(mockWriteFileSync).toHaveBeenCalledTimes(0);
    });
  });
});
