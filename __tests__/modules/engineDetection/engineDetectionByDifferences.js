const EngineDetectionByDifferences = require('../../../src/modules/engineDetection/engineDetectionByDifferences');

describe('Engine Detection By Differences', () => {
  test('test empty params', async () => {
    const engines = [];
    const diffs = [];
    const r = new EngineDetectionByDifferences(engines, diffs);
    const expected = [];

    expect(r.detect()).toEqual(expected);
  });

  test('test empty triggerfile engine and null diffs', async () => {
    const engines = [{ idEngine: 1, triggerFiles: '' }];
    const diffs = null;
    const r = new EngineDetectionByDifferences(engines, diffs);
    const expected = [];

    expect(r.detect()).toEqual(expected);
  });

  test('test empty triggerfile engine', async () => {
    const engines = [{ idEngine: 1, triggerFiles: '' }];
    const diffs = ['hung.txt'];
    const r = new EngineDetectionByDifferences(engines, diffs);
    const expected = [];

    expect(r.detect()).toEqual(expected);
  });

  test('test empty diffs', async () => {
    const engines = [
      { idEngine: 1, triggerFiles: '**' },
      { idEngine: 2, triggerFiles: '**/*.*' }
    ];
    const diffs = [];
    const r = new EngineDetectionByDifferences(engines, diffs);
    const expected = [1];

    expect(r.detect()).toEqual(expected);
  });

  test('test normal engines', async () => {
    const engines = [
      { idEngine: 1, triggerFiles: 'xxx;sample/*.php;yyy' },
      { idEngine: 2, triggerFiles: 'sample/hung.*;zzz' },
      { idEngine: 3, triggerFiles: 'sample/*.*' },
      { idEngine: 4, triggerFiles: 'sample/hung.*' },
      { idEngine: 5, triggerFiles: '**/*.*' }
    ];
    const diffs = ['sample/hung.php'];
    const r = new EngineDetectionByDifferences(engines, diffs);
    const expected = [1, 2, 3, 4, 5];

    expect(r.detect()).toEqual(expect.arrayContaining(expected));
  });

  test('test engine with glob', async () => {
    const engines = [
      { idEngine: 1, triggerFiles: '**/*.php' },
      { idEngine: 2, triggerFiles: 'sample/{cat,dog}.*' },
      { idEngine: 3, triggerFiles: 'sample/**' },
      { idEngine: 4, triggerFiles: 'hello/**' }
    ];
    const diffs = ['sample/cat.go', 'a/b/c/d/e.php', 'sample/x', 'hello'];
    const r = new EngineDetectionByDifferences(engines, diffs);
    const expected = [1, 2, 3];

    expect(r.detect()).toEqual(expect.arrayContaining(expected));
  });
});
