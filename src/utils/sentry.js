const Sentry = require('@sentry/node');
const { env } = require('../../config');
const CoreApiError = require('../errors/coreApiError');
const log = require('./logger');

const enabled = env.ENVIRONMENT === 'production' || env.ENVIRONMENT === 'staging';

const release =
  (env.NEW_RELIC_METADATA_KUBERNETES_CONTAINER_IMAGE_NAME &&
    env.NEW_RELIC_METADATA_KUBERNETES_CONTAINER_IMAGE_NAME.toString().split(':')[1]) ||
  '';

Sentry.init({
  dsn: enabled ? env.SENTRY_DSN : '',
  environment: env.ENVIRONMENT,
  release
});

const reportError = async (error, context = {}) => {
  let eventId = '';

  log.error(error);

  if (!enabled) {
    return eventId;
  }

  let sentryContext = context;

  if (error instanceof CoreApiError) {
    sentryContext = {
      ...sentryContext,
      ...error.context
    };
  }

  // When having sentry initialized ...
  if (typeof error === 'string') {
    Sentry.withScope(scope => {
      scope.setExtras(sentryContext);
      eventId = Sentry.captureMessage(error);
    });
  } else {
    Sentry.withScope(scope => {
      scope.setExtras(sentryContext);
      eventId = Sentry.captureException(error);
    });
  }

  await Sentry.flush();

  return eventId;
};

module.exports = reportError;
