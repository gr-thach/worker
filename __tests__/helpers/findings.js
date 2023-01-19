const { modifyAllFindingWithFileRenameDiffs } = require('../../src/helper/findings');
const { compareFinding } = require('../../src/helper/generateFindings/utils');
const softMatching = require('../../src/helper/generateFindings/softMatching');

describe('findings compare function', () => {
  test('special case for sca with zero lineNumber should return true', () => {
    const a = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: 0,
      type: 'sca',
      metadata: { dependencyName: 'pkg:golang/golang.org/x/crypto@0.0.1', currentVersion: '1.0.0' }
    };
    const b = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: 0,
      type: 'sca',
      metadata: { dependencyName: 'pkg:golang/golang.org/x/crypto@0.0.1', currentVersion: '1.0.0' }
    };
    const c = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: 0,
      type: 'sca',
      metadata: { dependencyName: 'pkg:golang/golang.org/x/crypto@0.0.1', currentVersion: '1.0.1' }
    };
    const d = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: 0,
      type: 'sca',
      metadata: { dependencyName: 'pkg:golang/golang.org/x/crypto@0.0.2', currentVersion: '1.0.0' }
    };
    expect(compareFinding(a, b)).toEqual(true);
    expect(compareFinding(a, c)).toEqual(false);
    expect(compareFinding(a, d)).toEqual(false);
  });

  test('special case for sca with zero lineNumber and no metadata', () => {
    const a = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: -2,
      type: 'sca',
      metadata: { dependencyName: 'pkg:golang/golang.org/x/crypto@0.0.1' }
    };
    const b = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: -3,
      type: 'sca',
      metadata: undefined
    };
    const c = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: -2,
      type: 'sca',
      metadata: undefined
    };
    expect(compareFinding(a, b)).toEqual(false);
    expect(compareFinding(c, b)).toEqual(true);
  });

  test('type not sca should use compare use lineNumber and linecontent', () => {
    const a = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: 1,
      lineContent: 'x',
      type: 'sca',
      metadata: { dependencyName: 'pkg:golang/golang.org/x/crypto@0.0.1' }
    };
    const b = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: 2,
      lineContent: 'x',
      type: 'sast',
      metadata: { dependencyName: 'pkg:golang/golang.org/x/crypto@0.0.1' }
    };
    const c = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: 1,
      lineContent: 'y',
      type: 'sast',
      metadata: { dependencyName: 'pkg:golang/golang.org/x/crypto@0.0.1' }
    };
    const d = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: 1,
      lineContent: 'y',
      type: 'sast',
      metadata: { dependencyName: 'pkg:golang/golang.org/x/crypto@0.0.2' }
    };
    expect(compareFinding(a, b)).toEqual(false);
    expect(compareFinding(a, c)).toEqual(false);
    expect(compareFinding(c, d)).toEqual(true);
  });

  test('should work with undefined obj', () => {
    const a = undefined;
    const b = undefined;
    const c = null;
    const d = {
      path: undefined,
      fkEngineRule: undefined,
      lineNumber: undefined,
      type: undefined,
      metadata: undefined
    };
    expect(compareFinding(a, b)).toEqual(true);
    expect(compareFinding(c, b)).toEqual(true);
    expect(compareFinding(d, b)).toEqual(true);
  });

  test('should work with line content unhashed coincidence for findings of secret type', () => {
    const a = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: 0,
      type: 'secret',
      lineContent: 'a'
    };
    const b = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: 3,
      type: 'sca',
      lineContent: 'b',
      metadata: { dependencyName: 'x', currentVersion: '1.2' }
    };
    const c = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: 3,
      type: 'sca',
      lineContent: 'c',
      metadata: { dependencyName: 'x', currentVersion: '1.2' }
    };
    const d = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: 0,
      type: 'secret',
      lineContent: 'a'
    };

    expect(compareFinding(a, b)).toEqual(false);
    expect(compareFinding(b, c)).toEqual(true);
    expect(compareFinding(c, d)).toEqual(false);
    expect(compareFinding(a, d)).toEqual(true);
  });

  test('should not work with line content unhashed coincidence for findings of type not secret', () => {
    const a = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: 0,
      type: 'sast',
      lineContent: 'a'
    };
    const b = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: 0,
      type: 'sast',
      lineContent: 'b',
      lineContentUnhashed: 'a'
    };
    const c = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: 0,
      type: 'sast',
      lineContent: 'c',
      lineContentUnhashed: 'a'
    };
    const d = {
      path: '/use/tmp/test.go',
      fkEngineRule: 1,
      lineNumber: 0,
      type: 'sast',
      lineContent: 'a',
      lineContentUnhashed: 'd'
    };
    expect(compareFinding(a, b)).toEqual(false);
    expect(compareFinding(b, c)).toEqual(false);
    expect(compareFinding(c, d)).toEqual(false);
    expect(compareFinding(a, d)).toEqual(true); // true only when lineContent are the same
  });
});

describe('soft matching', () => {
  let allFindings;
  beforeEach(() => {
    allFindings = [
      {
        id: 1,
        type: 'sast',
        path: 'test/file1',
        metadata: {},
        lineNumber: 1,
        lineContent: 'file1 line1',
        fkEngineRule: 2
      },
      {
        id: 2,
        type: 'sca',
        path: 'test/file2',
        metadata: {
          dependencyName: 'dep',
          currentVersion: '1.2.3'
        },
        lineNumber: 1,
        lineContent: 'file2 line1',
        fkEngineRule: 2
      },
      {
        id: 3,
        type: 'sast',
        path: 'test/file3',
        metadata: {},
        lineNumber: 20,
        lineContent: 'file1 line3',
        fkEngineRule: 3
      }
    ];
  });

  test('full matching should work', () => {
    const findingRef = {
      type: 'sast',
      path: 'test/file1',
      metadata: {},
      lineNumber: 1,
      lineContent: ' file1 line1',
      fkEngineRule: 2
    };
    const expected = {
      id: 1,
      type: 'sast',
      path: 'test/file1',
      metadata: {},
      lineNumber: 1,
      lineContent: 'file1 line1',
      fkEngineRule: 2
    };
    const actual = softMatching(allFindings, findingRef);
    expect(actual).toEqual(expected);
  });

  test('line number matching with diff should work', () => {
    const diffs = [
      {
        chunks: [
          {
            content: '@@ -0 +1,0 @@',
            changes: [
              { type: 'add', add: true, ln: 1, content: 'something 1' },
              { type: 'add', add: true, ln: 2, content: 'something 2' },
              { type: 'add', add: true, ln: 3, content: 'something 3' },
              { type: 'add', add: true, ln: 4, content: 'something 4' },
              { type: 'add', add: true, ln: 5, content: 'something 5' },
              { type: 'add', add: true, ln: 7, content: 'this should ignore' }
            ],
            oldStart: 1,
            oldLines: 0,
            newStart: 0,
            newLines: 0
          }
        ],
        deletions: 0,
        additions: 1,
        from: 'test/file1',
        to: 'test/file1',
        index: ['587be6b..0000000']
      }
    ];
    const findingRef = {
      type: 'sast',
      path: 'test/file1',
      metadata: {},
      lineNumber: 6,
      lineContent: 'file1 line1',
      fkEngineRule: 2
    };
    const expected = {
      id: 1,
      type: 'sast',
      path: 'test/file1',
      metadata: {},
      lineNumber: 6,
      lineContent: 'file1 line1',
      fkEngineRule: 2
    };
    const actual = softMatching(allFindings, findingRef, diffs);
    expect(actual).toEqual(expected);
  });

  test('line number matching with changed line add count should work', () => {
    const diffs = [
      {
        chunks: [
          {
            content: '@@ -1 +5,0 @@',
            changes: [
              { type: 'add', add: true, ln: 1, content: '+' },
              { type: 'add', add: true, ln: 2, content: '+' },
              { type: 'del', del: true, ln: 4, content: '-' },
              { type: 'add', add: true, ln: 8, content: '+' },
              { type: 'add', add: true, ln: 9, content: '+' },
              { type: 'add', add: true, ln: 10, content: '+' }
            ],
            oldStart: 1,
            oldLines: 0,
            newStart: 0,
            newLines: 0
          }
        ],
        deletions: 0,
        additions: 5,
        from: 'test/file3',
        to: 'test/file3',
        index: ['587be6b..0000000']
      }
    ];
    const findingRef = {
      type: 'sast',
      path: 'test/file3',
      metadata: {},
      lineNumber: 24,
      lineContent: 'file1 line3',
      fkEngineRule: 3
    };
    const expected = {
      id: 3,
      type: 'sast',
      path: 'test/file3',
      metadata: {},
      lineNumber: 24,
      lineContent: 'file1 line3',
      fkEngineRule: 3
    };
    const actual = softMatching(allFindings, findingRef, diffs);
    expect(actual).toEqual(expected);
  });

  test('line number matching with changed line remove count should work', () => {
    const diffs = [
      {
        chunks: [
          {
            content: '@@ -1 +5,0 @@',
            changes: [
              { type: 'del', del: true, ln: 10, content: '-' },
              { type: 'del', del: true, ln: 18, content: '-' },
              { type: 'add', add: true, ln: 18, content: '+' },
              { type: 'del', del: true, ln: 19, content: '-' },
              { type: 'del', del: true, ln: 20, content: '-' },
              { type: 'del', del: true, ln: 21, content: ' should ignore' }
            ],
            oldStart: 1,
            oldLines: 0,
            newStart: 0,
            newLines: 0
          }
        ],
        deletions: 0,
        additions: 5,
        from: 'test/file3',
        to: 'test/file3',
        index: ['587be6b..0000000']
      }
    ];
    const findingRef = {
      type: 'sast',
      path: 'test/file3',
      metadata: {},
      lineNumber: 17,
      lineContent: 'file1 line3',
      fkEngineRule: 3
    };
    const expected = {
      id: 3,
      type: 'sast',
      path: 'test/file3',
      metadata: {},
      lineNumber: 17,
      lineContent: 'file1 line3',
      fkEngineRule: 3
    };
    const actual = softMatching(allFindings, findingRef, diffs);
    expect(actual).toEqual(expected);
  });

  test('line number matching but can not verify should work', () => {
    const diffs = [
      {
        chunks: [
          {
            content: '@@ -0 +1,0 @@',
            changes: [
              {
                type: 'normal',
                normal: true,
                ln1: 2,
                ln2: 6,
                content: 'hello'
              }
            ],
            oldStart: 1,
            oldLines: 0,
            newStart: 0,
            newLines: 0
          }
        ],
        deletions: 0,
        additions: 1,
        from: 'test/file1',
        to: 'test/file1',
        index: ['587be6b..0000000']
      }
    ];
    const findingRef = {
      type: 'sast',
      path: 'test/file1',
      metadata: {},
      lineNumber: 6,
      lineContent: 'file1 line1',
      fkEngineRule: 2
    };
    const actual = softMatching(allFindings, findingRef, diffs);
    expect(actual).toEqual(undefined);
  });

  test('line content matching should work', () => {
    const findingRef = {
      type: 'sast',
      path: 'test/file1',
      metadata: {},
      lineNumber: 1,
      lineContent: 'file2 line1 - something new',
      fkEngineRule: 2
    };
    const expected = {
      id: 1,
      type: 'sast',
      path: 'test/file1',
      metadata: {},
      lineNumber: 1,
      lineContent: 'file2 line1 - something new',
      fkEngineRule: 2
    };
    const actual = softMatching(allFindings, findingRef);
    expect(actual).toEqual(expected);
  });

  test('line content matching should not match if rule is changed', () => {
    const findingRef = {
      type: 'sast',
      path: 'test/file1',
      metadata: {},
      lineNumber: 1,
      lineContent: 'file2 line1 - something new',
      fkEngineRule: 3
    };
    const actual = softMatching(allFindings, findingRef);
    expect(actual).toEqual(undefined);
  });

  test('none matching should work', () => {
    const findingRef = {
      type: 'sca',
      path: 'test/file3',
      metadata: {},
      lineNumber: 1,
      lineContent: 'file2 line1',
      fkEngineRule: 2
    };
    const actual = softMatching(allFindings, findingRef);
    expect(actual).toEqual(undefined);
  });
});

describe('modify allFinding with diffs', () => {
  test('modify allFinding when file rename should work', () => {
    const allFindings = [
      {
        id: 2,
        type: 'sca',
        path: 'test/file2',
        metadata: {
          dependencyName: 'dep',
          currentVersion: '1.2.3'
        },
        lineNumber: 1,
        lineContent: 'file2 line1',
        fkEngineRule: 2
      }
    ];

    const diffs = [
      {
        chunks: [
          {
            content: '@@ -0 +1,0 @@',
            changes: [
              {
                type: 'normal',
                normal: true,
                ln1: 2,
                ln2: 6,
                content: 'hello'
              }
            ],
            oldStart: 1,
            oldLines: 0,
            newStart: 0,
            newLines: 0
          }
        ],
        deletions: 0,
        additions: 0,
        from: 'test/file2',
        to: 'test/file2new'
      }
    ];

    modifyAllFindingWithFileRenameDiffs(allFindings, diffs);
    expect(allFindings[0].path).toEqual('test/file2new');
  });

  test('modify allFinding should not run when not match with diff', () => {
    const allFindings = [
      {
        id: 2,
        type: 'sca',
        path: 'test/file1',
        metadata: {
          dependencyName: 'dep',
          currentVersion: '1.2.3'
        },
        lineNumber: 1,
        lineContent: 'file2 line1',
        fkEngineRule: 2
      }
    ];

    const diffs = [
      {
        chunks: [
          {
            content: '@@ -0 +1,0 @@',
            changes: [
              {
                type: 'normal',
                normal: true,
                ln1: 2,
                ln2: 6,
                content: 'hello'
              }
            ],
            oldStart: 1,
            oldLines: 0,
            newStart: 0,
            newLines: 0
          }
        ],
        deletions: 0,
        additions: 0,
        from: 'test/file2',
        to: 'test/file2new'
      }
    ];

    modifyAllFindingWithFileRenameDiffs(allFindings, diffs);
    expect(allFindings[0].path).toEqual('test/file1');
  });

  test('modify allFinding should not run when file delete', () => {
    const allFindings = [
      {
        id: 2,
        type: 'sca',
        path: 'test/file1',
        metadata: {
          dependencyName: 'dep',
          currentVersion: '1.2.3'
        },
        lineNumber: 1,
        lineContent: 'file2 line1',
        fkEngineRule: 2
      }
    ];

    const diffs = [
      {
        chunks: [
          {
            content: '@@ -0 +1,0 @@',
            changes: [
              {
                type: 'normal',
                normal: true,
                ln1: 2,
                ln2: 6,
                content: 'hello'
              }
            ],
            oldStart: 1,
            oldLines: 0,
            newStart: 0,
            newLines: 0
          }
        ],
        deletions: 1,
        additions: 0,
        from: 'test/file1',
        to: '/dev/null',
        deleted: true,
        index: ['587be6b..0000000']
      }
    ];

    modifyAllFindingWithFileRenameDiffs(allFindings, diffs);
    expect(allFindings[0].path).toEqual('test/file1');
  });
});
