const { getFindingStatus } = require('../../src/helper/findingStatus');
const findingSast = require('../mocks/findingSast.json');

const VULNERABILITY = 'VULNERABILITY';

describe('findings status helper for SAST finding', () => {
  let finding;
  let action;
  let isVulnerability;

  beforeEach(() => {
    isVulnerability = true;

    finding = copy(findingSast);

    action = {
      idAction: 1,
      action: 'WONT_FIX',
      fkAccount: 999,
      fkRepository: 2,
      fkRule: finding.fkRule,
      path: finding.path,
      lineContent: finding.lineContent
    };
  });

  const copy = obj => JSON.parse(JSON.stringify(obj));

  describe('action finding status', () => {
    xit('updates the status if the action corresponds to an existing finding (with existing status)', () => {
      const existingStatus = 'MARK_AS_FIXED';
      const status = getFindingStatus(isVulnerability, [action], finding, existingStatus);

      expect(status).toEqual(action.action.toUpperCase());
    });

    xit('updates the status if the action corresponds to a newly introduced finding (with no existing status)', () => {
      const existingStatus = null;
      const status = getFindingStatus(isVulnerability, [action], finding, existingStatus);

      expect(status).toEqual(action.action.toUpperCase());
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

      expect(status).toEqual(action.action.toUpperCase());
      expect(status).not.toEqual(VULNERABILITY);
    });

    xit('updates the finding status if line content only has changes in leading spaces', () => {
      finding.lineContent = `    ${finding.lineContent}`;

      const status = getFindingStatus(isVulnerability, [action], finding);

      expect(status).toEqual(action.action.toUpperCase());
      expect(status).not.toEqual(VULNERABILITY);
    });

    xit('updates the finding status if line content only has changes in trailing spaces', () => {
      finding.lineContent = `${finding.lineContent}      `;

      const status = getFindingStatus(isVulnerability, [action], finding);

      expect(status).toEqual(action.action.toUpperCase());
      expect(status).not.toEqual(VULNERABILITY);
    });

    xit('does not update a finding status if action has different line content', () => {
      action.lineContent = 'return Pattern.compile(pattern)';

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

      expect(status).toEqual(action.action.toUpperCase());
    });

    xit('set the status to null if no action and finding is not a vulnerability', () => {
      const isNotVulnerability = false;

      action.fkRule = finding.fkRule + 2;

      const status = getFindingStatus(isNotVulnerability, [action], finding);

      expect(status).toBeNull();
    });
  });

  describe('existing finding status', () => {
    xit('update status to vulnerability if finding was fixed', () => {
      const existingStatus = 'fixed';

      const status = getFindingStatus(isVulnerability, [], finding, existingStatus);

      expect(status).toEqual('VULNERABILITY');
    });

    xit('update status to vulnerability if finding was mark_as_fixed', () => {
      const existingStatus = 'mark_as_fixed';

      const status = getFindingStatus(isVulnerability, [], finding, existingStatus);

      expect(status).toEqual('VULNERABILITY');
    });

    xit('update status to vulnerability if finding was wont_fix', () => {
      const existingStatus = 'wont_fix';

      const status = getFindingStatus(isVulnerability, [], finding, existingStatus);

      expect(status).toEqual('VULNERABILITY');
    });

    xit('update status to vulnerability if finding was mark_as_vulnerability', () => {
      const existingStatus = 'mark_as_vulnerability';

      const status = getFindingStatus(isVulnerability, [], finding, existingStatus);

      expect(status).toEqual('VULNERABILITY');
    });

    xit('update status to fixed if finding is not a vulnerability with status of vulnerability', () => {
      const existingStatus = 'vulnerability';
      const isNotVulnerability = false;

      const status = getFindingStatus(isNotVulnerability, [], finding, existingStatus);

      expect(status).toEqual('FIXED');
    });

    xit('update status to fixed if finding is not a vulnerability with status of mark_as_vulnerability', () => {
      const existingStatus = 'mark_as_vulnerability';
      const isNotVulnerability = false;

      const status = getFindingStatus(isNotVulnerability, [], finding, existingStatus);

      expect(status).toEqual('FIXED');
    });

    xit('does not update status to vulnerability if finding is fixed', () => {
      const existingStatus = 'fixed';
      action.action = 'MARK_AS_VULNERABILITY';
      const isNotVulnerability = false;
      const status = getFindingStatus(isNotVulnerability, [action], finding, existingStatus);

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
