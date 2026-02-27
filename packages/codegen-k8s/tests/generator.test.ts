import { describe, it, expect } from 'vitest';
import { generate, generateCombined } from '../src/generator.js';
import type { Domain, GenerateOptions, K8sManifest } from '../src/types.js';
import { authDomain, paymentsDomain } from '../fixtures/domains.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function findManifest(manifests: K8sManifest[], kind: string): K8sManifest | undefined {
  return manifests.find((m) => m.kind === kind);
}

function findFile(files: { path: string; content: string; kind: string }[], kind: string) {
  return files.find((f) => f.kind === kind);
}

// ── K8s Schema Validation Helpers ───────────────────────────────────────────

/** Validates that a manifest has the required K8s structure */
function validateK8sManifest(manifest: K8sManifest): string[] {
  const errors: string[] = [];
  if (!manifest.apiVersion) errors.push('Missing apiVersion');
  if (!manifest.kind) errors.push('Missing kind');
  if (!manifest.metadata) errors.push('Missing metadata');
  if (!manifest.metadata?.name) errors.push('Missing metadata.name');
  // K8s name must be lowercase, alphanumeric, hyphens only, max 253 chars
  if (manifest.metadata?.name && !/^[a-z0-9][a-z0-9-]{0,251}[a-z0-9]?$/.test(manifest.metadata.name)) {
    errors.push(`Invalid metadata.name: "${manifest.metadata.name}" — must be lowercase DNS-compatible`);
  }
  // Labels must be valid
  if (manifest.metadata?.labels) {
    for (const [k, v] of Object.entries(manifest.metadata.labels)) {
      if (typeof v !== 'string') errors.push(`Label "${k}" value is not a string`);
    }
  }
  return errors;
}

function validateDeployment(d: K8sManifest): string[] {
  const errors = validateK8sManifest(d);
  const spec = d.spec as Record<string, unknown> | undefined;
  if (!spec) { errors.push('Deployment missing spec'); return errors; }
  if (typeof spec.replicas !== 'number') errors.push('Deployment missing spec.replicas');
  const selector = spec.selector as { matchLabels?: Record<string, string> } | undefined;
  if (!selector?.matchLabels) errors.push('Deployment missing spec.selector.matchLabels');
  const template = spec.template as { metadata?: { labels?: Record<string, string> }; spec?: { containers?: unknown[] } } | undefined;
  if (!template?.metadata?.labels) errors.push('Deployment missing template labels');
  if (!template?.spec?.containers || !Array.isArray(template.spec.containers) || template.spec.containers.length === 0) {
    errors.push('Deployment must have at least one container');
  }
  // selector.matchLabels must be a subset of template labels
  if (selector?.matchLabels && template?.metadata?.labels) {
    for (const [k, v] of Object.entries(selector.matchLabels)) {
      if (template.metadata.labels[k] !== v) {
        errors.push(`Selector label "${k}=${v}" not found in pod template labels`);
      }
    }
  }
  return errors;
}

function validateService(s: K8sManifest): string[] {
  const errors = validateK8sManifest(s);
  const spec = s.spec as { selector?: Record<string, string>; ports?: unknown[] } | undefined;
  if (!spec) { errors.push('Service missing spec'); return errors; }
  if (!spec.selector || Object.keys(spec.selector).length === 0) errors.push('Service missing spec.selector');
  if (!spec.ports || !Array.isArray(spec.ports) || spec.ports.length === 0) errors.push('Service must have at least one port');
  return errors;
}

function validateConfigMap(c: K8sManifest): string[] {
  const errors = validateK8sManifest(c);
  if (!('data' in c)) errors.push('ConfigMap missing data');
  return errors;
}

function validateSecret(s: K8sManifest): string[] {
  const errors = validateK8sManifest(s);
  if (!(s as { type?: string }).type) errors.push('Secret missing type');
  return errors;
}

function validateIngress(i: K8sManifest): string[] {
  const errors = validateK8sManifest(i);
  const spec = i.spec as { rules?: unknown[] } | undefined;
  if (!spec?.rules || !Array.isArray(spec.rules) || spec.rules.length === 0) {
    errors.push('Ingress must have at least one rule');
  }
  return errors;
}

/** Runs the appropriate validator based on manifest kind */
function dryRunValidate(manifest: K8sManifest): string[] {
  switch (manifest.kind) {
    case 'Deployment': return validateDeployment(manifest);
    case 'Service': return validateService(manifest);
    case 'ConfigMap': return validateConfigMap(manifest);
    case 'Secret': return validateSecret(manifest);
    case 'Ingress': return validateIngress(manifest);
    default: return validateK8sManifest(manifest);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('codegen-k8s', () => {

  // ── Auth Domain ─────────────────────────────────────────────────────────

  describe('UserAuthentication domain', () => {
    const result = generate(authDomain);

    it('generates 4 files (ConfigMap, Secret, Deployment, Service)', () => {
      expect(result.files).toHaveLength(4);
      expect(result.manifests).toHaveLength(4);
      const kinds = result.manifests.map((m) => m.kind).sort();
      expect(kinds).toEqual(['ConfigMap', 'Deployment', 'Secret', 'Service']);
    });

    it('all manifests pass dry-run validation', () => {
      for (const manifest of result.manifests) {
        const errors = dryRunValidate(manifest);
        expect(errors, `${manifest.kind} validation failed`).toEqual([]);
      }
    });

    it('Deployment selector matches pod template labels', () => {
      const dep = findManifest(result.manifests, 'Deployment')!;
      const spec = dep.spec as { selector: { matchLabels: Record<string, string> }; template: { metadata: { labels: Record<string, string> } } };
      for (const [k, v] of Object.entries(spec.selector.matchLabels)) {
        expect(spec.template.metadata.labels[k]).toBe(v);
      }
    });

    it('Service selector matches Deployment selector', () => {
      const dep = findManifest(result.manifests, 'Deployment')!;
      const svc = findManifest(result.manifests, 'Service')!;
      const depSelector = (dep.spec as { selector: { matchLabels: Record<string, string> } }).selector.matchLabels;
      const svcSelector = (svc.spec as { selector: Record<string, string> }).selector;
      for (const [k, v] of Object.entries(depSelector)) {
        expect(svcSelector[k]).toBe(v);
      }
    });

    it('ConfigMap contains DOMAIN_NAME and DOMAIN_VERSION', () => {
      const cm = findManifest(result.manifests, 'ConfigMap')!;
      const data = (cm as { data: Record<string, string> }).data;
      expect(data['DOMAIN_NAME']).toBe('UserAuthentication');
      expect(data['DOMAIN_VERSION']).toBe('1.0.0');
    });

    it('Secret contains password_hash as secret field', () => {
      const secret = findManifest(result.manifests, 'Secret')!;
      const stringData = (secret as { stringData: Record<string, string> }).stringData;
      expect(stringData).toHaveProperty('USER_PASSWORD_HASH');
      expect(stringData['USER_PASSWORD_HASH']).toContain('CHANGE_ME');
    });

    it('Deployment has correct image name', () => {
      const dep = findManifest(result.manifests, 'Deployment')!;
      const containers = ((dep.spec as Record<string, unknown>).template as Record<string, unknown>).spec as { containers: { image: string }[] };
      expect(containers.containers[0]!.image).toBe('user-authentication:1.0.0');
    });

    it('generates consistent labels across all manifests', () => {
      for (const manifest of result.manifests) {
        expect(manifest.metadata.labels!['app.kubernetes.io/name']).toBe('user-authentication');
        expect(manifest.metadata.labels!['app.kubernetes.io/version']).toBe('1.0.0');
        expect(manifest.metadata.labels!['app.kubernetes.io/managed-by']).toBe('isl-codegen-k8s');
      }
    });

    it('container port is 8080 (inferred from behaviors)', () => {
      const dep = findManifest(result.manifests, 'Deployment')!;
      const containers = ((dep.spec as Record<string, unknown>).template as Record<string, unknown>).spec as { containers: { ports: { containerPort: number }[] }[] };
      expect(containers.containers[0]!.ports[0]!.containerPort).toBe(8080);
    });
  });

  // ── Payments Domain ─────────────────────────────────────────────────────

  describe('Payments domain', () => {
    const result = generate(paymentsDomain);

    it('generates 4 files (ConfigMap, Secret, Deployment, Service)', () => {
      expect(result.files).toHaveLength(4);
      const kinds = result.manifests.map((m) => m.kind).sort();
      expect(kinds).toEqual(['ConfigMap', 'Deployment', 'Secret', 'Service']);
    });

    it('all manifests pass dry-run validation', () => {
      for (const manifest of result.manifests) {
        const errors = dryRunValidate(manifest);
        expect(errors, `${manifest.kind} validation failed`).toEqual([]);
      }
    });

    it('ConfigMap has Account entity fields', () => {
      const cm = findManifest(result.manifests, 'ConfigMap')!;
      const data = (cm as { data: Record<string, string> }).data;
      expect(data).toHaveProperty('ACCOUNT_ID');
      expect(data).toHaveProperty('ACCOUNT_BALANCE');
      expect(data).toHaveProperty('ACCOUNT_IS_ACTIVE');
    });

    it('Secret has empty stringData (no secret fields in Payments)', () => {
      const secret = findManifest(result.manifests, 'Secret')!;
      const stringData = (secret as { stringData: Record<string, string> }).stringData;
      expect(Object.keys(stringData)).toHaveLength(0);
    });

    it('naming uses kebab-case slug', () => {
      for (const manifest of result.manifests) {
        expect(manifest.metadata.name).toMatch(/^payments-/);
      }
    });
  });

  // ── Ingress Generation ────────────────────────────────────────────────

  describe('Ingress generation', () => {
    const opts: GenerateOptions = {
      ingress: { enabled: true, className: 'nginx', host: 'auth.example.com', tlsSecret: 'auth-tls' },
    };
    const result = generate(authDomain, opts);

    it('generates 5 files when ingress is enabled', () => {
      expect(result.files).toHaveLength(5);
      expect(result.manifests.map((m) => m.kind)).toContain('Ingress');
    });

    it('Ingress passes dry-run validation', () => {
      const ingress = findManifest(result.manifests, 'Ingress')!;
      const errors = dryRunValidate(ingress);
      expect(errors).toEqual([]);
    });

    it('Ingress has correct host and TLS', () => {
      const ingress = findManifest(result.manifests, 'Ingress')!;
      const spec = ingress.spec as { rules: { host: string }[]; tls: { hosts: string[]; secretName: string }[] };
      expect(spec.rules[0]!.host).toBe('auth.example.com');
      expect(spec.tls[0]!.secretName).toBe('auth-tls');
      expect(spec.tls[0]!.hosts).toContain('auth.example.com');
    });

    it('Ingress has paths for each behavior', () => {
      const ingress = findManifest(result.manifests, 'Ingress')!;
      const spec = ingress.spec as { rules: { http: { paths: { path: string }[] } }[] };
      const paths = spec.rules[0]!.http.paths.map((p) => p.path);
      expect(paths).toContain('/login');
      expect(paths).toContain('/logout');
      expect(paths).toContain('/register');
    });

    it('Ingress backend points to the service', () => {
      const ingress = findManifest(result.manifests, 'Ingress')!;
      const spec = ingress.spec as { rules: { http: { paths: { backend: { service: { name: string } } }[] } }[] };
      for (const p of spec.rules[0]!.http.paths) {
        expect(p.backend.service.name).toBe('user-authentication-service');
      }
    });
  });

  // ── Options / Overrides ───────────────────────────────────────────────

  describe('options and overrides', () => {
    it('respects namespace option', () => {
      const result = generate(paymentsDomain, { namespace: 'production' });
      for (const manifest of result.manifests) {
        expect(manifest.metadata.namespace).toBe('production');
      }
    });

    it('respects imageRegistry option', () => {
      const result = generate(paymentsDomain, { imageRegistry: 'ghcr.io/myorg' });
      const dep = findManifest(result.manifests, 'Deployment')!;
      const containers = ((dep.spec as Record<string, unknown>).template as Record<string, unknown>).spec as { containers: { image: string }[] };
      expect(containers.containers[0]!.image).toBe('ghcr.io/myorg/payments:1.0.0');
    });

    it('respects imageTag option', () => {
      const result = generate(paymentsDomain, { imageTag: 'latest' });
      const dep = findManifest(result.manifests, 'Deployment')!;
      const containers = ((dep.spec as Record<string, unknown>).template as Record<string, unknown>).spec as { containers: { image: string }[] };
      expect(containers.containers[0]!.image).toBe('payments:latest');
    });

    it('respects replicas option', () => {
      const result = generate(paymentsDomain, { replicas: 5 });
      const dep = findManifest(result.manifests, 'Deployment')!;
      expect((dep.spec as { replicas: number }).replicas).toBe(5);
    });

    it('respects containerPort option', () => {
      const result = generate(paymentsDomain, { containerPort: 3000 });
      const dep = findManifest(result.manifests, 'Deployment')!;
      const containers = ((dep.spec as Record<string, unknown>).template as Record<string, unknown>).spec as { containers: { ports: { containerPort: number }[] }[] };
      expect(containers.containers[0]!.ports[0]!.containerPort).toBe(3000);
    });

    it('respects custom resources', () => {
      const result = generate(paymentsDomain, {
        resources: { requests: { cpu: '250m', memory: '512Mi' }, limits: { cpu: '1', memory: '1Gi' } },
      });
      const dep = findManifest(result.manifests, 'Deployment')!;
      const containers = ((dep.spec as Record<string, unknown>).template as Record<string, unknown>).spec as { containers: { resources: { requests: Record<string, string>; limits: Record<string, string> } }[] };
      expect(containers.containers[0]!.resources.requests.cpu).toBe('250m');
      expect(containers.containers[0]!.resources.limits.memory).toBe('1Gi');
    });

    it('merges extraLabels into all manifests', () => {
      const result = generate(paymentsDomain, { extraLabels: { team: 'platform' } });
      for (const manifest of result.manifests) {
        expect(manifest.metadata.labels!['team']).toBe('platform');
      }
    });

    it('applies extraAnnotations to all manifests', () => {
      const result = generate(paymentsDomain, { extraAnnotations: { 'prometheus.io/scrape': 'true' } });
      for (const manifest of result.manifests) {
        expect(manifest.metadata.annotations!['prometheus.io/scrape']).toBe('true');
      }
    });

    it('generates JSON format when requested', () => {
      const result = generate(paymentsDomain, { format: 'json' });
      for (const file of result.files) {
        expect(file.path).toMatch(/\.json$/);
        expect(() => JSON.parse(file.content)).not.toThrow();
      }
    });
  });

  // ── Determinism ───────────────────────────────────────────────────────

  describe('deterministic output', () => {
    it('produces identical output on repeated calls (auth)', () => {
      const a = generate(authDomain);
      const b = generate(authDomain);
      expect(a.files.map((f) => f.content)).toEqual(b.files.map((f) => f.content));
    });

    it('produces identical output on repeated calls (payments)', () => {
      const a = generate(paymentsDomain);
      const b = generate(paymentsDomain);
      expect(a.files.map((f) => f.content)).toEqual(b.files.map((f) => f.content));
    });

    it('combined YAML is identical on repeated calls', () => {
      const a = generateCombined(authDomain);
      const b = generateCombined(authDomain);
      expect(a).toBe(b);
    });
  });

  // ── Dry-Run: full validation pass on all domains ──────────────────────

  describe('dry-run validation pass (all domains)', () => {
    const domains: [string, Domain][] = [
      ['UserAuthentication', authDomain],
      ['Payments', paymentsDomain],
    ];

    for (const [name, domain] of domains) {
      it(`${name}: every manifest passes schema dry-run`, () => {
        const result = generate(domain);
        for (const manifest of result.manifests) {
          const errors = dryRunValidate(manifest);
          expect(errors, `${name}/${manifest.kind}`).toEqual([]);
        }
      });
    }

    it('dry-run with ingress enabled passes', () => {
      const result = generate(authDomain, { ingress: { enabled: true } });
      for (const manifest of result.manifests) {
        const errors = dryRunValidate(manifest);
        expect(errors, `Ingress-enabled/${manifest.kind}`).toEqual([]);
      }
    });
  });

  // ── generateCombined ──────────────────────────────────────────────────

  describe('generateCombined', () => {
    it('produces a multi-doc YAML string', () => {
      const combined = generateCombined(authDomain);
      expect(typeof combined).toBe('string');
      expect(combined).toContain('kind: Deployment');
      expect(combined).toContain('kind: Service');
      expect(combined).toContain('kind: ConfigMap');
      expect(combined).toContain('kind: Secret');
    });

    it('contains separator between documents', () => {
      const combined = generateCombined(authDomain);
      // The multi-doc separator appears between manifests
      expect(combined).toContain('---');
    });
  });
});
