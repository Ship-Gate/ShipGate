// ============================================================================
// Kubernetes Generator Types
// ============================================================================

// ── ISL AST Types (compatible with both old and new AST structures) ──────────

export interface Domain {
  name: string;
  version: string;
  entities?: Entity[];
  types?: TypeDeclaration[];
  behaviors?: Behavior[];
  scenarios?: unknown[];
  policies?: unknown[];
  annotations?: Annotation[];
}

export interface Entity {
  name: string;
  fields: Field[];
  invariants?: unknown[];
  annotations?: Annotation[];
}

export interface TypeDeclaration {
  name: string;
  definition?: {
    kind: 'enum' | 'struct' | 'primitive';
    name?: string;
    values?: { name: string }[];
    fields?: Field[];
  };
  baseType?: TypeExpression;
  constraints?: TypeConstraint[];
  annotations?: Annotation[];
}

export interface Field {
  name: string;
  type: TypeExpression;
  optional: boolean;
  annotations?: Annotation[];
  constraints?: TypeConstraint[];
  modifiers?: string[];
  default?: string;
}

export interface TypeConstraint {
  kind?: string;
  name?: string | { name: string };
  value?: unknown;
}

export interface Annotation {
  name: string | { name: string };
  value?: unknown;
}

export interface Behavior {
  name: string;
  description?: string;
  input?: {
    fields: Field[];
  };
  output?: {
    success?: TypeExpression;
    errors?: ErrorDefinition[];
  };
  preconditions?: unknown[];
  postconditions?: unknown[];
  annotations?: Annotation[];
}

export interface ErrorDefinition {
  name: string | { name: string };
  fields?: Field[];
  when?: string;
  retriable?: boolean;
}

export type TypeExpression =
  | { kind: 'primitive'; name: string }
  | { kind: 'reference'; name: string }
  | { kind: 'list'; elementType: TypeExpression }
  | { kind: 'map'; keyType?: TypeExpression; valueType: TypeExpression }
  | { kind: 'optional'; innerType: TypeExpression }
  | { kind: 'union'; variants: TypeExpression[] }
  | { kind: 'SimpleType'; name: string | { name: string } }
  | { kind: 'GenericType'; name: string | { name: string }; typeArguments: TypeExpression[] }
  | { kind: 'ObjectType'; fields: Field[] };

// ── K8s Generation Options ──────────────────────────────────────────────────

export interface GenerateOptions {
  /** Kubernetes namespace for all resources */
  namespace?: string;
  /** Container image registry prefix (e.g. "ghcr.io/myorg") */
  imageRegistry?: string;
  /** Container image tag (default: domain version) */
  imageTag?: string;
  /** Default replica count */
  replicas?: number;
  /** Default container port (inferred from behaviors if not set) */
  containerPort?: number;
  /** Generate Ingress resource */
  ingress?: IngressOptions;
  /** Extra labels applied to all resources */
  extraLabels?: Record<string, string>;
  /** Extra annotations applied to all resources */
  extraAnnotations?: Record<string, string>;
  /** Resource limits/requests */
  resources?: ResourceSpec;
  /** Output format */
  format?: 'yaml' | 'json';
  /** Generate per-behavior deployments (microservice style) vs single deployment */
  splitServices?: boolean;
}

export interface IngressOptions {
  /** Enable ingress generation */
  enabled: boolean;
  /** Ingress class name (e.g. "nginx") */
  className?: string;
  /** Hostname for the ingress */
  host?: string;
  /** TLS secret name */
  tlsSecret?: string;
  /** Extra ingress annotations */
  annotations?: Record<string, string>;
}

export interface ResourceSpec {
  requests?: { cpu?: string; memory?: string };
  limits?: { cpu?: string; memory?: string };
}

// ── K8s Manifest Types ──────────────────────────────────────────────────────

export interface K8sMetadata {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface K8sManifest {
  apiVersion: string;
  kind: string;
  metadata: K8sMetadata;
  [key: string]: unknown;
}

export interface K8sDeployment extends K8sManifest {
  kind: 'Deployment';
  spec: {
    replicas: number;
    selector: { matchLabels: Record<string, string> };
    template: {
      metadata: { labels: Record<string, string>; annotations?: Record<string, string> };
      spec: {
        containers: K8sContainer[];
        restartPolicy?: string;
      };
    };
  };
}

export interface K8sContainer {
  name: string;
  image: string;
  ports: { containerPort: number; name?: string; protocol?: string }[];
  env?: K8sEnvVar[];
  envFrom?: K8sEnvFrom[];
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  livenessProbe?: K8sProbe;
  readinessProbe?: K8sProbe;
}

export interface K8sEnvVar {
  name: string;
  value?: string;
  valueFrom?: {
    secretKeyRef?: { name: string; key: string };
    configMapKeyRef?: { name: string; key: string };
  };
}

export interface K8sEnvFrom {
  configMapRef?: { name: string };
  secretRef?: { name: string };
}

export interface K8sProbe {
  httpGet?: { path: string; port: number | string };
  initialDelaySeconds?: number;
  periodSeconds?: number;
}

export interface K8sService extends K8sManifest {
  kind: 'Service';
  spec: {
    type?: string;
    selector: Record<string, string>;
    ports: { port: number; targetPort: number | string; protocol?: string; name?: string }[];
  };
}

export interface K8sConfigMap extends K8sManifest {
  kind: 'ConfigMap';
  data: Record<string, string>;
}

export interface K8sSecret extends K8sManifest {
  kind: 'Secret';
  type: string;
  data?: Record<string, string>;
  stringData?: Record<string, string>;
}

export interface K8sIngress extends K8sManifest {
  kind: 'Ingress';
  spec: {
    ingressClassName?: string;
    tls?: { hosts: string[]; secretName: string }[];
    rules: {
      host?: string;
      http: {
        paths: {
          path: string;
          pathType: string;
          backend: {
            service: { name: string; port: { number: number } };
          };
        }[];
      };
    }[];
  };
}

// ── Output ──────────────────────────────────────────────────────────────────

export interface GeneratedFile {
  path: string;
  content: string;
  kind: string;
}

export interface GeneratedOutput {
  files: GeneratedFile[];
  manifests: K8sManifest[];
}
