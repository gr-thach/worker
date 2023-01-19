const { truncateString, asString } = require('../../src/helper/string');

describe('common', () => {
  describe('asString', () => {
    it('should transform object to string', async () => {
      const str = asString({ name: 'john doe' });
      expect(str).toEqual('{"name":"john doe"}');
    });
    it('should transform array to string', async () => {
      const str = asString([{ name: 'john doe' }]);
      expect(str).toEqual('[{"name":"john doe"}]');
    });
    it('should not transform undefined to string', async () => {
      const str = asString(undefined);
      expect(str).toEqual(undefined);
    });
    it('should not transform null to string', async () => {
      const str = asString(undefined);
      expect(str).toEqual(undefined);
    });
    it('should not escape an existing string', async () => {
      const str = asString('john doe');
      expect(str).toEqual('john doe');
    });
    it('should transform number to string', async () => {
      const str = asString(3);
      expect(str).toEqual('3');
    });
  });

  describe('truncateString', () => {
    it('should truncate a string that is longer than max length', async () => {
      const str = truncateString('john doe', 4);
      expect(str).toEqual('john...');
    });

    it('should not truncate a string that is shorter than max length', async () => {
      const str = truncateString('john doe', 8);
      expect(str).toEqual('john doe');
    });

    it('should throw error if max length is negative', async () => {
      expect.assertions(1);

      try {
        truncateString('john doe', -1);
      } catch (e) {
        expect(e.message).toEqual('Expected max length to be a positive number, got -1.');
      }
    });

    it('should handle empty string', async () => {
      const str = truncateString('', 0);
      expect(str).toEqual('');
    });

    it('should not throw error when passing in undefined', async () => {
      const str = truncateString(undefined, 8);
      expect(str).toEqual(undefined);
    });

    it('should not throw error when passing in null', async () => {
      const str = truncateString(null, 8);
      expect(str).toEqual(null);
    });

    it('should not throw error when passing in object', async () => {
      const str = truncateString({}, 8);
      expect(str).toEqual({});
    });
  });
});
