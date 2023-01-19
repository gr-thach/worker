const lodashFlatten = require('lodash/flatten');
const lodashZip = require('lodash/zip');

function template(strings, ...keys) {
  // eslint-disable-next-line no-param-reassign
  keys = keys.map(key => {
    if (Array.isArray(key)) return key.join('\n');
    return key || '';
  });
  return lodashFlatten(lodashZip(strings, keys)).join('');
}

template.link = (text, url) => `[${text}](${url})`;
template.code = text => `\`${text}\``;

module.exports = template;
