const { getFindingStatus } = require('../../src/helper/findingStatus');
const findingSca = require('../mocks/findingSca.json');

const VULNERABILITY = 'VULNERABILITY';

describe('findings status helper for SCA finding', () => {
  let finding;
  let action;
  let isVulnerability;

  beforeEach(() => {
    isVulnerability = true;

    finding = copy(findingSca);

    action = {
      idAction: 1,
      action: 'WONT_FIX',
      fkAccount: 999,
      fkRepository: 2,
      fkRule: finding.fkRule,
      path: finding.path,
      dependencyName: finding.metadata.dependencyName,
      dependencyVersion: finding.metadata.currentVersion,
      transitiveDependency: finding.lineNumber === 0
    };
  });

  const copy = obj => JSON.parse(JSON.stringify(obj));

  describe('action finding status', () => {
    xit('updates the status if the action corresponds to an existing finding (with existing status)', () => {
      const status = getFindingStatus(isVulnerability, [action], finding, finding.status);

      expect(status).toEqual(action.action);
    });

    xit('updates the status if the action corresponds to a newly introduced finding (with no existing status)', () => {
      const status = getFindingStatus(isVulnerability, [action], finding, null);

      expect(status).toEqual(action.action);
    });

    xit('does not update a finding status if there is no corresponding action', () => {
      const status = getFindingStatus(isVulnerability, [], finding);

      expect(status).not.toEqual(action.action);
      expect(status).toEqual(VULNERABILITY);
    });

    xit('does not update a finding status if action has different path', () => {
      action.path = 'a/different/path';

      const status = getFindingStatus(isVulnerability, [action], finding);

      expect(status).not.toEqual(action.action);
      expect(status).toEqual(VULNERABILITY);
    });

    xit('updates the finding status if action has different lineNumber', () => {
      action.lineNumber = finding.lineNumber + 1;

      const status = getFindingStatus(isVulnerability, [action], finding);

      expect(status).toEqual(action.action);
      expect(status).not.toEqual(VULNERABILITY);
    });

    xit('does not update a finding status if action is for direct dependency but finding is a transient dependency', () => {
      finding.lineNumber = 0; // 0 is a transient dependency
      action.lineNumber = 10; // > 0 is a direct dependency
      action.transitiveDependency = false;

      const status = getFindingStatus(isVulnerability, [action], finding);

      expect(status).not.toEqual(action.action);
      expect(status).toEqual(VULNERABILITY);
    });

    xit('does not update a finding status if action is for transient dependency but finding is a direct dependency', () => {
      finding.lineNumber = 10; // > 0 is a direct dependency
      action.lineNumber = 0; // 0 is a transient dependency
      action.transitiveDependency = true;

      const status = getFindingStatus(isVulnerability, [action], finding);

      expect(status).not.toEqual(action.action);
      expect(status).toEqual(VULNERABILITY);
    });

    xit('does not update a finding status if action has different dependency name', () => {
      action.dependencyName = 'amqp';

      const status = getFindingStatus(isVulnerability, [action], finding);

      expect(status).not.toEqual(action.action);
      expect(status).toEqual(VULNERABILITY);
    });

    xit('does not update a finding status if action has different dependency version', () => {
      action.dependencyVersion = '0.0.1';

      const status = getFindingStatus(isVulnerability, [action], finding);

      expect(status).not.toEqual(action.action);
      expect(status).toEqual(VULNERABILITY);
    });

    xit('does not update a finding status if action has different fkRule', () => {
      action.fkRule = finding.fkRule + 1;

      const status = getFindingStatus(isVulnerability, [action], finding);

      expect(status).not.toEqual(action.action);
      expect(status).toEqual(VULNERABILITY);
    });

    xit('set status to corresponding action when finding is not a vulnerability', () => {
      const isNotVulnerability = false;

      const status = getFindingStatus(isNotVulnerability, [action], finding);

      expect(status).toEqual(action.action);
    });

    xit('set the status to null if no action and finding is not a vulnerability', () => {
      const isNotVulnerability = false;

      action.fkRule = finding.fkRule + 2;

      const status = getFindingStatus(isNotVulnerability, [action], finding);

      expect(status).toBeNull();
    });

    xit('does not update status to vulnerability if finding is fixed', () => {
      const existingStatus = 'fixed';
      action.action = 'MARK_AS_VULNERABILITY';
      const isNotVulnerability = false;
      const status = getFindingStatus(isNotVulnerability, [action], finding, existingStatus);

      expect(status).toEqual('FIXED');
    });
  });

  describe('existing finding status', () => {
    xit('update status to vulnerability if finding was fixed', () => {
      finding.status = 'fixed';

      const status = getFindingStatus(isVulnerability, [], finding, finding.status);

      expect(status).toEqual('VULNERABILITY');
    });

    xit('update status to vulnerability if finding was mark_as_fixed', () => {
      finding.status = 'mark_as_fixed';

      const status = getFindingStatus(isVulnerability, [], finding, finding.status);

      expect(status).toEqual('VULNERABILITY');
    });

    xit('update status to vulnerability if finding was wont_fix', () => {
      finding.status = 'wont_fix';

      const status = getFindingStatus(isVulnerability, [], finding, finding.status);

      expect(status).toEqual('VULNERABILITY');
    });

    xit('update status to vulnerability if finding was mark_as_vulnerability', () => {
      finding.status = 'mark_as_vulnerability';

      const status = getFindingStatus(isVulnerability, [], finding, finding.status);

      expect(status).toEqual('VULNERABILITY');
    });

    xit('update status to fixed if finding is not a vulnerability with status of vulnerability', () => {
      finding.status = 'vulnerability';
      const isNotVulnerability = false;

      const status = getFindingStatus(isNotVulnerability, [], finding, finding.status);

      expect(status).toEqual('FIXED');
    });

    xit('update status to fixed if finding is not a vulnerability with status of mark_as_vulnerability', () => {
      finding.status = 'mark_as_vulnerability';
      const isNotVulnerability = false;

      const status = getFindingStatus(isNotVulnerability, [], finding, finding.status);

      expect(status).toEqual('FIXED');
    });
  });

  describe('newly introduced finding status', () => {
    xit('set status to vulnerability if finding is vulnerability', () => {
      const status = getFindingStatus(isVulnerability, [], finding);

      expect(status).toEqual('VULNERABILITY');
    });

    xit('set status to null if finding is not vulnerability', () => {
      const isNotVulnerability = false;

      const status = getFindingStatus(isNotVulnerability, [], finding);

      expect(status).toBeNull();
    });
  });
});
