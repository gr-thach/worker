const get = require('lodash/get');
const uniq = require('lodash/uniq');

const SMARTSCAN_TYPE = {
  DEDUCTION: 1,
  PARTIAL: 2,
  FULL: 3
};

const isFileRename = diff =>
  diff.from !== diff.to &&
  diff.from !== '/dev/null' &&
  diff.to !== '/dev/null' &&
  diff.additions === 0 &&
  diff.deletions === 0;

const isFileRemove = diff => diff.from !== '/dev/null' && diff.to === '/dev/null';

const isFileChangeWithOnlyDelete = diff =>
  diff.from === diff.to && diff.to !== '/dev/null' && diff.additions === 0 && diff.deletions > 0;

const analyzeSmartScanDiff = (commitDiffs, engineIdentifiers) => {
  if (
    !commitDiffs ||
    commitDiffs.length === 0 ||
    !engineIdentifiers ||
    engineIdentifiers.length === 0
  ) {
    return false;
  }

  const result = {
    fileRemove: {},
    fileRename: {},
    onlyLineRemove: {},
    others: {},
    type: SMARTSCAN_TYPE.DEDUCTION,
    engineIdentifiers
  };

  for (let i = 0, l = commitDiffs.length; i < l; i += 1) {
    const diff = commitDiffs[i];
    if (isFileRename(diff)) {
      result.fileRename[diff.from] = diff.to;
    } else if (isFileRemove(diff)) {
      result.fileRemove[diff.from] = null;
    } else if (isFileChangeWithOnlyDelete(diff)) {
      const data = [0]; // default value
      diff.chunks.forEach(chunk => {
        chunk.changes.forEach(c => {
          if (c.del && c.type === 'del') {
            data.push(c.ln);
          }
        });
      });
      result.onlyLineRemove[diff.from !== '/dev/null' ? diff.from : diff.to] = data;
    } else {
      result.others[diff.from] = diff.to;
      result.type = SMARTSCAN_TYPE.PARTIAL;
    }
  }
  return result;
};

// NOTE: /helper/engineConfig.js also has this function defined
const getPaths = path => {
  return (path || '').split('/').filter(p => p !== '');
};

// NOTE: /helper/engineConfig.js also has this function defined
const getDirPaths = path => getPaths(path).slice(0, -1); // remove the filename part

const checkRelatedPath = (input, root, excludedPaths) => {
  if (input === '/dev/null') {
    return true;
  }

  const inputParts = getPaths(input);
  const inputDirParts = getDirPaths(input);
  const rootParts = getPaths(root);
  const excludedParts = excludedPaths.map(p => getPaths(p));

  if (inputParts.length < rootParts.length) {
    return false;
  }

  for (let i = 0; i < rootParts.length; i += 1) {
    if (rootParts[i] !== '*' && inputParts[i] !== rootParts[i]) {
      return false;
    }
  }

  for (let i = 0; i < excludedParts.length; i += 1) {
    const l = excludedParts[i].length;
    if (inputDirParts.length >= l) {
      for (let j = 0; j < l; j += 1) {
        if (excludedParts[i][j] !== '*' && inputParts[j] !== excludedParts[i][j]) {
          break;
        }
        if (j === l - 1) {
          return false;
        }
      }
    }
  }

  return true;
};

const filterDiffPaths = (path, excluded, commitDiffs) =>
  commitDiffs.filter(
    d => checkRelatedPath(d.from, path, excluded) && checkRelatedPath(d.to, path, excluded)
  );

const generateDiffPaths = commitDiffsFiltered => {
  const diffPaths = [];
  for (let i = 0, l = commitDiffsFiltered.length; i < l; i += 1) {
    const diff = commitDiffsFiltered[i];

    if (diff.from && diff.from !== '/dev/null') {
      diffPaths.push(diff.from);
    }
    if (diff.to && diff.to !== '/dev/null') {
      diffPaths.push(diff.to);
    }
  }
  return uniq(diffPaths);
};

const generateFullScanDiffNew = () => ({
  scanType: SMARTSCAN_TYPE.FULL,
  smartScan: {
    fileRemove: {},
    fileRename: {},
    onlyLineRemove: {},
    others: {},
    type: SMARTSCAN_TYPE.FULL
  }
});

const analyzeSmartScanDiffNew = (path, excluded, commitDiffs) => {
  const result = {
    fileRemove: {},
    fileRename: {},
    onlyLineRemove: {},
    type: SMARTSCAN_TYPE.DEDUCTION
  };

  if (!commitDiffs || commitDiffs.length === 0) {
    return result;
  }

  const commitDiffsFiltered = filterDiffPaths(path, excluded, commitDiffs);

  for (let i = 0, l = commitDiffsFiltered.length; i < l; i += 1) {
    const diff = commitDiffsFiltered[i];

    if (
      diff.from !== diff.to &&
      diff.from !== '/dev/null' &&
      diff.to !== '/dev/null' &&
      diff.additions === 0 &&
      diff.deletions === 0
    ) {
      result.fileRename[diff.from] = diff.to;
    } else if (diff.from !== '/dev/null' && diff.to === '/dev/null') {
      result.fileRemove[diff.from] = null;
    } else if (
      diff.from === diff.to &&
      diff.to !== '/dev/null' &&
      diff.additions === 0 &&
      diff.deletions > 0
    ) {
      const data = [0]; // default value
      diff.chunks.forEach(chunk => {
        chunk.changes.forEach(c => {
          if (c.del && c.type === 'del') {
            data.push(c.ln);
          }
        });
      });
      result.onlyLineRemove[diff.from !== '/dev/null' ? diff.from : diff.to] = data;
    } else {
      result.type = SMARTSCAN_TYPE.PARTIAL;
    }
  }

  return {
    scanType: result.type,
    smartScan: result,
    diffs: generateDiffPaths(commitDiffsFiltered)
  };
};

const getNumberOfRemovedLine = (data, x) => {
  if (x === 0) {
    return 0;
  }

  let left = 0;
  let right = data.length - 1;
  while (left < right) {
    const pivot = Math.floor((left + right) / 2);
    if (data[pivot] === x) {
      return pivot - 1;
    }
    if (data[pivot] > x) {
      right = pivot === right ? right - 1 : pivot;
    } else {
      left = pivot === left ? left + 1 : pivot;
    }
  }
  if (data[left] < x) {
    return left;
  }
  return left - 1;
};

const buildEngineOutput = finding => {
  const isCustomRule = !!finding.customEngineRuleName;
  return {
    type: finding.type,
    ruleId: isCustomRule ? finding.customEngineRuleName : finding.engineRuleName,
    location: {
      path: finding.path,
      positions: {
        begin: {
          line: finding.lineNumber
        }
      }
    },
    metadata: {
      lineContent: finding.lineContent,
      ...finding.metadata,
      ...(isCustomRule && { isCustomRule })
    },
    engineRule: finding.fkEngineRule,
    fkCustomEngineRule: isCustomRule ? finding.fkEngineRule : null,
    fkEngineRule: isCustomRule ? null : finding.fkEngineRule,
    fkSeverity: finding.fkSeverity,
    rule: finding.fkRule,
    language: finding.language,
    status: finding.status,
    fromDb: !!finding.idFinding,
    filterReasonFromDb: finding.filterReason
  };
};

const generateSmartScanOutput = (smartScanAnalysis, previousEngineFindings) => {
  const result = [];

  for (let i = 0, l = previousEngineFindings.length; i < l; i += 1) {
    const p = previousEngineFindings[i];
    if (!smartScanAnalysis) {
      result.push(p);
    } else if (smartScanAnalysis.fileRename[p.path] !== undefined) {
      result.push({ ...p, path: smartScanAnalysis.fileRename[p.path] });
    } else if (smartScanAnalysis.onlyLineRemove[p.path] !== undefined) {
      if (p.lineNumber && smartScanAnalysis.onlyLineRemove[p.path].indexOf(p.lineNumber) === -1) {
        const diffLineNumber = getNumberOfRemovedLine(
          smartScanAnalysis.onlyLineRemove[p.path],
          p.lineNumber
        );
        const modifiedLineNumber = p.lineNumber - diffLineNumber;
        result.push({
          ...p,
          lineNumber: modifiedLineNumber
        });
      } else {
        // do nothing - remove finding
      }
    } else if (smartScanAnalysis.fileRemove[p.path] !== undefined) {
      // do nothing - remove finding
    } else {
      result.push(p);
    }
  }

  return result;
};

const generateSmartScanParsedEngineOutput = (
  engine,
  smartScanOutput,
  version = 'smart-scan',
  executionTime = 0
) => {
  // exception case for general-detect-secrets engine
  // https://github.com/guardrailsio/engine-general-detect-secrets/blob/f385d44a0fd4312509259329497a5ef626ed959a/engine-general-detect-secrets.js#L40
  const engineName =
    engine.name === 'general-detect-secrets'
      ? `guardrails-engine-general-detect-secrets`
      : `@guardrails/guardrails-engine-${engine.name}`;
  const engineNameWithoutLanguage = engine.name.replace(`${engine.language}-`, '');

  return {
    engine: { name: engineName, version },
    process: { name: engineNameWithoutLanguage, version },
    language: engine.language,
    status: 'success',
    engineLogs: {},
    executionTime,
    issues: smartScanOutput.length,
    output: smartScanOutput.map(buildEngineOutput)
  };
};

const combinePartialSmartScanEngineOutput = (
  scanConfigDiffs,
  previousEngineFindings,
  partialEngineOutput
) => {
  const previousOutput = previousEngineFindings.filter(p => !scanConfigDiffs.includes(p.path));

  const partialOutput = (partialEngineOutput.output || [])
    .map(p => ({
      ...p,
      engineRuleName: p.ruleId,
      ...(get(p, 'metadata.isCustomRule') && { customEngineRuleName: p.ruleId }),
      path: get(p, 'location.path', ''),
      lineNumber: parseInt(get(p, 'location.positions.begin.line', 0), 10)
    }))
    .filter(p => scanConfigDiffs.includes(p.path));
  return [...previousOutput, ...partialOutput];
};

module.exports = {
  SMARTSCAN_TYPE,
  analyzeSmartScanDiff,
  getNumberOfRemovedLine,
  buildEngineOutput,
  generateSmartScanOutput,
  generateSmartScanParsedEngineOutput,
  combinePartialSmartScanEngineOutput,
  analyzeSmartScanDiffNew,
  generateFullScanDiffNew
};
