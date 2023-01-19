const lodashGet = require('lodash/get');
const { wrapper, gql, coreAxios } = require('./index');

const findCommentId = async (idRepository, prNumber) => {
  const query = gql`
    query($idRepository: Int!, $prNumber: Int!) {
      scans(
        first: 1
        filter: { commentId: { isNull: false } }
        condition: { fkRepository: $idRepository, prNumber: $prNumber, deletedAt: null }
      ) {
        nodes {
          commentId
        }
      }
    }
  `;

  const variables = {
    idRepository: parseInt(idRepository, 10),
    prNumber
  };

  const { data } = await coreAxios.post(`/graphql`, { query, variables });
  return lodashGet(data, 'data.scans.nodes[0].commentId');
};

module.exports = {
  findCommentId: wrapper(findCommentId)
};
