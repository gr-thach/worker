jest.mock('./src/services/redis', () => {
  return {
    get: () => undefined,
    keys: {
      ENGINES_DB_KEY: 'worker_engines_db',
      ENGINE_RULES_DB_KEY: 'worker_engines_rules_db',
      ENGINE_RUN_STATUS_DB_KEY: 'worker_engines_run_status_db',
      SEVERITY_DB_KEY: 'worker_severity_db',
      SCAN_STATUS_NAME_MAPPING_DB_KEY: 'worker_scan_status_name_mapping_db',
      SCAN_RESULT_NAME_MAPPING_DB_KEY: 'worker_scan_result_name_mapping_db'
    }
  };
});

jest.mock('newrelic', () => {
  return {};
});

jest.mock('minio', () => {
  return {
    Client: jest.fn().mockImplementation(() => {
      return { setRequestOptions: () => {} };
    })
  };
});
