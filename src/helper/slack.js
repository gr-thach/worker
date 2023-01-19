const { env } = require('../../config');
const { getAccountIdentifierValue, dashboardScanUrl } = require('./account');

const defaultSlackFormattedMessage = (text, color) => ({
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text
      }
    },
    {
      type: 'context',
      elements: [
        {
          type: 'image',
          image_url: 'https://docs.guardrails.io/assets/images/favicon/favicon-32x32.png',
          alt_text: 'Guardrails logo'
        },
        {
          type: 'mrkdwn',
          text: env.ENVIRONMENT === 'production' ? 'guardrails' : `guardrails-${env.ENVIRONMENT}`
        }
      ]
    }
  ],
  ...(color && { color })
});

const buildScanResultSlackNotification = (account, repository, branch, sha, state, description) => {
  const colors = {
    green: '#2eb886',
    unimportant: '#edeeef',
    failure: '#de4e2b'
  };
  let color;
  const accountIdentifier = getAccountIdentifierValue(account);
  if (`${accountIdentifier}/${repository.name}`.includes('guardrailsio/guardrails-test')) {
    color = colors.unimportant;
  } else {
    color = state === 'success' ? colors.green : colors.failure;
  }

  const title = `Scan of ${accountIdentifier}/${repository.name} Branch:${branch} (${sha.substr(
    0,
    7
  )})`;
  const link = dashboardScanUrl(account, repository.idRepository, sha);

  return defaultSlackFormattedMessage(`${title}\n*<${link}|${description}>*`, color);
};

module.exports = {
  buildScanResultSlackNotification,
  defaultSlackFormattedMessage
};
