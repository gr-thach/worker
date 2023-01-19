const { compareFinding } = require('./utils');

const softMatching = (allFindings, findingRef, diffs = []) => {
  const matchLevel = {
    FULL: 'full',
    LINE_NUMBER: 'linenumber',
    LINE_CONTENT: 'linecontent'
  };

  const matching = [
    {
      override: {},
      matchLevel: matchLevel.FULL
    },
    {
      override: { lineNumber: 1 },
      matchLevel: matchLevel.LINE_NUMBER
    },
    {
      override: { lineContent: '' },
      matchLevel: matchLevel.LINE_CONTENT
    }
  ];

  let matchedLevel;
  let matchedFinding;
  let pivotLineNumber;
  for (const m of matching) {
    matchedFinding = allFindings.find(f =>
      compareFinding({ ...f, ...m.override }, { ...findingRef, ...m.override })
    );

    if (matchedFinding) {
      pivotLineNumber = Math.max(findingRef.lineNumber, matchedFinding.lineNumber);
      matchedLevel = m.matchLevel;
      break;
    }
  }

  // Update finding in case of lineNumber or lineContent change
  // https://docs.google.com/document/d/1_uADMXrIXRJk9W20xuxLNOTVbhgoHK6Jstrr6lNDZ5o/edit
  let lineChangedCount = 0;
  switch (matchedLevel) {
    case matchLevel.FULL:
      return matchedFinding;
    case matchLevel.LINE_NUMBER:
      // there are 2 case for lineNumber:
      // - when the changed line is existed in diff then we use change.content
      // - when the changed line is not show in diff then count the changed line number and try to compare
      for (const diff of diffs) {
        if (diff.to === findingRef.path) {
          for (const chunk of diff.chunks) {
            for (const change of chunk.changes) {
              if (change.type === 'add' || change.type === 'del') {
                if (change.ln <= pivotLineNumber) {
                  lineChangedCount += change.type === 'add' ? 1 : -1;
                } else {
                  break;
                }
              }
            }
          }
        }
      }

      if (matchedFinding.lineNumber + lineChangedCount === findingRef.lineNumber) {
        return { ...matchedFinding, lineNumber: findingRef.lineNumber };
      }
      break;
    case matchLevel.LINE_CONTENT:
      return { ...matchedFinding, lineContent: findingRef.lineContent };
    default:
  }
  return undefined;
};

module.exports = softMatching;
