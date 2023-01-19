/* eslint-disable no-console */
const lodashGet = require('lodash/get');
const { IncomingWebhook } = require('@slack/webhook');
const log = require('../utils/logger');
const { buildScanResultSlackNotification } = require('../helper/slack');
const { getAccountIdentifierValue } = require('../helper/account');

class SlackService {
  static async sendNotification(
    account,
    repository,
    branch,
    sha,
    hasVulnerabilities,
    config,
    description,
    isPR
  ) {
    try {
      const slackConfig = lodashGet(config, 'notifications.slack', {});
      const { webhookUrl, notify = 'onAllScans', enabled = false } = slackConfig;

      if (
        !webhookUrl ||
        !enabled ||
        (notify === 'whenScanHasFindingsOnly' && !hasVulnerabilities) ||
        (notify === 'whenPRHasFindingsOnly' && (!hasVulnerabilities || !isPR))
      ) {
        return;
      }

      const sendFor = `${getAccountIdentifierValue(account)}/${repository.name}/${branch}@${sha}`;
      log.info(`SlackService > sending slack notification for ${sendFor}`);

      const notification = buildScanResultSlackNotification(
        account,
        repository,
        branch,
        sha,
        hasVulnerabilities ? 'failure' : 'success',
        description
      );

      await SlackService.postNotification(webhookUrl, { attachments: [notification] });
    } catch (e) {
      log.error(
        'Error while trying to send the Slack Notification with config:',
        config,
        'and Exception:',
        e
      );
    }
  }

  static async postNotification(webhookUrl, notification) {
    const webhook = new IncomingWebhook(webhookUrl);
    await webhook.send(notification, (err, res) => {
      if (err) log.error('Error:', err);
      else log.info('Message sent: ', res);
    });
  }
}

module.exports = SlackService;
