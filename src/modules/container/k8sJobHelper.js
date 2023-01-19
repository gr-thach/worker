const { env, engineResources } = require('../../../config');
const { allPossibleNodeAffinity } = require('./helper');

// Note: need to remove /tmp/ prefix from the subpath since volume mount root is /tmp
const removeSlashTmpPrefixInPath = path =>
  typeof path === 'string' ? path.replace(/^\/tmp\//, '') : path;

// For prod/staging k8s
const getCloudNodeAffinity = () => ({
  nodeAffinity: {
    requiredDuringSchedulingIgnoredDuringExecution: {
      nodeSelectorTerms: [
        {
          matchExpressions: [
            {
              key: 'node-name',
              operator: 'In',
              values: ['worker']
            },
            {
              key: 'node-os',
              operator: 'In',
              values: ['linux']
            },
            ...(env.FEATURE_ENGINE_RUN_V3
              ? []
              : [
                  {
                    key: 'kubernetes.io/hostname',
                    operator: 'In',
                    values: [env.K8S_NODE_NAME]
                  }
                ])
          ]
        }
      ]
    }
  }
});

// For on-premise k8s
const getOnpremiseNodeAffinity = () => ({
  nodeAffinity: {
    requiredDuringSchedulingIgnoredDuringExecution: {
      nodeSelectorTerms: [
        {
          matchExpressions: [
            {
              key: 'kubernetes.io/hostname',
              operator: 'In',
              values: allPossibleNodeAffinity(env.K8S_NODE_NAME)
            }
          ]
        }
      ]
    }
  }
});

const getNodeAffinity = () => (env.ONPREMISE ? getOnpremiseNodeAffinity() : getCloudNodeAffinity());

// Worker v3
const getPodAffinity = jobGroup => ({
  podAffinity: {
    preferredDuringSchedulingIgnoredDuringExecution: [
      {
        weight: 100,
        podAffinityTerm: {
          topologyKey: 'kubernetes.io/hostname',
          labelSelector: {
            matchLabels: {
              'jobs-group': jobGroup
            }
          }
        }
      }
    ]
  }
});

const getVolumeMounts = (
  engineMountPoint,
  srcLocation,
  rootPath,
  excludePaths,
  engineCustomConfig
) => {
  // volume mount
  const volumeMounts = [
    // Remove for the moment.
    // {
    //   name: 'local-storage',
    //   mountPath: '/opt/output/',
    //   subPath: `output/${outputFolder}/`
    // }
  ];

  if (srcLocation) {
    volumeMounts.push({
      name: 'local-storage',
      mountPath: `/opt/mount/${engineMountPoint}${rootPath}`,
      readOnly: true,
      subPath: `${removeSlashTmpPrefixInPath(srcLocation)}/${rootPath}`
    });
  }

  if (excludePaths && excludePaths.length) {
    const overlays = [];
    for (const path of excludePaths) {
      // any rootPath will be the excludePath of the its parent, so we need to filter it to prevent duplicated mount
      if (path.indexOf(rootPath) === 0 && path !== rootPath) {
        overlays.push(path);
      }
    }

    // filter overlay if parent folder existed. e.g. ['/root/a/b', '/root/a'] -> ['/root/a']
    const filteredOverlays = [];
    for (const path of overlays) {
      if (!overlays.find(p => path.indexOf(p) === 0 && p.length < path.length)) {
        filteredOverlays.push(path);
      }
    }

    for (const path of filteredOverlays) {
      volumeMounts.push({
        name: 'empty-dir',
        readOnly: true,
        mountPath: `/opt/mount/${engineMountPoint}${path}`
      });
    }
  }

  if (engineCustomConfig) {
    volumeMounts.push({
      name: 'local-storage',
      mountPath: '/opt/config/',
      readOnly: true,
      subPath: removeSlashTmpPrefixInPath(engineCustomConfig)
    });
  }

  return volumeMounts;
};

const buildInitContainerSpecs = (
  jobGroup,
  fullSrcLocation,
  diffSrcLocation,
  configSrcLocation,
  scanRunType,
  envVar
) => ({
  name: 'init-scan',
  image: env.INIT_CONTAINER_IMG,
  imagePullPolicy: env.ENVIRONMENT === 'staging' ? 'Always' : 'IfNotPresent',
  resources: engineResources.default,
  env: [
    // redis
    {
      name: 'REDIS_ADDRESS',
      valueFrom: { secretKeyRef: { key: 'REDIS_HOST', name: 'secrets-manager' } }
    },
    {
      name: 'REDIS_PASSWORD',
      valueFrom: { secretKeyRef: { key: 'REDIS_PASSWORD', name: 'secrets-manager' } }
    },
    {
      name: 'CORE_API_URI',
      valueFrom: { secretKeyRef: { key: 'CORE_API_URI', name: 'secrets-manager' } }
    },
    {
      name: 'REDIS_POLLING_MODE',
      valueFrom: { secretKeyRef: { key: 'REDIS_POLLING_MODE', name: 'secrets-manager' } }
    },
    // general info
    { name: 'NODE_NAME', valueFrom: { fieldRef: { fieldPath: 'spec.nodeName' } } },
    { name: 'SCAN_ID', value: jobGroup },
    { name: 'SET_PREPARE_SOURCE_REQUEST_TTL', value: '2h' },
    {
      name: 'FULL_SOURCE_PATH',
      value: fullSrcLocation
    },
    {
      name: 'DIFF_SOURCE_PATH',
      value: diffSrcLocation
    },
    {
      name: 'CONFIG_SOURCE_PATH',
      value: configSrcLocation
    },
    { name: 'SCAN_TYPE', value: scanRunType },
    ...envVar
  ],
  volumeMounts: configSrcLocation
    ? [
        {
          name: 'local-storage',
          mountPath: configSrcLocation,
          subPath: removeSlashTmpPrefixInPath(configSrcLocation)
        }
      ]
    : []
});

const buildScanContainerSpecs = (engineImage, volumeMounts, podResource, envVar) => ({
  name: `scan`,
  image: engineImage,
  imagePullPolicy: env.ENVIRONMENT === 'staging' ? 'Always' : 'IfNotPresent',
  env: [...envVar],
  volumeMounts,
  ...(podResource && { resources: podResource })
});

const getVolumes = () => {
  if (env.ONPREMISE && env.ONPREMISE_K8S_STORAGE_MODE !== 'enable_hostpath') {
    return {
      name: 'local-storage',
      persistentVolumeClaim: {
        claimName:
          env.ONPREMISE_K8S_STORAGE_MODE === 'enable_disk'
            ? `local-storage-${process.env.HOSTNAME}`
            : 'nfs-claim'
      }
    };
  }
  return {
    name: 'local-storage',
    hostPath: {
      path: env.ONPREMISE ? env.ONPREMISE_K8S_STORAGE_PATH : env.STORAGE_PATH,
      type: 'Directory'
    }
  };
};

const buildJobTemplate = (
  name,
  jobGroup,
  initCont,
  scanCont,
  volumes,
  affinity,
  timeoutInMinutes
) => {
  return {
    kind: 'Job',
    metadata: {
      generateName: `${name}-`,
      labels: {
        'job-type': 'scan',
        'jobs-group': jobGroup,
        'worker-pod-name': env.K8S_POD_NAME
      }
    },
    spec: {
      completions: 1,
      parallelism: 1,
      backoffLimit: env.K8S_JOB_BACKOFFLIMIT,
      activeDeadlineSeconds: timeoutInMinutes * 60 * 2, // double timeout time to give buffer for prepare src code and get engineOutput result
      ttlSecondsAfterFinished: 300, // beta, not works without feature gate TTLAfterFinished=true
      template: {
        metadata: {
          generateName: `scan-job-${name}`,
          labels: {
            'pod-type': 'scan'
          }
        },
        spec: {
          imagePullSecrets: [{ name: 'docker-regcred' }],
          initContainers: env.FEATURE_ENGINE_RUN_V3 ? [initCont] : [],
          containers: [scanCont],
          affinity,
          restartPolicy: 'Never',
          volumes: [volumes, { name: 'empty-dir', emptyDir: {} }]
        }
      }
    }
  };
};

module.exports = {
  getNodeAffinity,
  getPodAffinity,
  getVolumes,
  getVolumeMounts,
  buildInitContainerSpecs,
  buildScanContainerSpecs,
  buildJobTemplate
};
