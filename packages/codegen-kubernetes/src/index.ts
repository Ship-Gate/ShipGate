// ============================================================================
// Kubernetes Codegen - Public API
// ============================================================================

import type { Domain, K8sGeneratorOptions, GeneratedFile } from './types.js';
import { DEFAULT_OPTIONS } from './types.js';
import * as manifests from './manifests.js';
import { generateHelmChart } from './helm.js';

export * from './types.js';
export * from './manifests.js';
export * from './helm.js';

/**
 * Kubernetes Code Generator
 * 
 * Generates Kubernetes manifests and Helm charts from ISL specifications.
 */
export class KubernetesGenerator {
  private options: Required<K8sGeneratorOptions>;

  constructor(options: Partial<K8sGeneratorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate all Kubernetes resources for a domain
   */
  generate(domain: Domain): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const name = domain.name.toLowerCase();

    // Base manifests
    files.push({
      path: `manifests/${name}/deployment.yaml`,
      content: this.toYaml(manifests.generateDeployment(domain, this.options)),
    });

    files.push({
      path: `manifests/${name}/service.yaml`,
      content: this.toYaml(manifests.generateService(domain, this.options)),
    });

    files.push({
      path: `manifests/${name}/ingress.yaml`,
      content: this.toYaml(manifests.generateIngress(domain, this.options)),
    });

    files.push({
      path: `manifests/${name}/configmap.yaml`,
      content: this.toYaml(manifests.generateConfigMap(domain, this.options)),
    });

    files.push({
      path: `manifests/${name}/secret.yaml`,
      content: this.toYaml(manifests.generateSecret(domain, this.options)),
    });

    files.push({
      path: `manifests/${name}/serviceaccount.yaml`,
      content: this.toYaml(manifests.generateServiceAccount(domain, this.options)),
    });

    if (this.options.includeHPA) {
      files.push({
        path: `manifests/${name}/hpa.yaml`,
        content: this.toYaml(manifests.generateHPA(domain, this.options)),
      });
    }

    if (this.options.includePDB) {
      files.push({
        path: `manifests/${name}/pdb.yaml`,
        content: this.toYaml(manifests.generatePDB(domain, this.options)),
      });
    }

    if (this.options.includeNetworkPolicies) {
      files.push({
        path: `manifests/${name}/networkpolicy.yaml`,
        content: this.toYaml(manifests.generateNetworkPolicy(domain, this.options)),
      });
    }

    // Kustomization
    if (this.options.generateKustomize) {
      files.push({
        path: `manifests/${name}/kustomization.yaml`,
        content: this.generateKustomization(domain),
      });
    }

    // Helm chart
    if (this.options.generateHelm) {
      files.push(...generateHelmChart(domain, this.options));
    }

    return files;
  }

  /**
   * Generate for multiple domains
   */
  generateAll(domains: Domain[]): GeneratedFile[] {
    const allFiles: GeneratedFile[] = [];

    for (const domain of domains) {
      allFiles.push(...this.generate(domain));
    }

    // Root kustomization
    if (this.options.generateKustomize) {
      allFiles.push({
        path: 'manifests/kustomization.yaml',
        content: this.generateRootKustomization(domains),
      });
    }

    return allFiles;
  }

  private toYaml(obj: object): string {
    return this.objectToYaml(obj, 0);
  }

  private objectToYaml(obj: unknown, indent: number): string {
    const spaces = '  '.repeat(indent);

    if (obj === null || obj === undefined) {
      return 'null';
    }

    if (typeof obj === 'string') {
      if (obj.includes('\n') || obj.includes(':') || obj.includes('#')) {
        return `|\n${obj.split('\n').map(line => spaces + '  ' + line).join('\n')}`;
      }
      return obj.includes(' ') || obj === '' ? `"${obj}"` : obj;
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      return obj.map(item => {
        if (typeof item === 'object' && item !== null) {
          const yaml = this.objectToYaml(item, indent + 1);
          const lines = yaml.split('\n');
          return `${spaces}- ${lines[0]}\n${lines.slice(1).map(l => spaces + '  ' + l).join('\n')}`.trim();
        }
        return `${spaces}- ${this.objectToYaml(item, 0)}`;
      }).join('\n');
    }

    if (typeof obj === 'object') {
      const entries = Object.entries(obj as Record<string, unknown>);
      if (entries.length === 0) return '{}';
      
      return entries.map(([key, value]) => {
        const valueYaml = this.objectToYaml(value, indent + 1);
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0) {
          return `${spaces}${key}:\n${valueYaml.split('\n').map(l => spaces + '  ' + l).join('\n')}`;
        }
        if (Array.isArray(value) && value.length > 0) {
          return `${spaces}${key}:\n${valueYaml}`;
        }
        return `${spaces}${key}: ${valueYaml}`;
      }).join('\n');
    }

    return String(obj);
  }

  private generateKustomization(domain: Domain): string {
    const name = domain.name.toLowerCase();
    const resources = [
      'deployment.yaml',
      'service.yaml',
      'configmap.yaml',
      'serviceaccount.yaml',
    ];

    if (this.options.includeHPA) resources.push('hpa.yaml');
    if (this.options.includePDB) resources.push('pdb.yaml');
    if (this.options.includeNetworkPolicies) resources.push('networkpolicy.yaml');

    return `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: ${this.options.namespace}

commonLabels:
  app: ${name}
  app.kubernetes.io/name: ${name}

resources:
${resources.map(r => `  - ${r}`).join('\n')}
`;
  }

  private generateRootKustomization(domains: Domain[]): string {
    return `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
${domains.map(d => `  - ${d.name.toLowerCase()}`).join('\n')}
`;
  }
}

export function createKubernetesGenerator(options?: Partial<K8sGeneratorOptions>): KubernetesGenerator {
  return new KubernetesGenerator(options);
}
