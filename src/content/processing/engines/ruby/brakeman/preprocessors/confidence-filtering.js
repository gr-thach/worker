module.exports = (engineReport) => {
  if (
    engineReport &&
    engineReport.process &&
    engineReport.process.name === 'brakeman'
  ) {
    for (let i = 0; i < engineReport.output.length; i += 1) {
      const item = engineReport.output[i];
      const result = item.metadata.confidence && item.metadata.confidence === 'High';
      item.matchEngineFilterOut |= !result;
    };
    // engineReport.output = toReport;
  }

  return engineReport;
};
