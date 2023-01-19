const lodashGet = require('lodash/get');
const { env } = require('../../config');
const { findPlanFeaturesByPlanCode } = require('./core-api/planFeatures');
const { PLANS_CODES, PLAN_FEATURES } = require('./core-api/enums');

const LEGACY_PLAN_CODES = [
  PLANS_CODES.GR_OPEN_SOURCE,
  PLANS_CODES.GR_INDIVIDUAL,
  PLANS_CODES.GR_STARTUP,
  PLANS_CODES.GR_BUSINESS
];

const isSubscriptionActive = subscription =>
  ['active', 'trialing'].includes(lodashGet(subscription, 'status'));

/**
 * Returns the value for a given feature which can be boolean (enabled/disabled) a number (like amount of private repositories)
 * @param {*} subscription - This is the account's subscription which should have the current plan + the plan features inside
 * @param {*} featureName - This is the feautre name to get the value from (see PLAN_FEATURES enum)
 */
const getFeatureValue = async (subscription, featureName) => {
  if (env.ONPREMISE) {
    switch (featureName) {
      case PLAN_FEATURES.LANG_EXCLUSIONS:
        return [];
      default:
        return true;
    }
  }

  let features;
  if (isSubscriptionActive(subscription)) {
    features = subscription.plan.features;
  } else {
    const planWhenNotActive = LEGACY_PLAN_CODES.includes(subscription.plan.code)
      ? PLANS_CODES.GR_OPEN_SOURCE
      : PLANS_CODES.FREE;
    features = await findPlanFeaturesByPlanCode(planWhenNotActive);
  }

  const feature = features.find(f => f.feature === featureName);
  if (!feature) {
    throw Error(
      `PlanFeature with name = ${featureName} not found for plan with id = ${subscription.plan.idPlan}`
    );
  }

  const { value } = feature;

  switch (featureName) {
    case PLAN_FEATURES.LANG_EXCLUSIONS:
      return value.split(',');
    case PLAN_FEATURES.CUSTOM_CONFIG:
    case PLAN_FEATURES.CUSTOM_ENGINES:
      return value === 'YES';
    default:
      return value;
  }
};

module.exports = {
  getFeatureValue
};
