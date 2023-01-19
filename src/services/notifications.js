const SlackService = require('./slack');

class NotificationsService {
  constructor(account, config) {
    this.account = account;
    this.config = config;
  }

  async send(scan, scanResult, isPR) {
    await SlackService.sendNotification(
      this.account,
      scan.repository,
      scan.branch,
      scan.sha,
      scanResult.count > 0,
      this.config,
      scanResult.description,
      isPR
    );
  }
}

module.exports = NotificationsService;
