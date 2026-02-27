/**
 * Compliance Evidence Collector
 * 
 * Collects and organizes evidence from ISL specifications and
 * verification results for compliance reporting.
 */

import type {
  Domain,
  VerifyResult,
  ComplianceEvidence,
  VerificationProof,
  ControlMapping,
  ComplianceFramework,
} from './types';

export interface EvidenceBundle {
  framework: ComplianceFramework;
  controlId: string;
  evidence: ComplianceEvidence[];
  verificationProofs: VerificationProof[];
  timestamp: string;
}

export interface EvidenceCollection {
  domain: string;
  version: string;
  collectedAt: string;
  bundles: EvidenceBundle[];
  summary: EvidenceSummary;
}

export interface EvidenceSummary {
  totalEvidence: number;
  islSpecEvidence: number;
  verificationEvidence: number;
  configurationEvidence: number;
  documentationEvidence: number;
  coveragePercentage: number;
}

export class EvidenceCollector {
  private domain: Domain;
  private verifyResults: VerifyResult[];

  constructor(domain: Domain, verifyResults: VerifyResult[] = []) {
    this.domain = domain;
    this.verifyResults = verifyResults;
  }

  collect(controlMappings: ControlMapping[], framework: ComplianceFramework): EvidenceCollection {
    const bundles: EvidenceBundle[] = [];
    const timestamp = new Date().toISOString();

    for (const mapping of controlMappings) {
      const bundle = this.collectForControl(mapping, framework, timestamp);
      bundles.push(bundle);
    }

    const summary = this.summarize(bundles);

    return {
      domain: this.domain.name,
      version: this.domain.version,
      collectedAt: timestamp,
      bundles,
      summary,
    };
  }

  private collectForControl(
    mapping: ControlMapping,
    framework: ComplianceFramework,
    timestamp: string
  ): EvidenceBundle {
    const evidence: ComplianceEvidence[] = [...mapping.evidence];
    const verificationProofs: VerificationProof[] = [];

    // Add verification evidence
    for (const result of this.verifyResults) {
      // Check if this verification is relevant to the control
      if (this.isVerificationRelevant(result, mapping)) {
        evidence.push({
          type: 'verification',
          source: `verification:${result.behavior}`,
          content: `Verified with score ${result.score}/100`,
          timestamp: result.timestamp,
        });

        verificationProofs.push({
          behavior: result.behavior,
          verified: result.passed,
          score: result.score,
          proofBundle: result.proofBundle,
        });
      }
    }

    // Add ISL specification evidence
    const islEvidence = this.extractISLEvidence(mapping.controlId, framework);
    evidence.push(...islEvidence);

    return {
      framework,
      controlId: mapping.controlId,
      evidence,
      verificationProofs,
      timestamp,
    };
  }

  private isVerificationRelevant(result: VerifyResult, mapping: ControlMapping): boolean {
    // Check if the verified behavior relates to this control
    const behavior = this.domain.behaviors.find(b => b.name === result.behavior);
    if (!behavior) return false;

    // Check by control category
    const controlLower = mapping.controlName.toLowerCase();
    
    // Authentication controls
    if (controlLower.includes('auth') && behavior.security?.authentication) {
      return true;
    }

    // Audit controls
    if (controlLower.includes('audit') && behavior.observability?.logs) {
      return true;
    }

    // Validation controls
    if (controlLower.includes('validation') || controlLower.includes('integrity')) {
      if (behavior.preconditions?.length || behavior.postconditions?.length) {
        return true;
      }
    }

    // Data protection controls
    if (controlLower.includes('protect') || controlLower.includes('encrypt')) {
      if (behavior.security?.encryption) {
        return true;
      }
    }

    return false;
  }

  private extractISLEvidence(controlId: string, framework: ComplianceFramework): ComplianceEvidence[] {
    const evidence: ComplianceEvidence[] = [];

    // Extract type-level evidence
    for (const type of this.domain.types) {
      const typeEvidence = this.extractTypeEvidence(type, controlId, framework);
      evidence.push(...typeEvidence);
    }

    // Extract behavior-level evidence
    for (const behavior of this.domain.behaviors) {
      const behaviorEvidence = this.extractBehaviorEvidence(behavior, controlId, framework);
      evidence.push(...behaviorEvidence);
    }

    // Extract actor-level evidence
    if (this.domain.actors) {
      const actorEvidence = this.extractActorEvidence(controlId, framework);
      evidence.push(...actorEvidence);
    }

    return evidence;
  }

  private extractTypeEvidence(
    type: { name: string; fields: Array<{ name: string; annotations?: string[] }> },
    controlId: string,
    framework: ComplianceFramework
  ): ComplianceEvidence[] {
    const evidence: ComplianceEvidence[] = [];

    for (const field of type.fields) {
      if (!field.annotations) continue;

      // Check for relevant annotations based on framework
      const relevantAnnotations = this.getRelevantAnnotations(framework, controlId);
      
      for (const annotation of field.annotations) {
        if (relevantAnnotations.some(ra => annotation.includes(ra))) {
          evidence.push({
            type: 'isl_spec',
            source: `${type.name}.${field.name}`,
            content: `Field annotated: ${annotation}`,
          });
        }
      }
    }

    return evidence;
  }

  private extractBehaviorEvidence(
    behavior: Domain['behaviors'][0],
    controlId: string,
    framework: ComplianceFramework
  ): ComplianceEvidence[] {
    const evidence: ComplianceEvidence[] = [];

    // Security specs
    if (behavior.security) {
      if (behavior.security.authentication) {
        evidence.push({
          type: 'isl_spec',
          source: `${behavior.name}.security`,
          content: `Authentication: ${behavior.security.authentication}`,
        });
      }

      if (behavior.security.rateLimit) {
        evidence.push({
          type: 'isl_spec',
          source: `${behavior.name}.security.rateLimit`,
          content: `Rate limit: ${behavior.security.rateLimit.requests}/${behavior.security.rateLimit.window}`,
        });
      }

      if (behavior.security.encryption) {
        evidence.push({
          type: 'isl_spec',
          source: `${behavior.name}.security.encryption`,
          content: `Encryption: ${behavior.security.encryption.algorithm || 'enabled'}`,
        });
      }
    }

    // Observability specs
    if (behavior.observability) {
      if (behavior.observability.logs?.length) {
        evidence.push({
          type: 'isl_spec',
          source: `${behavior.name}.observability.logs`,
          content: `${behavior.observability.logs.length} log statements defined`,
        });
      }

      if (behavior.observability.metrics?.length) {
        evidence.push({
          type: 'isl_spec',
          source: `${behavior.name}.observability.metrics`,
          content: `Metrics: ${behavior.observability.metrics.join(', ')}`,
        });
      }
    }

    // Preconditions/Postconditions
    if (behavior.preconditions?.length) {
      evidence.push({
        type: 'isl_spec',
        source: `${behavior.name}.preconditions`,
        content: `${behavior.preconditions.length} preconditions: ${behavior.preconditions.map(p => p.name).join(', ')}`,
      });
    }

    if (behavior.postconditions?.length) {
      evidence.push({
        type: 'isl_spec',
        source: `${behavior.name}.postconditions`,
        content: `${behavior.postconditions.length} postconditions: ${behavior.postconditions.map(p => p.name).join(', ')}`,
      });
    }

    // Framework-specific compliance
    if (behavior.compliance) {
      const frameworkCompliance = behavior.compliance[framework.replace('-', '_') as keyof typeof behavior.compliance];
      if (frameworkCompliance) {
        for (const [key, value] of Object.entries(frameworkCompliance)) {
          evidence.push({
            type: 'isl_spec',
            source: `${behavior.name}.compliance.${framework}`,
            content: `${key}: ${value}`,
          });
        }
      }
    }

    return evidence;
  }

  private extractActorEvidence(controlId: string, framework: ComplianceFramework): ComplianceEvidence[] {
    const evidence: ComplianceEvidence[] = [];

    if (!this.domain.actors) return evidence;

    for (const actor of this.domain.actors) {
      evidence.push({
        type: 'isl_spec',
        source: `actor:${actor.name}`,
        content: `Actor with permissions: ${actor.permissions.join(', ')}`,
      });

      if (actor.authentication) {
        evidence.push({
          type: 'isl_spec',
          source: `actor:${actor.name}.authentication`,
          content: `Authentication: ${actor.authentication}`,
        });
      }
    }

    return evidence;
  }

  private getRelevantAnnotations(framework: ComplianceFramework, controlId: string): string[] {
    // Return annotations relevant to each framework
    switch (framework) {
      case 'pci-dss':
        return ['[sensitive]', '[secret]', '[payment]', '[card]', '[encrypted]', '[masked]'];
      case 'soc2':
        return ['[sensitive]', '[secret]', '[confidential]', '[audit]'];
      case 'hipaa':
        return ['[phi]', '[health]', '[medical]', '[sensitive]', '[encrypted]'];
      case 'gdpr':
        return ['[personal_data]', '[pii]', '[sensitive]', '[consent]'];
      case 'eu-ai-act':
        return ['[ai_generated]', '[training_data]', '[sensitive]', '[biometric]'];
      case 'fedramp':
        return ['[sensitive]', '[secret]', '[cui]', '[fouo]', '[pii]'];
      default:
        return ['[sensitive]', '[secret]'];
    }
  }

  private summarize(bundles: EvidenceBundle[]): EvidenceSummary {
    let totalEvidence = 0;
    let islSpecEvidence = 0;
    let verificationEvidence = 0;
    let configurationEvidence = 0;
    let documentationEvidence = 0;

    for (const bundle of bundles) {
      for (const evidence of bundle.evidence) {
        totalEvidence++;
        switch (evidence.type) {
          case 'isl_spec':
            islSpecEvidence++;
            break;
          case 'verification':
            verificationEvidence++;
            break;
          case 'configuration':
            configurationEvidence++;
            break;
          case 'documentation':
            documentationEvidence++;
            break;
        }
      }
    }

    // Calculate coverage (controls with evidence / total controls)
    const controlsWithEvidence = bundles.filter(b => b.evidence.length > 0).length;
    const coveragePercentage = bundles.length > 0 
      ? Math.round((controlsWithEvidence / bundles.length) * 100)
      : 0;

    return {
      totalEvidence,
      islSpecEvidence,
      verificationEvidence,
      configurationEvidence,
      documentationEvidence,
      coveragePercentage,
    };
  }

  /**
   * Generate a proof bundle reference for a behavior
   */
  generateProofBundleId(behavior: string): string {
    const timestamp = Date.now().toString(36);
    const hash = this.simpleHash(behavior);
    return `bundle-${hash}-${timestamp}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 6);
  }
}

export function collectEvidence(
  domain: Domain,
  controlMappings: ControlMapping[],
  framework: ComplianceFramework,
  verifyResults?: VerifyResult[]
): EvidenceCollection {
  const collector = new EvidenceCollector(domain, verifyResults);
  return collector.collect(controlMappings, framework);
}
