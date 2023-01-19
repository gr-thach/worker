const {
  SMARTSCAN_TYPE,
  analyzeSmartScanDiff,
  getNumberOfRemovedLine,
  generateSmartScanOutput,
  generateSmartScanParsedEngineOutput,
  combinePartialSmartScanEngineOutput
} = require('../../src/helper/smartScan');

describe('analyze smart scan diff', () => {
  it('should false when has no diff', () => {
    expect(analyzeSmartScanDiff()).toEqual(false);
    expect(analyzeSmartScanDiff(null)).toEqual(false);
  });

  it('should false when has empty diff', () => {
    expect(analyzeSmartScanDiff([])).toEqual(false);
  });

  it('should false when has empty engine ids', () => {
    expect(analyzeSmartScanDiff(['diffs content'], [])).toEqual(false);
  });

  it('should return correct result', () => {
    const engineIdentifiers = ['1_root', '2_dev/run'];

    const diffs = [
      {
        from: 'tobe-rename-file',
        to: 'rename-file',
        additions: 0,
        deletions: 0
      },
      {
        from: 'delete-file',
        to: '/dev/null'
      },
      {
        from: 'lineRemove-file',
        to: 'lineRemove-file',
        additions: 0,
        deletions: 2,
        chunks: [
          {
            changes: [
              { del: true, type: 'del', ln: 10 },
              { type: 'normal', normal: true, ln1: 12, ln2: 13 }
            ]
          },
          {
            changes: [
              { type: 'normal', normal: true, ln1: 91, ln2: 92 },
              { del: true, type: 'del', ln: 96 },
              { type: 'normal', normal: true, ln1: 100, ln2: 97 }
            ]
          }
        ]
      }
    ];

    const expected = {
      fileRemove: {
        'delete-file': null
      },
      fileRename: {
        'tobe-rename-file': 'rename-file'
      },
      onlyLineRemove: {
        'lineRemove-file': [0, 10, 96]
      },
      others: {},
      type: SMARTSCAN_TYPE.DEDUCTION,
      engineIdentifiers: ['1_root', '2_dev/run']
    };

    expect(analyzeSmartScanDiff(diffs, engineIdentifiers)).toEqual(expected);
  });

  it('should return false is has mixed changed', () => {
    const engineIdentifiers = ['1_null'];

    const diffs = [
      {
        from: 'tobe-rename-file',
        to: 'rename-file',
        additions: 0,
        deletions: 0
      },
      {
        from: 'delete-file',
        to: '/dev/null'
      },
      {
        from: 'lineRemove-file',
        to: 'lineRemove-file',
        additions: 1,
        deletions: 2,
        chunks: [
          {
            changes: [
              { del: true, type: 'del', ln: 10 },
              { type: 'normal', normal: true, ln1: 12, ln2: 13 }
            ]
          }
        ]
      }
    ];

    const expected = {
      fileRemove: { 'delete-file': null },
      fileRename: { 'tobe-rename-file': 'rename-file' },
      onlyLineRemove: {},
      others: { 'lineRemove-file': 'lineRemove-file' },
      type: 2,
      engineIdentifiers: ['1_null']
    };

    expect(analyzeSmartScanDiff(diffs, engineIdentifiers)).toEqual(expected);
  });
});

describe('get number of removed line', () => {
  it('should return correctly', () => {
    expect(getNumberOfRemovedLine([0, 7, 8], 0)).toEqual(0);
    expect(getNumberOfRemovedLine([0, 7, 8], 6)).toEqual(0);
    expect(getNumberOfRemovedLine([0, 7, 8], 7)).toEqual(0);
    expect(getNumberOfRemovedLine([0, 7, 8], 8)).toEqual(1);
    expect(getNumberOfRemovedLine([0, 7, 8], 9)).toEqual(2);
  });
});

describe('generate smart scan output', () => {
  xit('should return correctly when have no findings', () => {
    const smartScanAnalysis = {
      fileRemove: {
        'delete-file': null
      },
      fileRename: {
        'tobe-rename-file': 'rename-file'
      },
      onlyLineRemove: {
        'lineRemove-file': [0, 10, 96]
      }
    };

    const previousEngineFindings = [];

    const expected = [];

    expect(generateSmartScanOutput(smartScanAnalysis, previousEngineFindings)).toEqual(expected);
  });

  xit('should return correctly when have no findings', () => {
    const smartScanAnalysis = {
      fileRemove: {
        'delete-file': null
      },
      fileRename: {
        'tobe-rename-file': 'rename-file'
      },
      onlyLineRemove: {
        'lineRemove-file': [0, 10, 96]
      }
    };

    const previousEngineFindings = [
      {
        path: 'delete-file'
      },
      {
        path: 'tobe-rename-file'
      },
      {
        path: 'lineRemove-file',
        lineNumber: 10
      },
      {
        path: 'lineRemove-file',
        lineNumber: 90
      }
    ];

    const result = generateSmartScanOutput(smartScanAnalysis, previousEngineFindings);

    const expected = [
      {
        path: 'rename-file'
      },
      {
        path: 'lineRemove-file',
        lineNumber: 89
      }
    ];

    expect(result).toEqual(expected);
  });
});

describe('generate smart scan parsed engine output', () => {
  xit('should return correctly', () => {
    const engineToRun = {
      name: 'go-my-engine',
      version: '1.0.0',
      language: 'go'
    };
    const smartScanOutput = [
      {
        path: 'rename-file',
        metadata: { metadata1: 'data1' },
        engineRuleName: 'engineRuleName1',
        type: 'type1'
      },
      {
        path: 'lineRemove-file',
        lineNumber: 89,
        metadata: { metadata2: 'data2' },
        engineRuleName: 'engineRuleName2',
        type: 'type2'
      }
    ];
    const expected = {
      engine: { name: '@guardrails/guardrails-engine-go-my-engine', version: 'smart-scan' },
      engineLogs: {},
      executionTime: 0,
      issues: 2,
      language: 'go',
      output: [
        {
          location: { path: 'rename-file', positions: { begin: { line: undefined } } },
          metadata: { metadata1: 'data1' },
          ruleId: 'engineRuleName1',
          type: 'type1'
        },
        {
          location: { path: 'lineRemove-file', positions: { begin: { line: 89 } } },
          metadata: { metadata2: 'data2' },
          ruleId: 'engineRuleName2',
          type: 'type2'
        }
      ],
      process: { name: 'my-engine', version: 'smart-scan' },
      status: 'success'
    };

    const result = generateSmartScanParsedEngineOutput(engineToRun, smartScanOutput);
    expect(result).toEqual(expected);
  });
});

describe('combine partial smart scan engine output', () => {
  xit('should return correctly', () => {
    const smartScanAnalysis = {
      fileRemove: {
        'delete-file': null
      },
      fileRename: {
        'tobe-rename-file': 'rename-file'
      },
      onlyLineRemove: {
        'lineRemove-file': [0, 10, 96]
      },
      others: { 'changed-file': 'changed-file' },
      type: SMARTSCAN_TYPE.DEDUCTION
    };

    const previousEngineFindings = [
      {
        engineRuleName: 'engineRuleNamePrev',
        lineNumber: 0,
        metadata: 'metadataPrev',
        path: 'Prev-file',
        ruleId: 'engineRuleNamePrev',
        type: 'typePrev'
      },
      {
        engineRuleName: 'engineRuleNameChanged',
        lineNumber: 0,
        metadata: 'metadataChanged',
        path: 'changed-file',
        ruleId: 'engineRuleNameChanged',
        type: 'typeChanged'
      }
    ];

    const engineOutput = {
      engine: { name: '@guardrails/engine-my-engine', version: 'smart-scan' },
      engineLogs: {},
      executionTime: 0,
      issues: 2,
      language: 'go',
      output: [
        {
          location: { path: 'rename-file', positions: { begin: { line: undefined } } },
          metadata: 'metadata1',
          ruleId: 'engineRuleName1',
          type: 'type1'
        },
        {
          location: { path: 'lineRemove-file', positions: { begin: { line: 89 } } },
          metadata: 'metadata2',
          ruleId: 'engineRuleName2',
          type: 'type2'
        }
      ],
      process: { name: 'my-engine', version: 'smart-scan' },
      status: 'success'
    };

    const expected = [
      {
        engineRuleName: 'engineRuleNamePrev',
        lineNumber: 0,
        metadata: 'metadataPrev',
        path: 'Prev-file',
        ruleId: 'engineRuleNamePrev',
        type: 'typePrev'
      },
      {
        engineRuleName: 'engineRuleName1',
        lineNumber: 0,
        location: { path: 'rename-file', positions: { begin: { line: undefined } } },
        metadata: 'metadata1',
        path: 'rename-file',
        ruleId: 'engineRuleName1',
        type: 'type1'
      },
      {
        engineRuleName: 'engineRuleName2',
        lineNumber: 89,
        location: { path: 'lineRemove-file', positions: { begin: { line: 89 } } },
        metadata: 'metadata2',
        path: 'lineRemove-file',
        ruleId: 'engineRuleName2',
        type: 'type2'
      }
    ];

    const result = combinePartialSmartScanEngineOutput(
      smartScanAnalysis,
      previousEngineFindings,
      engineOutput
    );
    expect(result).toEqual(expected);
  });
});
