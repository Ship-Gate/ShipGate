// ============================================================================
// Kubernetes Manifest Generator
// ============================================================================

import type { Domain, K8sGeneratorOptions } from './types.js';
import { DEFAULT_OPTIONS } from './types.js';

/**
 * Generate Deployment manifest
 */
export function generateDeployment(domain: Domain, options: Required<K8sGeneratorOptions>): object {
  const name = domain.name.toLowerCase();
  const port = domain.config?.port ?? 8080;

  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name,
      namespace: options.namespace,
      labels: {
        app: name,
        'app.kubernetes.io/name': name,
        'app.kubernetes.io/version': domain.version ?? '1.0.0',
        ...options.labels,
      },
      annotations: options.annotations,
    },
    spec: {
      replicas: options.replicas,
      selector: {
        matchLabels: { app: name },
      },
      template: {
        metadata: {
          labels: {
            app: name,
            ...options.labels,
          },
          annotations: {
            'prometheus.io/scrape': 'true',
            'prometheus.io/port': String(port),
            'prometheus.io/path': '/metrics',
            ...options.annotations,
          },
        },
        spec: {
          serviceAccountName: name,
          containers: [
            {
              name,
              image: `${options.imageRegistry ? options.imageRegistry + '/' : ''}${name}:${options.imageTag}`,
              imagePullPolicy: 'IfNotPresent',
              ports: [
                { name: 'http', containerPort: port, protocol: 'TCP' },
              ],
              env: generateEnvVars(domain, options),
              resources: options.resources,
              livenessProbe: {
                httpGet: {
                  path: domain.config?.livenessPath ?? '/health/live',
                  port: 'http',
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 3,
              },
              readinessProbe: {
                httpGet: {
                  path: domain.config?.readinessPath ?? '/health/ready',
                  port: 'http',
                },
                initialDelaySeconds: 5,
                periodSeconds: 5,
                timeoutSeconds: 3,
                failureThreshold: 3,
              },
              securityContext: {
                runAsNonRoot: true,
                runAsUser: 1000,
                allowPrivilegeEscalation: false,
                readOnlyRootFilesystem: true,
                capabilities: { drop: ['ALL'] },
              },
              volumeMounts: generateVolumeMounts(domain),
            },
          ],
          volumes: generateVolumes(domain, options),
          securityContext: {
            fsGroup: 1000,
          },
          affinity: {
            podAntiAffinity: {
              preferredDuringSchedulingIgnoredDuringExecution: [
                {
                  weight: 100,
                  podAffinityTerm: {
                    labelSelector: { matchLabels: { app: name } },
                    topologyKey: 'kubernetes.io/hostname',
                  },
                },
              ],
            },
          },
        },
      },
    },
  };
}

/**
 * Generate Service manifest
 */
export function generateService(domain: Domain, options: Required<K8sGeneratorOptions>): object {
  const name = domain.name.toLowerCase();
  const port = domain.config?.port ?? 8080;

  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name,
      namespace: options.namespace,
      labels: {
        app: name,
        ...options.labels,
      },
    },
    spec: {
      type: 'ClusterIP',
      selector: { app: name },
      ports: [
        {
          name: 'http',
          port: 80,
          targetPort: port,
          protocol: 'TCP',
        },
      ],
    },
  };
}

/**
 * Generate Ingress manifest
 */
export function generateIngress(domain: Domain, options: Required<K8sGeneratorOptions>): object {
  const name = domain.name.toLowerCase();

  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name,
      namespace: options.namespace,
      labels: { app: name, ...options.labels },
      annotations: {
        'kubernetes.io/ingress.class': 'nginx',
        'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
        ...options.annotations,
      },
    },
    spec: {
      tls: [
        {
          hosts: [`${name}.example.com`],
          secretName: `${name}-tls`,
        },
      ],
      rules: [
        {
          host: `${name}.example.com`,
          http: {
            paths: [
              {
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: { name, port: { number: 80 } },
                },
              },
            ],
          },
        },
      ],
    },
  };
}

/**
 * Generate ConfigMap
 */
export function generateConfigMap(domain: Domain, options: Required<K8sGeneratorOptions>): object {
  const name = domain.name.toLowerCase();

  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: `${name}-config`,
      namespace: options.namespace,
      labels: { app: name, ...options.labels },
    },
    data: {
      'config.json': JSON.stringify({
        service: name,
        version: domain.version ?? '1.0.0',
        ...domain.config?.env,
      }, null, 2),
    },
  };
}

/**
 * Generate Secret template
 */
export function generateSecret(domain: Domain, options: Required<K8sGeneratorOptions>): object {
  const name = domain.name.toLowerCase();

  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      name: `${name}-secrets`,
      namespace: options.namespace,
      labels: { app: name, ...options.labels },
    },
    type: 'Opaque',
    stringData: {
      // Placeholder - actual secrets should be managed externally
      'DATABASE_URL': '{{ .Values.secrets.databaseUrl }}',
      'API_KEY': '{{ .Values.secrets.apiKey }}',
    },
  };
}

/**
 * Generate HorizontalPodAutoscaler
 */
export function generateHPA(domain: Domain, options: Required<K8sGeneratorOptions>): object {
  const name = domain.name.toLowerCase();

  // Derive scaling params from temporal specs
  const latencyBudget = getLatencyBudget(domain);

  return {
    apiVersion: 'autoscaling/v2',
    kind: 'HorizontalPodAutoscaler',
    metadata: {
      name,
      namespace: options.namespace,
      labels: { app: name, ...options.labels },
    },
    spec: {
      scaleTargetRef: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name,
      },
      minReplicas: options.replicas,
      maxReplicas: options.replicas * 5,
      metrics: [
        {
          type: 'Resource',
          resource: {
            name: 'cpu',
            target: { type: 'Utilization', averageUtilization: 70 },
          },
        },
        {
          type: 'Resource',
          resource: {
            name: 'memory',
            target: { type: 'Utilization', averageUtilization: 80 },
          },
        },
      ],
      behavior: {
        scaleDown: {
          stabilizationWindowSeconds: 300,
          policies: [
            { type: 'Percent', value: 10, periodSeconds: 60 },
          ],
        },
        scaleUp: {
          stabilizationWindowSeconds: 0,
          policies: [
            { type: 'Percent', value: 100, periodSeconds: 15 },
            { type: 'Pods', value: 4, periodSeconds: 15 },
          ],
          selectPolicy: 'Max',
        },
      },
    },
  };
}

/**
 * Generate PodDisruptionBudget
 */
export function generatePDB(domain: Domain, options: Required<K8sGeneratorOptions>): object {
  const name = domain.name.toLowerCase();

  return {
    apiVersion: 'policy/v1',
    kind: 'PodDisruptionBudget',
    metadata: {
      name,
      namespace: options.namespace,
      labels: { app: name, ...options.labels },
    },
    spec: {
      minAvailable: '50%',
      selector: { matchLabels: { app: name } },
    },
  };
}

/**
 * Generate ServiceAccount
 */
export function generateServiceAccount(domain: Domain, options: Required<K8sGeneratorOptions>): object {
  const name = domain.name.toLowerCase();

  return {
    apiVersion: 'v1',
    kind: 'ServiceAccount',
    metadata: {
      name,
      namespace: options.namespace,
      labels: { app: name, ...options.labels },
    },
  };
}

/**
 * Generate NetworkPolicy
 */
export function generateNetworkPolicy(domain: Domain, options: Required<K8sGeneratorOptions>): object {
  const name = domain.name.toLowerCase();

  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: {
      name,
      namespace: options.namespace,
      labels: { app: name, ...options.labels },
    },
    spec: {
      podSelector: { matchLabels: { app: name } },
      policyTypes: ['Ingress', 'Egress'],
      ingress: [
        {
          from: [
            { namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': options.namespace } } },
          ],
          ports: [{ protocol: 'TCP', port: domain.config?.port ?? 8080 }],
        },
      ],
      egress: [
        { to: [{ namespaceSelector: {} }] }, // Allow all egress within cluster
        {
          to: [{ ipBlock: { cidr: '0.0.0.0/0', except: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'] } }],
          ports: [
            { protocol: 'TCP', port: 443 },
            { protocol: 'TCP', port: 53 },
            { protocol: 'UDP', port: 53 },
          ],
        },
      ],
    },
  };
}

// Helper functions
function generateEnvVars(domain: Domain, options: Required<K8sGeneratorOptions>): object[] {
  const env: object[] = [
    { name: 'SERVICE_NAME', value: domain.name.toLowerCase() },
    { name: 'SERVICE_VERSION', value: domain.version ?? '1.0.0' },
    { name: 'PORT', value: String(domain.config?.port ?? 8080) },
  ];

  // Add config env vars
  if (domain.config?.env) {
    for (const [key, value] of Object.entries(domain.config.env)) {
      env.push({ name: key, value });
    }
  }

  // Add secret refs
  if (domain.config?.secrets) {
    for (const secret of domain.config.secrets) {
      env.push({
        name: secret,
        valueFrom: {
          secretKeyRef: {
            name: `${domain.name.toLowerCase()}-secrets`,
            key: secret,
          },
        },
      });
    }
  }

  return env;
}

function generateVolumeMounts(domain: Domain): object[] {
  const mounts: object[] = [
    { name: 'tmp', mountPath: '/tmp' },
    { name: 'config', mountPath: '/app/config', readOnly: true },
  ];

  if (domain.config?.volumes) {
    for (const vol of domain.config.volumes) {
      mounts.push({ name: vol.name, mountPath: vol.mountPath, readOnly: vol.type !== 'emptyDir' });
    }
  }

  return mounts;
}

function generateVolumes(domain: Domain, options: Required<K8sGeneratorOptions>): object[] {
  const name = domain.name.toLowerCase();
  const volumes: object[] = [
    { name: 'tmp', emptyDir: {} },
    { name: 'config', configMap: { name: `${name}-config` } },
  ];

  if (domain.config?.volumes) {
    for (const vol of domain.config.volumes) {
      switch (vol.type) {
        case 'configMap':
          volumes.push({ name: vol.name, configMap: { name: vol.name } });
          break;
        case 'secret':
          volumes.push({ name: vol.name, secret: { secretName: vol.name } });
          break;
        case 'emptyDir':
          volumes.push({ name: vol.name, emptyDir: {} });
          break;
        case 'pvc':
          volumes.push({ name: vol.name, persistentVolumeClaim: { claimName: vol.name } });
          break;
      }
    }
  }

  return volumes;
}

function getLatencyBudget(domain: Domain): number {
  for (const behavior of domain.behaviors) {
    if (behavior.temporal) {
      for (const spec of behavior.temporal) {
        if (spec.operator === 'within' && spec.duration) {
          const match = spec.duration.match(/^(\d+)(ms|s)$/);
          if (match) {
            const value = parseInt(match[1]!, 10);
            return match[2] === 's' ? value * 1000 : value;
          }
        }
      }
    }
  }
  return 500; // Default 500ms
}
