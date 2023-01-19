const { env } = require('../../config');
const { getAccountIdentifierValue } = require('./account');

const resolveDockerImage = (engine, type = 'engine') => {
  const dockerImgHostAndUser =
    env.ONPREMISE && env.ONPREMISE_DOCKER_LOCAL_REGISTRY !== ''
      ? env.ONPREMISE_DOCKER_LOCAL_REGISTRY
      : 'guardrails';

  if (type === 'helper') {
    return `${dockerImgHostAndUser}/helper-engine-general-${engine.name}:${engine.version}`;
  }
  const isCustom = !!engine.fkAccount;
  if (isCustom) {
    const accountRef = env.ONPREMISE ? getAccountIdentifierValue(engine.account) : engine.fkAccount;
    return `${dockerImgHostAndUser}/${accountRef}-${engine.language}-${engine.name}:${engine.version}`;
  }
  return `${dockerImgHostAndUser}/engine-${engine.name}:${engine.version}`;
};

module.exports = {
  resolveDockerImage
};
