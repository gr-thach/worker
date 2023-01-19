const lodashGet = require('lodash/get');
const zlib = require('zlib');
const { findAccountById } = require('./accounts');

const { wrapper, gql, coreAxios } = require('./index');

const findScanByUuid = async idScan => {
  const query = gql`
    query($idScan: UUID!) {
      scans(
        filter: {
          idScan: { equalTo: $idScan }
          deletedAt: { isNull: true }
          repositoryByFkRepository: {
            deletedAt: { isNull: true }
            accountByFkAccount: { deletedAt: { isNull: true } }
          }
        }
      ) {
        nodes {
          idScan
          sha
          baseSha
          hasComment
          commentId
          prNumber
          githookMetadata
          type
          branch
          repository: repositoryByFkRepository {
            idRepository
            fkAccount
            name
            providerInternalId
            configuration
            path
            isPrivate
          }
        }
      }
    }
  `;

  const variables = { idScan };
  const { data } = await coreAxios.post(`/graphql`, { query, variables });
  const scan = lodashGet(data, 'data.scans.nodes[0]');

  if (!scan) {
    return null;
  }

  const { repository } = scan;

  // Getting the account from core-api where we have the logic to get the root account for
  // accounts with parent accounts and also the logic to don't get the subscription for onpremise
  const account = await findAccountById(repository.fkAccount);

  return {
    ...scan,
    repository: { ...repository, account }
  };
};

const updateScan = async (idScan, patch) => {
  const query = gql`
    mutation updateScan($idScan: UUID!, $patch: ScanPatch!) {
      updateScan(input: { idScan: $idScan, patch: $patch }) {
        scan {
          idScan
        }
      }
    }
  `;

  const variables = { idScan, patch };
  const { data } = await coreAxios.post(`/graphql`, { query, variables });

  return lodashGet(data, 'data.updateScan.scan');
};

const removeNullChar = str => (typeof str === 'string' ? str.replace(/\0/g, '') : str);

const escapeNull = metadata => {
  if (typeof metadata !== 'object') {
    return removeNullChar(metadata);
  }
  return Object.entries(metadata).reduce((r, [k, v]) => ({ ...r, [k]: removeNullChar(v) }), {});
};

const createScansData = async data => {
  const normalizeData = {};
  for (const key of Object.keys(data)) {
    normalizeData[key] = data[key].map(f => ({
      ...f,
      metadata: JSON.stringify(escapeNull(f.metadata)),
      // NOTE: unlike uppercase enum in graphql, enum with raw query require exact value per db define - which is lowercase
      status: f.status ? f.status.toLowerCase() : null
    }));
  }

  const jsonString = JSON.stringify(normalizeData);
  const compressed = zlib.gzipSync(jsonString);
  await coreAxios.post(`/scans/createScansData`, compressed, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
      'Content-Length': compressed.byteLength
    }
  });
};

const markIgnoreScan = async idScan => {
  await coreAxios.post(`/scans/markIgnoreScan`, { idScan });
};

module.exports = {
  findScanByUuid: wrapper(findScanByUuid),
  updateScan: wrapper(updateScan),
  createScansData: wrapper(createScansData),
  markIgnoreScan: wrapper(markIgnoreScan)
};
