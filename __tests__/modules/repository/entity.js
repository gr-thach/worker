const RepositoryEntity = require('../../../src/modules/repository/entity');

describe('repository v2 entity with normal data', () => {
  const data = [
    {
      idRepository: 10,
      fkAccount: 1,
      name: 'test',
      provider: 'github',
      providerInternalId: '123456',
      badgeToken: 'abcdef',
      isPrivate: true,
      isEnabled: true,
      configuration: { base: 10, a: '10' },
      createdAt: '2022-03-29T07:26:17.832Z',
      updatedAt: '2022-03-29T07:26:17.832Z',
      deletedAt: null,
      defaultBranch: 'master',
      fullName: 'hal2dy/test',
      description: null,
      language: null,
      path: 'railsgoat/lib/tasks',
      fkParentRepository: 8,
      level: 1
    },
    {
      idRepository: 8,
      fkAccount: 1,
      name: 'test',
      provider: 'github',
      providerInternalId: '123456',
      badgeToken: 'abcdef',
      isPrivate: true,
      isEnabled: true,
      configuration: { base: 8, b: '8' },
      createdAt: '2022-03-29T07:26:17.832Z',
      updatedAt: '2022-03-29T07:26:17.832Z',
      deletedAt: null,
      defaultBranch: 'master',
      fullName: 'hal2dy/test',
      description: null,
      language: null,
      path: 'railsgoat/lib',
      fkParentRepository: 7,
      level: 0
    },
    {
      idRepository: 3,
      fkAccount: 1,
      name: 'test',
      provider: 'github',
      providerInternalId: '123456',
      badgeToken: 'abcdef',
      isPrivate: true,
      isEnabled: true,
      configuration: { base: 3, c: '3' },
      createdAt: '2022-03-29T07:26:17.832Z',
      updatedAt: '2022-03-29T07:26:17.832Z',
      deletedAt: null,
      defaultBranch: 'master',
      fullName: 'hal2dy/test',
      description: null,
      language: 'HTML',
      path: null,
      fkParentRepository: null,
      level: -2
    },
    {
      idRepository: 11,
      fkAccount: 1,
      name: 'test',
      provider: 'github',
      providerInternalId: '123456',
      badgeToken: 'abcdef',
      isPrivate: true,
      isEnabled: true,
      configuration: { base: 11, d: '11' },
      createdAt: '2022-06-29T09:47:22.938Z',
      updatedAt: '2022-06-29T09:47:22.938Z',
      deletedAt: null,
      defaultBranch: 'master',
      fullName: 'hal2dy/test',
      description: null,
      language: null,
      path: 'railsgoat/lib/assets',
      fkParentRepository: 8,
      level: 1
    },
    {
      idRepository: 7,
      fkAccount: 1,
      name: 'test',
      provider: 'github',
      providerInternalId: '123456',
      badgeToken: 'abcdef',
      isPrivate: true,
      isEnabled: true,
      configuration: { base: 7, e: '7' },
      createdAt: '2022-03-29T07:26:17.832Z',
      updatedAt: '2022-03-29T07:26:17.832Z',
      deletedAt: null,
      defaultBranch: 'master',
      fullName: 'hal2dy/test',
      description: null,
      language: null,
      path: 'railsgoat',
      fkParentRepository: 3,
      level: -1
    }
  ];

  describe('initialize', () => {
    test('get self', async () => {
      const r = new RepositoryEntity(data);
      const want = {
        idRepository: 8,
        fkAccount: 1,
        name: 'test',
        provider: 'github',
        providerInternalId: '123456',
        badgeToken: 'abcdef',
        isPrivate: true,
        isEnabled: true,
        configuration: { base: 8, b: '8' },
        createdAt: '2022-03-29T07:26:17.832Z',
        updatedAt: '2022-03-29T07:26:17.832Z',
        deletedAt: null,
        defaultBranch: 'master',
        fullName: 'hal2dy/test',
        description: null,
        language: null,
        path: 'railsgoat/lib',
        fkParentRepository: 7,
        level: 0
      };

      expect(r.get()).toEqual(want);
    });

    test('get ancestors', async () => {
      const r = new RepositoryEntity(data);
      const want = [
        {
          idRepository: 3,
          fkAccount: 1,
          name: 'test',
          provider: 'github',
          providerInternalId: '123456',
          badgeToken: 'abcdef',
          isPrivate: true,
          isEnabled: true,
          configuration: { base: 3, c: '3' },
          createdAt: '2022-03-29T07:26:17.832Z',
          updatedAt: '2022-03-29T07:26:17.832Z',
          deletedAt: null,
          defaultBranch: 'master',
          fullName: 'hal2dy/test',
          description: null,
          language: 'HTML',
          path: null,
          fkParentRepository: null,
          level: -2
        },
        {
          idRepository: 7,
          fkAccount: 1,
          name: 'test',
          provider: 'github',
          providerInternalId: '123456',
          badgeToken: 'abcdef',
          isPrivate: true,
          isEnabled: true,
          configuration: { base: 7, e: '7' },
          createdAt: '2022-03-29T07:26:17.832Z',
          updatedAt: '2022-03-29T07:26:17.832Z',
          deletedAt: null,
          defaultBranch: 'master',
          fullName: 'hal2dy/test',
          description: null,
          language: null,
          path: 'railsgoat',
          fkParentRepository: 3,
          level: -1
        }
      ];

      expect(r.getAncestors()).toEqual(want);
    });

    test('get childrent', async () => {
      const r = new RepositoryEntity(data);
      const want = [
        {
          idRepository: 10,
          fkAccount: 1,
          name: 'test',
          provider: 'github',
          providerInternalId: '123456',
          badgeToken: 'abcdef',
          isPrivate: true,
          isEnabled: true,
          configuration: { base: 10, a: '10' },
          createdAt: '2022-03-29T07:26:17.832Z',
          updatedAt: '2022-03-29T07:26:17.832Z',
          deletedAt: null,
          defaultBranch: 'master',
          fullName: 'hal2dy/test',
          description: null,
          language: null,
          path: 'railsgoat/lib/tasks',
          fkParentRepository: 8,
          level: 1
        },
        {
          idRepository: 11,
          fkAccount: 1,
          name: 'test',
          provider: 'github',
          providerInternalId: '123456',
          badgeToken: 'abcdef',
          isPrivate: true,
          isEnabled: true,
          configuration: { base: 11, d: '11' },
          createdAt: '2022-06-29T09:47:22.938Z',
          updatedAt: '2022-06-29T09:47:22.938Z',
          deletedAt: null,
          defaultBranch: 'master',
          fullName: 'hal2dy/test',
          description: null,
          language: null,
          path: 'railsgoat/lib/assets',
          fkParentRepository: 8,
          level: 1
        }
      ];

      expect(r.getChildren()).toEqual(want);
    });

    test('get configs', async () => {
      const r = new RepositoryEntity(data);
      const want = [
        { base: 3, c: '3' },
        { base: 7, e: '7' },
        { base: 8, b: '8' }
      ];

      expect(r.getConfigs()).toEqual(want);
    });

    test('get src path', async () => {
      const r = new RepositoryEntity(data);
      const want = 'railsgoat/lib';

      expect(r.getSourcePath()).toEqual(want);
    });

    test('get excluded path', async () => {
      const r = new RepositoryEntity(data);
      const want = ['railsgoat/lib/tasks', 'railsgoat/lib/assets'];

      expect(r.getExcludePaths()).toEqual(want);
    });
  });
});

describe('repository v2 entity with only self', () => {
  const data = [
    {
      idRepository: 8,
      fkAccount: 1,
      name: 'test',
      provider: 'github',
      providerInternalId: '123456',
      badgeToken: 'abcdef',
      isPrivate: true,
      isEnabled: true,
      configuration: { base: 8, b: '8' },
      createdAt: '2022-03-29T07:26:17.832Z',
      updatedAt: '2022-03-29T07:26:17.832Z',
      deletedAt: null,
      defaultBranch: 'master',
      fullName: 'hal2dy/test',
      description: null,
      language: null,
      path: 'railsgoat/lib',
      fkParentRepository: 7,
      level: 0
    }
  ];

  describe('initialize', () => {
    test('get self', async () => {
      const r = new RepositoryEntity(data);
      const want = {
        idRepository: 8,
        fkAccount: 1,
        name: 'test',
        provider: 'github',
        providerInternalId: '123456',
        badgeToken: 'abcdef',
        isPrivate: true,
        isEnabled: true,
        configuration: { base: 8, b: '8' },
        createdAt: '2022-03-29T07:26:17.832Z',
        updatedAt: '2022-03-29T07:26:17.832Z',
        deletedAt: null,
        defaultBranch: 'master',
        fullName: 'hal2dy/test',
        description: null,
        language: null,
        path: 'railsgoat/lib',
        fkParentRepository: 7,
        level: 0
      };

      expect(r.get()).toEqual(want);
    });

    test('get ancestors', async () => {
      const r = new RepositoryEntity(data);
      const want = [];

      expect(r.getAncestors()).toEqual(want);
    });

    test('get childrent', async () => {
      const r = new RepositoryEntity(data);
      const want = [];

      expect(r.getChildren()).toEqual(want);
    });

    test('get configs', async () => {
      const r = new RepositoryEntity(data);
      const want = [{ base: 8, b: '8' }];

      expect(r.getConfigs()).toEqual(want);
    });

    test('get src path', async () => {
      const r = new RepositoryEntity(data);
      const want = 'railsgoat/lib';

      expect(r.getSourcePath()).toEqual(want);
    });

    test('get excluded path', async () => {
      const r = new RepositoryEntity(data);
      const want = [];

      expect(r.getExcludePaths()).toEqual(want);
    });
  });
});

describe('repository v2 entity without level', () => {
  const data = [
    {
      idRepository: 8,
      fkAccount: 1,
      name: 'test',
      provider: 'github',
      providerInternalId: '123456',
      badgeToken: 'abcdef',
      isPrivate: true,
      isEnabled: true,
      configuration: { base: 8, b: '8' },
      createdAt: '2022-03-29T07:26:17.832Z',
      updatedAt: '2022-03-29T07:26:17.832Z',
      deletedAt: null,
      defaultBranch: 'master',
      fullName: 'hal2dy/test',
      description: null,
      language: null,
      path: 'railsgoat/lib',
      fkParentRepository: 7
    }
  ];

  describe('initialize', () => {
    test('get self', async () => {
      const r = new RepositoryEntity(data);
      const want = {
        idRepository: 8,
        fkAccount: 1,
        name: 'test',
        provider: 'github',
        providerInternalId: '123456',
        badgeToken: 'abcdef',
        isPrivate: true,
        isEnabled: true,
        configuration: { base: 8, b: '8' },
        createdAt: '2022-03-29T07:26:17.832Z',
        updatedAt: '2022-03-29T07:26:17.832Z',
        deletedAt: null,
        defaultBranch: 'master',
        fullName: 'hal2dy/test',
        description: null,
        language: null,
        path: 'railsgoat/lib',
        fkParentRepository: 7
      };

      expect(r.get()).toEqual(want);
    });

    test('get configs', async () => {
      const r = new RepositoryEntity(data);
      const want = [{ base: 8, b: '8' }];

      expect(r.getConfigs()).toEqual(want);
    });

    test('get src path', async () => {
      const r = new RepositoryEntity(data);
      const want = 'railsgoat/lib';

      expect(r.getSourcePath()).toEqual(want);
    });

    test('get excluded path', async () => {
      const r = new RepositoryEntity(data);
      const want = [];

      expect(r.getExcludePaths()).toEqual(want);
    });
  });
});

describe('repository v2 entity with null', () => {
  describe('initialize', () => {
    test('get self', async () => {
      const r = new RepositoryEntity(null);
      const want = null;

      expect(r.get()).toEqual(want);
    });
  });
});

describe('repository v2 entity with empty array', () => {
  describe('initialize', () => {
    test('get self', async () => {
      const r = new RepositoryEntity([]);
      const want = {};

      expect(r.get()).toEqual(want);
    });
  });
});
