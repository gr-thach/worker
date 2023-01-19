const diffParser = require('parse-diff');

const analyzeDiffContent = diffs => {
  const ignoreExtensionRe = new RegExp(`(${ignoreExtensionList.join('|').replace(/\./g, '\\.')})$`);
  const scaEnginesFileRe = new RegExp(`^(${scaEnginesFileList.join('|').replace(/\./g, '\\.')})$`);

  return diffs.reduce(
    (result, diff) => {
      let targetGroup;
      if (!ignoreExtensionRe.test(diff.to)) {
        targetGroup = 'changedFiles';
      } else if (scaEnginesFileRe.test(diff.to)) {
        targetGroup = 'librariesManagerFiles';
      }
      if (targetGroup && result[targetGroup].indexOf(diff.to) === -1) {
        result[targetGroup].push(diff.to);
      }

      if (
        scaEnginesFileRe.test(diff.from) &&
        result.librariesManagerFiles.indexOf(diff.from) === -1
      ) {
        result.librariesManagerFiles.push(diff.from);
      }
      return result;
    },
    { changedFiles: [], librariesManagerFiles: [] }
  );
};

const checkForAbort = commitDiffContent => {
  if (commitDiffContent === undefined || commitDiffContent === null) {
    return {
      abortOnDiff: false,
      librariesManagerFiles: [],
      changedFiles: []
    };
  }

  const diffs = diffParser(commitDiffContent);
  const result = analyzeDiffContent(diffs);
  return {
    ...result,
    abortOnDiff: result.librariesManagerFiles.length + result.changedFiles.length === 0
  };
};

// refer to https://docs.google.com/spreadsheets/d/1rlot83a8yYQqWF-mP0-S3KSiqtwA_zlQ76yySVoym5c/edit#gid=0
const scaEnginesFileList = [
  'go.mod', // go-nancy
  'Gopck.lock',
  'pom.xml', // java-dependency-checker
  'build.gradle',
  'requirements.txt', // safety-python
  'pom.xml', // general-oss-index
  'build.gradle',
  'requirements.txt',
  'environment.yml',
  'environment.yaml',
  'conda.yml',
  'conda.yaml',
  'package.json', // javascript-npm-audit
  'package-lock.json',
  'composer.lock', // php-security-checker
  'Gemfile.lock', // ruby-bundler-audit
  'Cargo.lock' // rust-cargo-audit
];

const ignoreExtensionList = [
  '.aac',
  '.aiff',
  '.ape',
  '.au',
  '.flac',
  '.gsm',
  '.it',
  '.m3u',
  '.m4a',
  '.mid',
  '.mp3',
  '.mpa',
  '.pls',
  '.ra',
  '.s3m',
  '.sid',
  '.wav',
  '.wma',
  '.xm',
  '.7z',
  '.a',
  '.ar',
  '.bz2',
  '.cab',
  '.cpio',
  '.deb',
  '.dmg',
  '.egg',
  '.gz',
  '.iso',
  '.lha',
  '.mar',
  '.pea',
  '.rar',
  '.rpm',
  '.s7z',
  '.shar',
  '.tar',
  '.tbz2',
  '.tgz',
  '.tlz',
  '.whl',
  '.xpi',
  '.zip',
  '.zipx',
  '.rpm',
  '.xz',
  '.pak',
  '.crx',
  '.exe',
  '.msi',
  '.bin',
  '.eot',
  '.otf',
  '.ttf',
  '.woff',
  '.woff2',
  '.3dm',
  '.3ds',
  '.max',
  '.bmp',
  '.dds',
  '.gif',
  '.jpg',
  '.jpeg',
  '.png',
  '.psd',
  '.xcf',
  '.tga',
  '.thm',
  '.tif',
  '.tiff',
  '.yuv',
  '.ai',
  '.eps',
  '.ps',
  '.svg',
  '.dwg',
  '.dxf',
  '.gpx',
  '.kml',
  '.kmz',
  '.ods',
  '.xls',
  '.xlsx',
  '.ics',
  '.vcf',
  '.ppt',
  '.odp',
  '.3g2',
  '.3gp',
  '.aaf',
  '.asf',
  '.avchd',
  '.avi',
  '.drc',
  '.flv',
  '.m2v',
  '.m4p',
  '.m4v',
  '.mkv',
  '.mng',
  '.mov',
  '.mp2',
  '.mp4',
  '.mpe',
  '.mpeg',
  '.mpg',
  '.mpv',
  '.mxf',
  '.nsv',
  '.ogg',
  '.ogv',
  '.ogm',
  '.phar',
  '.qt',
  '.rm',
  '.rmvb',
  '.roq',
  '.srt',
  '.svi',
  '.vob',
  '.webm',
  '.wmv',
  '.yuv'
];

module.exports = {
  checkForAbort,
  analyzeDiffContent,
  ignoreExtensionList
};
