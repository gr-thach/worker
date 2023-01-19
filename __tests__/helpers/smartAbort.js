const { checkForAbort, analyzeDiffContent } = require('../../src/helper/smartAbort');

describe('smart abort', () => {
  it('should return defaults', () => {
    expect(checkForAbort(undefined)).toEqual({
      abortOnDiff: false,
      librariesManagerFiles: [],
      changedFiles: []
    });
  });

  it('should return abortOnDiff=true for ignored files', () => {
    const diff = `--- /dev/null
+++ b/something.ape
@@ -0,0 +1,9 @@
+some text
`;
    expect(checkForAbort(diff)).toEqual({
      abortOnDiff: true,
      librariesManagerFiles: [],
      changedFiles: []
    });
  });

  it('should return abortOnDiff=false', () => {
    const diff = `--- /dev/null
+++ b/src/something.js
@@ -0,0 +1,9 @@
+some text
`;
    expect(checkForAbort(diff)).toEqual({
      abortOnDiff: false,
      librariesManagerFiles: [],
      changedFiles: ['src/something.js']
    });
  });
});

describe('analyze diff content for smart abort', () => {
  it('should ignore all changed result', () => {
    const diffs = [
      {
        from: 'ignore.aac',
        to: 'new.wav'
      },
      {
        from: 'file4',
        to: 'ignore.mp3'
      }
    ];
    const expected = {
      librariesManagerFiles: [],
      changedFiles: []
    };
    const actual = analyzeDiffContent(diffs);
    expect(actual).toEqual(expected);
  });

  it('should return correct changed result', () => {
    const diffs = [
      {
        from: 'file1',
        to: 'file2'
      },
      {
        from: 'file5',
        to: 'package.json'
      },
      {
        from: 'composer.lock',
        to: 'file6'
      },
      {
        from: 'go.mod',
        to: 'Gopck.lock'
      }
    ];
    const expected = {
      changedFiles: ['file2', 'package.json', 'file6', 'Gopck.lock'],
      librariesManagerFiles: ['composer.lock', 'go.mod']
    };
    const actual = analyzeDiffContent(diffs);
    expect(actual).toEqual(expected);
  });
});
