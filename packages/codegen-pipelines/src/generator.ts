/**
 * Pipeline Generator
 * 
 * Main pipeline generation logic that analyzes domain specifications
 * and generates appropriate CI/CD configurations.
 */

import type { DomainDeclaration, BehaviorDeclaration, ComplianceStandard } from '@isl-lang/isl-core';
import { generateGitHubActions } from './platforms/github.js';
import { generateGitLabCI } from './platforms/gitlab.js';
import { generateCircleCI } from './platforms/circle.js';
import { generateJenkinsfile } from './platforms/jenkins.js';

export type Platform = 'github' | 'gitlab' | 'circle' | 'jenkins';

export interface GeneratorOptions {
  /** Target CI/CD platform */
  platform: Platform;
  /** Domain version for pipeline */
  version?: string;
  /** Source directory for ISL files */
  sourceDir?: string;
  /** Node.js version to use */
  nodeVersion?: string;
  /** Whether to include deploy stage */
  includeDeploy?: boolean;
  /** Deploy environment */
  deployEnvironment?: string;
  /** Custom deploy script */
  deployScript?: string;
  /** Branch to deploy from */
  deployBranch?: string;
  /** Maximum parallel jobs */
  maxParallel?: number;
}

export interface GeneratedFile {
  /** File path relative to repository root */
  path: string;
  /** File content */
  content: string;
}

export interface DomainAnalysis {
  /** Domain name */
  name: string;
  /** All behavior names */
  behaviors: string[];
  /** Whether domain has compliance requirements */
  hasCompliance: boolean;
  /** Specific compliance standards (PCI_DSS, GDPR, SOC2, etc.) */
  complianceStandards: string[];
  /** Whether behaviors have temporal requirements */
  hasTemporalRequirements: boolean;
  /** Whether domain has chaos scenarios defined */
  hasChaosScenarios: boolean;
  /** Whether behaviors have security requirements */
  hasSecurityRequirements: boolean;
  /** Number of entities */
  entityCount: number;
  /** Number of behaviors */
  behaviorCount: number;
}

/**
 * Analyze a domain to determine what pipeline stages are needed
 */
export function analyzeDomain(domain: DomainDeclaration): DomainAnalysis {
  const behaviors = domain.behaviors.map((b) => b.name.name);
  const complianceStandards = new Set<string>();
  let hasTemporalRequirements = false;
  let hasSecurityRequirements = false;

  for (const behavior of domain.behaviors) {
    // Check for compliance
    if (behavior.compliance) {
      for (const standard of behavior.compliance.standards) {
        complianceStandards.add(standard.name.name.toUpperCase());
      }
    }

    // Check for temporal requirements
    if (behavior.temporal && behavior.temporal.requirements.length > 0) {
      hasTemporalRequirements = true;
    }

    // Check for security requirements
    if (behavior.security && behavior.security.requirements.length > 0) {
      hasSecurityRequirements = true;
    }
  }

  // Check for global invariants that might indicate chaos testing
  const hasChaosScenarios = domain.invariants.some((inv) => 
    inv.name.name.toLowerCase().includes('chaos') ||
    inv.name.name.toLowerCase().includes('resilience')
  );

  return {
    name: domain.name.name,
    behaviors,
    hasCompliance: complianceStandards.size > 0,
    complianceStandards: Array.from(complianceStandards),
    hasTemporalRequirements,
    hasChaosScenarios,
    hasSecurityRequirements,
    entityCount: domain.entities.length,
    behaviorCount: domain.behaviors.length,
  };
}

/**
 * Check if compliance standards require security scanning
 */
export function requiresSecurityScanning(standards: string[]): boolean {
  const securitySensitiveStandards = ['PCI_DSS', 'PCI-DSS', 'SOC2', 'HIPAA', 'ISO27001'];
  return standards.some((s) => 
    securitySensitiveStandards.some((ss) => 
      s.toUpperCase().includes(ss.replace('_', '').replace('-', ''))
    )
  );
}

/**
 * Generate CI/CD pipeline configurations from an ISL domain
 */
export function generate(
  domain: DomainDeclaration,
  options: GeneratorOptions
): GeneratedFile[] {
  const analysis = analyzeDomain(domain);
  
  const config: PipelineConfig = {
    domain: analysis,
    options: {
      version: options.version ?? domain.version?.value ?? '1.0.0',
      sourceDir: options.sourceDir ?? 'src',
      nodeVersion: options.nodeVersion ?? '20',
      includeDeploy: options.includeDeploy ?? true,
      deployEnvironment: options.deployEnvironment ?? 'production',
      deployScript: options.deployScript ?? './deploy.sh',
      deployBranch: options.deployBranch ?? 'main',
      maxParallel: options.maxParallel ?? 4,
    },
  };

  switch (options.platform) {
    case 'github':
      return generateGitHubActions(config);
    case 'gitlab':
      return generateGitLabCI(config);
    case 'circle':
      return generateCircleCI(config);
    case 'jenkins':
      return generateJenkinsfile(config);
    default:
      throw new Error(`Unsupported platform: ${options.platform}`);
  }
}

/**
 * Internal pipeline configuration
 */
export interface PipelineConfig {
  domain: DomainAnalysis;
  options: Required<Omit<GeneratorOptions, 'platform'>>;
}
