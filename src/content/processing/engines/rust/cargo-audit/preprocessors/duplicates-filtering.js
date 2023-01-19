module.exports = (engineReport) => {
    if (
        engineReport &&
        engineReport.process &&
        engineReport.process.name === 'cargo-audit'
    ) {
        let modOutput = [];
        for (let j = 0; j < engineReport.output.length; j += 1) {
            const item = engineReport.output[j];            
            if (modOutput.length == 0) {
                modOutput.push(item);
            } else {
                let found = false;
                for (var i = 0; i < modOutput.length; i++) {
                    if (
                        modOutput[i].location.path === item.location.path &&
                        modOutput[i].metadata.dependencyName === item.metadata.dependencyName &&
                        modOutput[i].metadata.patchedVersions === item.metadata.patchedVersions
                    ) {
                        if (modOutput[i].matchEngineFilterOut !== 0) {
                            modOutput[i].matchEngineFilterOut |= 1;
                            modOutput[i] = item;
                        } else {
                            item.matchEngineFilterOut |= 1;
                        }
                        found = true;
                        break;
                    }
                }
                if (!found) modOutput.push(item);
            }
        };
        // engineReport.output = modOutput;
    } else {
        // engineReport.output = [];
    }
    return engineReport;
};
