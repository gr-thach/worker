const set = require('lodash/set');
const unset = require('lodash/unset');
const { hasLatestPatchedVersions } = require('../../src/helper/common');
const findings = require('../mocks/findings.json');

describe('findings filter helper', () => {
  describe('update patchedVersions', () => {
    let current;
    let existing;

    beforeEach(() => {
      [current, existing] = [...findings];
    });

    afterEach(() => {
      [current, existing] = [...findings];
    });

    test('returns true if finding is not of type sca', () => {
      current.type = 'sast';
      unset(current, 'metadata.patchedVersions');

      const isLatest = hasLatestPatchedVersions(current, existing);

      expect(isLatest).toBeTruthy();
    });

    test('return true if no patchedVersions can be for both current and existing', () => {
      current.type = 'sca';
      unset(current, 'metadata.patchedVersions');
      unset(existing, 'metadata.patchedVersions');

      const isLatest = hasLatestPatchedVersions(current, existing);

      expect(isLatest).toBeTruthy();
    });

    test('return false if current does not have a patchedVersions but exisiting does', () => {
      current.type = 'sca';
      set(existing, 'metadata.patchedVersions', '<1.9.9');
      unset(current, 'metadata.patchedVersions');

      const patchedVersions = hasLatestPatchedVersions(current, existing);

      expect(patchedVersions).toBeFalsy();
    });

    test('return true if current has a patchedVersions but existing is undefined', () => {
      current.type = 'sca';
      set(current, 'metadata.patchedVersions', '<1.0.0');

      const patchedVersions = hasLatestPatchedVersions(current);

      expect(patchedVersions).toBeTruthy();
    });

    test('return true if current has a higher patchedVersions than existing', () => {
      current.type = 'sca';
      set(existing, 'metadata.patchedVersions', '<1.9.9');
      set(current, 'metadata.patchedVersions', '<2.0.1');

      const patchedVersions = hasLatestPatchedVersions(current, existing);

      expect(patchedVersions).toBeTruthy();
    });

    test('return false if current has a lower patchedVersions than existing', () => {
      current.type = 'sca';
      set(existing, 'metadata.patchedVersions', '<2.9.9');
      set(current, 'metadata.patchedVersions', '<2.0.1');

      const patchedVersions = hasLatestPatchedVersions(current, existing);

      expect(patchedVersions).toBeFalsy();
    });

    test('return true if current has a higher patchedVersions range than existing', () => {
      current.type = 'sca';
      set(existing, 'metadata.patchedVersions', '>=8.5.1 <9.0.0 || >9.0.2');
      set(current, 'metadata.patchedVersions', '>=8.5.1 <9.0.0 || >=9.0.3');

      const patchedVersions = hasLatestPatchedVersions(current, existing);

      expect(patchedVersions).toBeTruthy();
    });

    test('return true if current has a lower patchedVersions range than existing', () => {
      current.type = 'sca';
      set(existing, 'metadata.patchedVersions', '>=8.5.1 <9.0.0 || >=9.0.3');
      set(current, 'metadata.patchedVersions', '>=8.5.1 <9.0.0 || >9.0.2');

      const patchedVersions = hasLatestPatchedVersions(current, existing);

      expect(patchedVersions).toBeFalsy();
    });

    test('return true if patchedVersions is null for both', () => {
      current.type = 'sca';
      set(existing, 'metadata.patchedVersions', null);
      set(current, 'metadata.patchedVersions', 'null');

      const patchedVersions = hasLatestPatchedVersions(current, existing);

      expect(patchedVersions).toBeTruthy();
    });

    test('return true with complex patchedVersions', () => {
      current.type = 'sca';
      set(
        existing,
        'metadata.patchedVersions',
        '>= 5.0.0.beta1.1, ~> 4.2.5, >= 4.2.5.1, ~> 4.1.14, >= 4.1.14.1, ~> 3.2.22.1'
      );
      set(current, 'metadata.patchedVersions', '~> 3.2.20, ~> 4.0.11, ~> 4.1.7, >= 4.2.0.beta3');

      const patchedVersions = hasLatestPatchedVersions(current, existing);

      expect(patchedVersions).toBeFalsy();
    });

    test('return true with complex beta patchedVersions', () => {
      current.type = 'sca';
      set(existing, 'metadata.patchedVersions', '>= 5.0.0.beta1.1, ~> 4.2.5');
      set(current, 'metadata.patchedVersions', '~> 5.0.0.beta1.2');

      const patchedVersions = hasLatestPatchedVersions(current, existing);

      expect(patchedVersions).toBeTruthy();
    });

    test('return true with comma patchedVersions', () => {
      current.type = 'sca';
      set(existing, 'metadata.patchedVersions', '<0.0.0');
      set(current, 'metadata.patchedVersions', '6.20.14,7.30.4,8.24.0,6.20.14,7.30.4,8.24.0');

      const patchedVersions = hasLatestPatchedVersions(current, existing);

      expect(patchedVersions).toBeTruthy();
    });

    test('return false with comma patchedVersions', () => {
      current.type = 'sca';
      set(existing, 'metadata.patchedVersions', '>8.24.1');
      set(current, 'metadata.patchedVersions', '6.20.14,7.30.4,8.24.0,6.20.14,7.30.4,8.24.0');

      const patchedVersions = hasLatestPatchedVersions(current, existing);

      expect(patchedVersions).toBeFalsy();
    });
  });
});
