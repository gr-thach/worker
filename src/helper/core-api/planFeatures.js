const lodashGet = require('lodash/get');
const { coreAxios, wrapper, gql } = require('./index');

const findPlanFeaturesByPlanCode = async planCode => {
  const query = gql`
    query($planCode: String!) {
      planFeatures(filter: { grPlanByFkPlan: { code: { equalTo: $planCode } } }) {
        nodes {
          feature
          value
        }
      }
    }
  `;
  const variables = { planCode };
  const { data } = await coreAxios.post('/graphql', { query, variables });
  return lodashGet(data, 'data.planFeatures.nodes');
};

module.exports = {
  findPlanFeaturesByPlanCode: wrapper(findPlanFeaturesByPlanCode)
};
