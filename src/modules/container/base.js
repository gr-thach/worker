// TODO: this base class is not really need
class BaseContainer {
  // k8s only
  // can remove this after updated all engines
  supportOutputFileEngine(dockerImage) {
    const enableImages = [
      // 'guardrails/helper-engine-general-enry:staging',
      // 'guardrails/engine-c-flawfinder:staging',
      // 'guardrails/engine-javascript-eslint:staging',
      // 'guardrails/engine-java-semgrep:staging',
      // 'guardrails/engine-go-nancy:staging',
      // 'guardrails/engine-go-gosec:staging',
      // 'guardrails/engine-dotnet-security-code-scan:staging',
      // 'guardrails/engine-dotnet-devaudit:staging',
      // 'guardrails/engine-general-detect-secrets:staging',
      // 'guardrails/engine-general-kubesec:staging',
      // 'guardrails/engine-general-ossindex:staging',
      // 'guardrails/engine-dotnet-security-code-scan:staging',
      // 'guardrails/engine-dotnet-devaudit:staging',
      // 'guardrails/engine-java-semgrep:staging',
      // 'guardrails/engine-java-spotbugs:staging',
      // 'guardrails/engine-javascript-nodejsscan:staging',
      // 'guardrails/engine-php-security-checker:staging',
      // 'guardrails/engine-java-dependency-check:staging',
      // 'guardrails/engine-javascript-npm-audit:staging',
      // 'guardrails/engine-javascript-retirejs:staging',
      // 'guardrails/engine-php-phpcs-security-audit:staging'
    ];
    return enableImages.indexOf(dockerImage) !== -1;
  }

  // sub path that engine want to mount
  // exception for Go engine since it require src mount to /opt/mount/src
  getEngineMountPoint() {
    if (this.engineName === 'go-nancy' || this.engineName === 'go-gosec') {
      return 'src/';
    }
    return '';
  }

  // docker only
  parseLogs(logs) {
    // NOTE: https://github.com/moby/moby/issues/7375#issuecomment-51462963
    // eslint-disable-next-line class-methods-use-this
    const logArray = logs.split('\n');
    let ret = '';
    logArray.forEach(logLine => {
      let line = logLine.slice(8);
      // NOTE: https://stackoverflow.com/a/53681022/926721
      // eslint-disable-next-line no-control-regex
      line = line.replace(/[\x00-\x08\x0E-\x1F\x7F-\uFFFF]/g, '');
      ret = `${ret + line}\n`;
    });
    return ret;
  }
}

module.exports = BaseContainer;
