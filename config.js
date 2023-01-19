const envalid = require('envalid');
const { ACCOUNT_PROVIDER } = require('./src/helper/core-api/enums');

const { str, url, port, num, bool } = envalid;

const env = envalid.cleanEnv(
  process.env,
  {
    PORT: port({ default: 3000 }),
    DOCKER_HUB_AUTH_BASE64: str({ devDefault: '' }),
    DOCKER_HUB_CUSTOM_ENGINES_AUTH_BASE64: str({ devDefault: '' }),
    ENVIRONMENT: str({
      choices: ['development', 'staging', 'production'],
      default: 'development'
    }),
    SENTRY_DSN: str({ default: '' }),
    /* --- */
    DOCKER_HOST: str({ default: '' }),
    AMQP_URI: url({ default: '' }),
    AMQP_QUEUE_NAME: str({ default: 'guardrails' }),
    AMQP_DETECT_ENGINE_QUEUE: str({ default: 'guardrails-detect-engine-queue' }),
    AMQP_SCAN_QUEUE: str({ default: 'guardrails-scan-queue' }),
    AMQP_SCAN_RESULT_EXCHANGE_NAME: str({ default: 'guardrails-scan-result-exchange' }),
    AMQP_SCAN_RESULT_QUEUE: str({ default: 'guardrails-scan-result-queue' }),
    AMQP_SCAN_EVENT_QUEUE: str({ default: 'guardrails-scan-event-queue' }),
    AMQP_DEAD_LETTER_SCAN_QUEUE: str({ default: 'guardrails-dead-letter-scan-queue' }),
    AMQP_QUEUE_PREFETCH: num({ default: 1 }),
    HELPER_ENRY_VERSION: str({ default: 'latest' }),
    HELPER_GIT_CLONER_VERSION: str({ default: 'latest' }),
    AMQP_QUEUE_MAX_PIORITY: num({ default: 2 }),
    AMQP_QUEUE_DURABLE: bool({ default: true }),
    AMQP_QUEUE_MESSAGE_TTL: num({ default: 14400000 }), // 4 hours
    AMQP_DEAD_LETTER_QUEUE_NAME: str({ default: 'guardrails-dead-letter' }),
    AMQP_DEAD_LETTER_MAX_RETRY: num({ default: 3 }),
    CORE_API_URI: url({}),
    GITHUB_APP_ISSUER_ID: str(),
    GITHUB_APP_PRIVATE_KEY_BASE64: str(),
    GUARDRAILS_GITLAB_TOKENS_SECRET: str(),
    GUARDRAILS_GITLAB_OWN_USER_TOKEN: str({ devDefault: '' }),
    GUARDRAILS_BOT_DISPLAY_NAME: str({ default: 'guardrails' }),
    DASHBOARD_URL: str({ default: 'https://dashboard.guardrails.io' }),
    SCAORACLEAGENT_URL: str({ default: '' }),
    GITHUB_URL: str({ default: 'https://github.com' }),
    GITHUB_API_URL: str({ default: 'https://api.github.com' }),
    GITLAB_URL: str({ default: 'https://gitlab.com' }),
    GITLAB_API_URL: str({ default: 'https://gitlab.com/api/v4' }),
    BITBUCKET_URL: str({ default: 'https://bitbucket.org' }),
    BITBUCKET_API_URL: str({ default: 'https://api.bitbucket.org' }),
    BITBUCKET_APP_NAME: str(),
    BITBUCKET_APP_SECRET: str(),
    BITBUCKET_DATA_CENTER_SITE_URL: str({ default: '' }),
    BITBUCKET_DATA_CENTER_API_URL: str({ default: '' }),
    BITBUCKET_DATA_CENTER_OWN_USER_TOKEN: str({ default: '' }),
    IGNORE_DEVOPS_HOOKS: str({ default: 'false' }),
    STORAGE_HOST: str({ devDefault: '' }),
    STORAGE_ACCESS_KEY: str({ devDefault: '' }),
    STORAGE_SECRET_KEY: str({ devDefault: '' }),
    STORAGE_PORT: port({ devDefault: 443 }),
    STORAGE_S3_REGION: str({ default: '' }),
    ONPREMISE: bool({
      default: false,
      desc: 'Tells whether we are on on-premise deployment'
    }),
    ONPREMISE_K8S_NAMESPACE: str({ default: '' }),
    K8S_JOB_BACKOFFLIMIT: num({ default: 1 }),
    ONPREMISE_DOCKER_LOCAL_REGISTRY: str({ default: 'guardrails' }),
    ONPREMISE_K8S_STORAGE_MODE: str({ default: 'enable_hostpath' }),
    ONPREMISE_K8S_STORAGE_PATH: str({ default: '/tmp' }),
    ONPREMISE_DOCKER_MAX_RUNNING_CONTAINERS: num({ default: 5 }), // For Replicated docker swarm
    ONPREMISE_DOCKER_CONTAINERS_WAIT_LIMIT: num({ default: 900 }), // 15 min
    ONPREMISE_DOCKER_CONTAINERS_WORKER_TMP_MOUNT: str({ default: '/tmp' }),
    SECRET_ENGINES_CPU_REQUESTS: str({ default: '100m' }),
    SECRET_ENGINES_CPU_LIMITS: str({ default: '3000m' }),
    SECRET_ENGINES_MEM_REQUESTS: str({ default: '128Mi' }),
    SECRET_ENGINES_MEM_LIMITS: str({ default: '3Gi' }),
    DISABLE_ENGINE_JOBS_REQUESTS: bool({ default: false }),
    ENGINE_JOBS_CPU_REQUESTS: str({ default: '50m' }),
    ENGINE_JOBS_CPU_LIMITS: str({ default: '1500m' }),
    ENGINE_JOBS_MEM_REQUESTS: str({ default: '128Mi' }),
    ENGINE_JOBS_MEM_LIMITS: str({ default: '2Gi' }),
    ENGINE_CUSTOM_TIMEOUT_MIN: num({ default: 0 }),
    REDIS_URL: str({ default: 'redis://:@redis:6379/0' }),
    IPV6: bool({ default: false }),
    /* --- */
    LOG_DEBUG: str({ default: 'false' }),
    FEATURE_SMARTSCAN: bool({ default: false }),
    FEATURE_DOWNLOAD_SRC_VIA_API: bool({ default: false }),
    FEATURE_ENGINE_CIRCUIT_BREAKER: bool({ default: false }),
    ENGINE_CIRCUIT_BREAKER_THRESHOLD: num({ default: 3 }),
    ENGINE_CIRCUIT_BREAKER_COOLING_IN_MINUTE: num({ default: 720 }),
    FEATURE_LIMIT_SOURCE_CODE_SIZE: bool({ default: false }),
    FEATURE_ENGINE_RUN_ERROR_FALLBACK: bool({ default: false }),
    LIMIT_SOURCE_CODE_SIZE_IN_MB: num({ default: 5000 }),
    DISABLE_PR_COMMENT_FOOTER: bool({ default: false }),
    FEATURE_SIS: bool({ default: true }),
    FEATURE_SAST: bool({ default: true }),
    FEATURE_SCA: bool({ default: true }),
    FEATURE_CLOUD: bool({ default: true }),
    DISABLE_COMMIT_STATUS: bool({ default: false }),
    HELPER_ENGINE_ID_ENRY: str({ default: 'e' }),
    HELPER_ENGINE_ID_GITCLONER: str({ default: 'g' }),
    GLOBAL_AGENT_HTTP_PROXY: str({ default: '' }),
    GLOBAL_AGENT_HTTPS_PROXY: str({ default: '' }),
    ASSIGN_REVIEWERS_BY_TEAM_SLUG: str({ default: '' }),
    FEATURE_ENGINE_RUN_V3: bool({ default: false }),
    INIT_CONTAINER_IMG: str({ default: 'guardrails/init-container-job:latest' }),
    USE_LOCAL_K8S: bool({ default: false }),
    STORAGE_PATH: str({ default: '/pv-disks/nvme' }),
    NEW_RELIC_METADATA_KUBERNETES_CONTAINER_IMAGE_NAME: str({
      default: 'guardrails/worker:notset'
    }),
    GITPROVIDER_GET_SOURCECODE_TIMEOUT_IN_SECOND: num({ default: 600 }),
    FEATURE_ENGINE_WRAPPER: bool({ default: false }),
    DOCKER_NETWORK_NAME: str({ default: 'guardrails_network' })
  },
  { ...(process.env.NODE_ENV === 'test' && { dotEnvPath: 'test.env' }) }
);

const constants = (environment => {
  const constantsByEnvironment = {
    default: {
      octokit: {
        doNotRetry: [400, 403, 422]
      },
      minio: {
        cliBucketName: 'guardrails-cli',
        gitCloneBucketName: 'guardrails-git-cloner'
      },
      botDisplayName: env.GUARDRAILS_BOT_DISPLAY_NAME,
      dashboardBaseUrl: env.DASHBOARD_URL,
      slackDevopsWebhookUrl:
        'https://hooks.slack.com/services/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',
      helperEnginesBundles: {
        general: {
          engines: ['enry', 'git-cloner']
        }
      },
      shortProvider: {
        [ACCOUNT_PROVIDER.GITHUB]: 'gh',
        [ACCOUNT_PROVIDER.GITLAB]: 'gl',
        [ACCOUNT_PROVIDER.BITBUCKET]: 'bb',
        [ACCOUNT_PROVIDER.BITBUCKET_DATA_CENTER]: 'bbdc'
      }
    },
    staging: {
      botDisplayName: 'guardrails-staging',
      dashboardBaseUrl: 'https://dashboard.staging.k8s.guardrails.io'
    },
    development: {
      botDisplayName: 'guardrails-development',
      dashboardBaseUrl: 'https://dashboard.dev.guardrails.io'
    }
  };
  return { ...constantsByEnvironment.default, ...constantsByEnvironment[environment] };
})(env.ENVIRONMENT);

const isK8s = (!env.ONPREMISE && env.ENVIRONMENT !== 'development') || env.ONPREMISE_K8S_NAMESPACE;

const k8sNamespace = env.ONPREMISE ? env.ONPREMISE_K8S_NAMESPACE : 'guardrailsio';

const engineResources = {
  'general-detect-secrets': {
    requests: {
      cpu: env.SECRET_ENGINES_CPU_REQUESTS,
      memory: env.SECRET_ENGINES_MEM_REQUESTS
    },
    limits: {
      cpu: env.SECRET_ENGINES_CPU_LIMITS,
      memory: env.SECRET_ENGINES_MEM_LIMITS
    }
  },
  'general-semgrep': {
    requests: {
      cpu: env.SECRET_ENGINES_CPU_REQUESTS,
      memory: env.SECRET_ENGINES_MEM_REQUESTS
    },
    limits: {
      cpu: env.SECRET_ENGINES_CPU_LIMITS,
      memory: env.SECRET_ENGINES_MEM_LIMITS
    }
  },
  'javascript-eslint': {
    requests: {
      cpu: env.DISABLE_ENGINE_JOBS_REQUESTS ? '1m' : '10m',
      memory: env.DISABLE_ENGINE_JOBS_REQUESTS ? '1Mi' : '256Mi'
    },
    limits: {
      cpu: env.ENGINE_JOBS_CPU_LIMITS,
      memory: env.ENGINE_JOBS_MEM_LIMITS
    }
  },
  'typescript-tslint': {
    requests: {
      cpu: env.DISABLE_ENGINE_JOBS_REQUESTS ? '1m' : '10m',
      memory: env.DISABLE_ENGINE_JOBS_REQUESTS ? '1Mi' : '256Mi'
    },
    limits: {
      cpu: env.ENGINE_JOBS_CPU_LIMITS,
      memory: env.ENGINE_JOBS_MEM_LIMITS
    }
  },
  // default will be used as base line for all engine that do not have resource set
  default: {
    requests: {
      cpu: env.ENGINE_JOBS_CPU_REQUESTS,
      memory: env.ENGINE_JOBS_MEM_REQUESTS
    },
    limits: {
      cpu: env.ENGINE_JOBS_CPU_LIMITS,
      memory: env.ENGINE_JOBS_MEM_LIMITS
    }
  }
};

module.exports = { env, constants, isK8s, k8sNamespace, engineResources };
