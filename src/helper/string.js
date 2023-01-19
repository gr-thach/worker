const asString = data => {
  if (typeof data === 'string' || data === null || data === undefined) {
    return data;
  }

  return JSON.stringify(data);
};

const truncateString = (str, maxLength) => {
  if (maxLength < 0) {
    throw new Error(`Expected max length to be a positive number, got ${maxLength}.`);
  }

  if (typeof str === 'string' && str.length > maxLength) {
    return `${str.substring(0, maxLength)}...`;
  }

  return str;
};

module.exports = {
  asString,
  truncateString
};
