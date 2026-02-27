// ============================================================================
// Kubernetes Manifest Generator
// Transforms ISL domains into K8s Deployment, Service, ConfigMap, Secret, Ingress
// ============================================================================

import * as YAML from 'yaml';
import type {
  Domain,
  Field,
  Annotation,
  GenerateOptions,
  GeneratedFile,
  GeneratedOutput,
  K8sManifest,
  K8sDeployment,
  K8sService,
  K8sConfigMap,
  K8sSecret,
  K8sIngress,
  K8sContainer,
  K8sEnvVar,
} from './types.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function toKebabCase(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function toEnvKey(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toUpperCase();
}

function annotationName(a: Annotation): string {
  return typeof a.name === 'string' ? a.name : a.name.name;
}

function findAnnotation(annotations: Annotation[] | undefined, name: string): Annotation | undefined {
  return annotations?.find((a) => annotationName(a).toLowerCase() === name.toLowerCase());
}

function domainSlug(domain: Domain): string {
  return toKebabCase(domain.name);
}

function serializeManifest(manifest: K8sManifest, format: 'yaml' | 'json'): string {
  if (format === 'json') {
    return JSON.stringify(manifest, null, 2);
  }
  return YAML.stringify(manifest, { lineWidth: 0, sortMapEntries: false });
}

// ── Field Classification ────────────────────────────────────────────────────

interface ClassifiedFields {
  configVars: { key: string; value: string }[];
  secretVars: { key: string; placeholder: string }[];
}

function isSecretField(field: Field): boolean {
  const secretAnnotations = ['secret', 'sensitive', 'password', 'credential'];
  if (field.annotations?.some((a) => secretAnnotations.includes(annotationName(a).toLowerCase()))) {
    return true;
  }
  if (field.modifiers?.some((m) => secretAnnotations.includes(m.toLowerCase()))) {
    return true;
  }
  const secretNames = ['password', 'secret', 'token', 'key', 'credential', 'api_key', 'apikey'];
  return secretNames.some((s) => field.name.toLowerCase().includes(s));
}

function classifyDomainFields(domain: Domain): ClassifiedFields {
  const configVars: { key: string; value: string }[] = [];
  const secretVars: { key: string; placeholder: string }[] = [];
  const seen = new Set<string>();

  for (const entity of domain.entities ?? []) {
    for (const field of entity.fields) {
      const envKey = toEnvKey(`${entity.name}_${field.name}`);
      if (seen.has(envKey)) continue;
      seen.add(envKey);

      if (isSecretField(field)) {
        secretVars.push({ key: envKey, placeholder: `CHANGE_ME_${envKey}` });
      } else {
        configVars.push({ key: envKey, value: fieldDefaultValue(field) });
      }
    }
  }

  // Add DOMAIN_NAME and DOMAIN_VERSION as config
  if (!seen.has('DOMAIN_NAME')) {
    configVars.unshift({ key: 'DOMAIN_NAME', value: domain.name });
  }
  if (!seen.has('DOMAIN_VERSION')) {
    configVars.splice(1, 0, { key: 'DOMAIN_VERSION', value: domain.version });
  }

  return { configVars, secretVars };
}

function fieldDefaultValue(field: Field): string {
  if (field.default) return field.default;
  const typeName = resolveTypeName(field.type);
  switch (typeName) {
    case 'Boolean':
    case 'Bool':
      return 'false';
    case 'Int':
    case 'Integer':
    case 'Float':
    case 'Double':
    case 'Decimal':
      return '0';
    default:
      return '';
  }
}

function resolveTypeName(type: { kind: string; name?: string | { name: string } }): string {
  if ('name' in type && type.name) {
    return typeof type.name === 'string' ? type.name : type.name.name;
  }
  return '';
}

// ── Port Inference ──────────────────────────────────────────────────────────

function inferContainerPort(domain: Domain, options: GenerateOptions): number {
  if (options.containerPort) return options.containerPort;

  // Check for @port annotation on the domain
  const portAnnotation = findAnnotation(domain.annotations, 'port');
  if (portAnnotation?.value) {
    const v = typeof portAnnotation.value === 'number'
      ? portAnnotation.value
      : parseInt(String(portAnnotation.value), 10);
    if (!isNaN(v)) return v;
  }

  // If behaviors have route-like names, infer HTTP port
  const hasBehaviors = (domain.behaviors ?? []).length > 0;
  if (hasBehaviors) return 8080;

  return 8080;
}

// ── Label Builders ──────────────────────────────────────────────────────────

function buildLabels(domain: Domain, component: string, options: GenerateOptions): Record<string, string> {
  const slug = domainSlug(domain);
  const labels: Record<string, string> = {
    'app.kubernetes.io/name': slug,
    'app.kubernetes.io/component': component,
    'app.kubernetes.io/version': domain.version,
    'app.kubernetes.io/managed-by': 'isl-codegen-k8s',
  };
  if (options.extraLabels) {
    Object.assign(labels, options.extraLabels);
  }
  return labels;
}

function buildSelectorLabels(domain: Domain): Record<string, string> {
  return {
    'app.kubernetes.io/name': domainSlug(domain),
  };
}

function buildAnnotations(options: GenerateOptions): Record<string, string> | undefined {
  if (options.extraAnnotations && Object.keys(options.extraAnnotations).length > 0) {
    return { ...options.extraAnnotations };
  }
  return undefined;
}

// ── Manifest Builders ───────────────────────────────────────────────────────

function buildConfigMap(domain: Domain, classified: ClassifiedFields, options: GenerateOptions): K8sConfigMap {
  const slug = domainSlug(domain);
  const data: Record<string, string> = {};
  for (const cv of classified.configVars) {
    data[cv.key] = cv.value;
  }
  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: `${slug}-config`,
      namespace: options.namespace,
      labels: buildLabels(domain, 'config', options),
      annotations: buildAnnotations(options),
    },
    data,
  };
}

function buildSecret(domain: Domain, classified: ClassifiedFields, options: GenerateOptions): K8sSecret {
  const slug = domainSlug(domain);
  const stringData: Record<string, string> = {};
  for (const sv of classified.secretVars) {
    stringData[sv.key] = sv.placeholder;
  }
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      name: `${slug}-secret`,
      namespace: options.namespace,
      labels: buildLabels(domain, 'secret', options),
      annotations: buildAnnotations(options),
    },
    type: 'Opaque',
    stringData,
  };
}

function buildDeployment(domain: Domain, classified: ClassifiedFields, options: GenerateOptions): K8sDeployment {
  const slug = domainSlug(domain);
  const port = inferContainerPort(domain, options);
  const imageTag = options.imageTag ?? domain.version;
  const imageBase = options.imageRegistry ? `${options.imageRegistry}/${slug}` : slug;

  const envVars: K8sEnvVar[] = [];

  // Config vars from ConfigMap
  for (const cv of classified.configVars) {
    envVars.push({
      name: cv.key,
      valueFrom: { configMapKeyRef: { name: `${slug}-config`, key: cv.key } },
    });
  }

  // Secret vars from Secret
  for (const sv of classified.secretVars) {
    envVars.push({
      name: sv.key,
      valueFrom: { secretKeyRef: { name: `${slug}-secret`, key: sv.key } },
    });
  }

  const container: K8sContainer = {
    name: slug,
    image: `${imageBase}:${imageTag}`,
    ports: [{ containerPort: port, name: 'http', protocol: 'TCP' }],
    env: envVars.length > 0 ? envVars : undefined,
    resources: options.resources
      ? {
          requests: options.resources.requests,
          limits: options.resources.limits,
        }
      : {
          requests: { cpu: '100m', memory: '128Mi' },
          limits: { cpu: '500m', memory: '256Mi' },
        },
    livenessProbe: {
      httpGet: { path: '/healthz', port: port },
      initialDelaySeconds: 15,
      periodSeconds: 20,
    },
    readinessProbe: {
      httpGet: { path: '/readyz', port: port },
      initialDelaySeconds: 5,
      periodSeconds: 10,
    },
  };

  const selectorLabels = buildSelectorLabels(domain);
  const podLabels = { ...selectorLabels, ...buildLabels(domain, 'server', options) };

  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: `${slug}-deployment`,
      namespace: options.namespace,
      labels: buildLabels(domain, 'server', options),
      annotations: buildAnnotations(options),
    },
    spec: {
      replicas: options.replicas ?? 2,
      selector: { matchLabels: selectorLabels },
      template: {
        metadata: {
          labels: podLabels,
          annotations: buildAnnotations(options),
        },
        spec: {
          containers: [container],
        },
      },
    },
  };
}

function buildService(domain: Domain, options: GenerateOptions): K8sService {
  const slug = domainSlug(domain);
  const port = inferContainerPort(domain, options);

  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: `${slug}-service`,
      namespace: options.namespace,
      labels: buildLabels(domain, 'service', options),
      annotations: buildAnnotations(options),
    },
    spec: {
      type: 'ClusterIP',
      selector: buildSelectorLabels(domain),
      ports: [{ port: 80, targetPort: port, protocol: 'TCP', name: 'http' }],
    },
  };
}

function buildIngress(domain: Domain, options: GenerateOptions): K8sIngress | null {
  if (!options.ingress?.enabled) return null;

  const slug = domainSlug(domain);
  const host = options.ingress.host ?? `${slug}.local`;
  const port = 80;

  // Build path rules from behaviors
  const paths = (domain.behaviors ?? []).map((b) => ({
    path: `/${toKebabCase(b.name)}`,
    pathType: 'Prefix' as const,
    backend: {
      service: { name: `${slug}-service`, port: { number: port } },
    },
  }));

  // Always include a catch-all
  if (paths.length === 0 || !paths.some((p) => p.path === '/')) {
    paths.push({
      path: '/',
      pathType: 'Prefix',
      backend: {
        service: { name: `${slug}-service`, port: { number: port } },
      },
    });
  }

  const ingressAnnotations: Record<string, string> = {
    ...buildAnnotations(options),
    ...options.ingress.annotations,
  };

  const ingress: K8sIngress = {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name: `${slug}-ingress`,
      namespace: options.namespace,
      labels: buildLabels(domain, 'ingress', options),
      annotations: Object.keys(ingressAnnotations).length > 0 ? ingressAnnotations : undefined,
    },
    spec: {
      ingressClassName: options.ingress.className ?? 'nginx',
      rules: [
        {
          host,
          http: { paths },
        },
      ],
    },
  };

  if (options.ingress.tlsSecret) {
    ingress.spec.tls = [{ hosts: [host], secretName: options.ingress.tlsSecret }];
  }

  return ingress;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate Kubernetes manifests from an ISL domain.
 *
 * Produces: Deployment, Service, ConfigMap, Secret, and optionally Ingress.
 * All output is deterministic — sorted keys, stable ordering.
 */
export function generate(domain: Domain, options: GenerateOptions = {}): GeneratedOutput {
  const format = options.format ?? 'yaml';
  const ext = format === 'json' ? 'json' : 'yaml';
  const classified = classifyDomainFields(domain);
  const slug = domainSlug(domain);

  const manifests: K8sManifest[] = [];
  const files: GeneratedFile[] = [];

  // 1. ConfigMap
  const configMap = buildConfigMap(domain, classified, options);
  manifests.push(configMap);
  files.push({ path: `${slug}-configmap.${ext}`, content: serializeManifest(configMap, format), kind: 'ConfigMap' });

  // 2. Secret
  const secret = buildSecret(domain, classified, options);
  manifests.push(secret);
  files.push({ path: `${slug}-secret.${ext}`, content: serializeManifest(secret, format), kind: 'Secret' });

  // 3. Deployment
  const deployment = buildDeployment(domain, classified, options);
  manifests.push(deployment);
  files.push({ path: `${slug}-deployment.${ext}`, content: serializeManifest(deployment, format), kind: 'Deployment' });

  // 4. Service
  const service = buildService(domain, options);
  manifests.push(service);
  files.push({ path: `${slug}-service.${ext}`, content: serializeManifest(service, format), kind: 'Service' });

  // 5. Ingress (optional)
  const ingress = buildIngress(domain, options);
  if (ingress) {
    manifests.push(ingress);
    files.push({ path: `${slug}-ingress.${ext}`, content: serializeManifest(ingress, format), kind: 'Ingress' });
  }

  return { files, manifests };
}

/**
 * Generate a single combined YAML document (multi-doc) for all manifests.
 */
export function generateCombined(domain: Domain, options: GenerateOptions = {}): string {
  const result = generate(domain, { ...options, format: 'yaml' });
  return result.manifests
    .map((m) => YAML.stringify(m, { lineWidth: 0, sortMapEntries: false }))
    .join('---\n');
}
