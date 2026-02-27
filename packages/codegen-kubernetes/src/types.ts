// ============================================================================
// Kubernetes Codegen Types
// ============================================================================

/**
 * Kubernetes resource types to generate
 */
export type K8sResourceType = 
  | 'Deployment'
  | 'Service'
  | 'ConfigMap'
  | 'Secret'
  | 'Ingress'
  | 'HorizontalPodAutoscaler'
  | 'PodDisruptionBudget'
  | 'ServiceAccount'
  | 'NetworkPolicy'
  | 'PersistentVolumeClaim';

/**
 * Generation options
 */
export interface K8sGeneratorOptions {
  /** Namespace */
  namespace?: string;
  
  /** Image registry */
  imageRegistry?: string;
  
  /** Image tag */
  imageTag?: string;
  
  /** Generate Helm chart */
  generateHelm?: boolean;
  
  /** Generate Kustomize */
  generateKustomize?: boolean;
  
  /** Include monitoring (Prometheus) */
  includeMonitoring?: boolean;
  
  /** Include network policies */
  includeNetworkPolicies?: boolean;
  
  /** Include HPA */
  includeHPA?: boolean;
  
  /** Include PDB */
  includePDB?: boolean;
  
  /** Resource requests */
  resources?: {
    requests: { cpu: string; memory: string };
    limits: { cpu: string; memory: string };
  };
  
  /** Replicas */
  replicas?: number;
  
  /** Labels */
  labels?: Record<string, string>;
  
  /** Annotations */
  annotations?: Record<string, string>;
}

export const DEFAULT_OPTIONS: Required<K8sGeneratorOptions> = {
  namespace: 'default',
  imageRegistry: '',
  imageTag: 'latest',
  generateHelm: true,
  generateKustomize: true,
  includeMonitoring: true,
  includeNetworkPolicies: true,
  includeHPA: true,
  includePDB: true,
  resources: {
    requests: { cpu: '100m', memory: '128Mi' },
    limits: { cpu: '500m', memory: '512Mi' },
  },
  replicas: 2,
  labels: {},
  annotations: {},
};

/**
 * Domain definition
 */
export interface Domain {
  name: string;
  description?: string;
  version?: string;
  behaviors: Behavior[];
  entities?: Entity[];
  config?: ServiceConfig;
}

export interface ServiceConfig {
  port?: number;
  healthPath?: string;
  readinessPath?: string;
  livenessPath?: string;
  env?: Record<string, string>;
  secrets?: string[];
  volumes?: VolumeConfig[];
}

export interface VolumeConfig {
  name: string;
  mountPath: string;
  type: 'configMap' | 'secret' | 'emptyDir' | 'pvc';
  size?: string;
}

export interface Behavior {
  name: string;
  temporal?: Array<{ operator: string; duration?: string; percentile?: number }>;
}

export interface Entity {
  name: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
}
