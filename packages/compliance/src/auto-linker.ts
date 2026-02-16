/**
 * Verification-to-Control Auto-Linker
 *
 * Automatically maps ShipGate verification results (trust scores, gate
 * verdicts, security findings, proof bundles) to compliance framework
 * controls — eliminating manual mapping and spreadsheets.
 *
 * This is the "no manual mapping" engine. Every verification signal
 * is automatically linked to the compliance controls it satisfies.
 */

import type {
  ComplianceFramework,
  ControlMapping,
  ComplianceEvidence,
  RiskLevel,
  VerifyResult,
  Domain,
} from './types';
import { ComplianceGenerator } from './generator';

/** A verification signal from the ShipGate pipeline */
export interface VerificationSignal {
  source: SignalSource;
  category: SignalCategory;
  passed: boolean;
  score?: number;
  findings?: SignalFinding[];
  metadata?: Record<string, unknown>;
}

export type SignalSource =
  | 'parser'
  | 'typechecker'
  | 'verifier'
  | 'security_scanner'
  | 'dependency_audit'
  | 'test_runner'
  | 'chaos_engine'
  | 'hallucination_detector'
  | 'trust_score'
  | 'gate_verdict';

export type SignalCategory =
  | 'authentication'
  | 'authorization'
  | 'encryption'
  | 'input_validation'
  | 'output_validation'
  | 'audit_logging'
  | 'rate_limiting'
  | 'injection_prevention'
  | 'secret_management'
  | 'dependency_security'
  | 'data_integrity'
  | 'error_handling'
  | 'access_control'
  | 'monitoring'
  | 'incident_response'
  | 'change_management'
  | 'formal_verification'
  | 'general';

export interface SignalFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  location?: string;
}

/** A control linked to verification evidence */
export interface LinkedControl {
  controlId: string;
  controlName: string;
  framework: ComplianceFramework;
  status: 'verified' | 'partial' | 'unverified' | 'failed';
  verificationLinks: VerificationLink[];
  evidenceStrength: 'strong' | 'moderate' | 'weak';
  lastVerified?: string;
}

/** A link between a verification signal and a control */
export interface VerificationLink {
  signalSource: SignalSource;
  signalCategory: SignalCategory;
  passed: boolean;
  score?: number;
  evidenceType: 'automated_test' | 'formal_proof' | 'security_scan' | 'runtime_check' | 'static_analysis';
  description: string;
  timestamp: string;
}

export interface AutoLinkResult {
  domain: string;
  generatedAt: string;
  linkedControls: LinkedControl[];
  coverageByFramework: Record<string, {
    total: number;
    verified: number;
    partial: number;
    unverified: number;
    failed: number;
    percentage: number;
  }>;
  unmappedSignals: VerificationSignal[];
  summary: {
    totalSignals: number;
    totalLinks: number;
    totalControlsCovered: number;
    totalControlsUncovered: number;
    strongEvidence: number;
    moderateEvidence: number;
    weakEvidence: number;
  };
}

/**
 * Maps signal categories to framework controls.
 *
 * This is the core mapping table — when a verification signal fires
 * in a given category, it automatically links to these controls.
 */
const SIGNAL_TO_CONTROL_MAP: Record<SignalCategory, Partial<Record<ComplianceFramework, string[]>>> = {
  authentication: {
    'soc2': ['CC6.1', 'CC6.2'],
    'hipaa': ['164.312(a)(1)', '164.312(d)'],
    'pci-dss': ['8.3.1', '8.6.1'],
    'fedramp': ['IA-2', 'IA-8', 'AC-3'],
    'eu-ai-act': ['Art.15(4)'],
    'gdpr': ['Art.32'],
  },
  authorization: {
    'soc2': ['CC6.1', 'CC6.3'],
    'hipaa': ['164.308(a)(3)', '164.308(a)(4)'],
    'pci-dss': ['7.2.1', '7.2.2'],
    'fedramp': ['AC-3', 'AC-6'],
    'gdpr': ['Art.25'],
  },
  encryption: {
    'soc2': ['CC6.7'],
    'hipaa': ['164.312(a)(1)', '164.312(e)(1)'],
    'pci-dss': ['3.4.1', '3.5.1', '3.6.1'],
    'fedramp': ['SC-8', 'SC-12', 'SC-13', 'SC-28'],
    'eu-ai-act': ['Art.15(4)'],
    'gdpr': ['Art.32'],
  },
  input_validation: {
    'soc2': ['PI1.1'],
    'hipaa': ['164.312(c)(1)'],
    'pci-dss': ['6.5.1'],
    'fedramp': ['SI-10', 'SI-3'],
    'eu-ai-act': ['Art.15(1)', 'Art.9(2)'],
  },
  output_validation: {
    'soc2': ['PI1.2', 'PI1.3'],
    'hipaa': ['164.312(c)(1)'],
    'fedramp': ['SI-10'],
    'eu-ai-act': ['Art.15(1)'],
  },
  audit_logging: {
    'soc2': ['CC7.1', 'CC7.2'],
    'hipaa': ['164.312(b)'],
    'pci-dss': ['10.2.1', '10.3.1'],
    'fedramp': ['AU-2', 'AU-3', 'AU-12'],
    'eu-ai-act': ['Art.12(1)', 'Art.12(2)'],
    'gdpr': ['Art.30'],
  },
  rate_limiting: {
    'soc2': ['CC6.6'],
    'pci-dss': ['6.5.1'],
    'fedramp': ['AC-7', 'SC-7'],
    'eu-ai-act': ['Art.9(4)'],
  },
  injection_prevention: {
    'soc2': ['PI1.1'],
    'pci-dss': ['6.5.1'],
    'fedramp': ['SI-3', 'SI-10'],
  },
  secret_management: {
    'soc2': ['CC6.1'],
    'pci-dss': ['3.6.1'],
    'fedramp': ['IA-5', 'SC-12', 'CM-6'],
  },
  dependency_security: {
    'soc2': ['CC6.8', 'CC9.2'],
    'pci-dss': ['6.3.1', '11.3.1'],
    'fedramp': ['RA-5', 'SI-2'],
  },
  data_integrity: {
    'soc2': ['PI1.2'],
    'hipaa': ['164.312(c)(1)'],
    'fedramp': ['SI-10'],
    'eu-ai-act': ['Art.10(2)'],
  },
  error_handling: {
    'soc2': ['CC7.5'],
    'fedramp': ['IR-4'],
    'eu-ai-act': ['Art.9(4)'],
  },
  access_control: {
    'soc2': ['CC6.1', 'CC6.3', 'CC6.6'],
    'hipaa': ['164.308(a)(3)', '164.308(a)(4)', '164.312(a)(1)'],
    'pci-dss': ['7.2.1', '7.2.2'],
    'fedramp': ['AC-2', 'AC-3', 'AC-6'],
    'gdpr': ['Art.25', 'Art.32'],
  },
  monitoring: {
    'soc2': ['CC7.2', 'CC7.3'],
    'hipaa': ['164.308(a)(8)'],
    'pci-dss': ['10.7.1'],
    'fedramp': ['CA-7', 'SI-4', 'AU-6'],
    'eu-ai-act': ['Art.17(1)(g)'],
  },
  incident_response: {
    'soc2': ['CC7.3', 'CC7.4'],
    'hipaa': ['164.308(a)(6)'],
    'fedramp': ['IR-4', 'IR-5', 'IR-6'],
    'eu-ai-act': ['Art.17(1)(g)'],
    'gdpr': ['Art.33', 'Art.34'],
  },
  change_management: {
    'soc2': ['CC8.1'],
    'pci-dss': ['6.4.1'],
    'fedramp': ['CM-3'],
    'eu-ai-act': ['Art.17(1)'],
  },
  formal_verification: {
    'soc2': ['PI1.2', 'PI1.3'],
    'pci-dss': ['6.3.1'],
    'fedramp': ['SA-8', 'SA-11', 'CA-2'],
    'eu-ai-act': ['Art.15(1)', 'Art.17(1)(e)'],
  },
  general: {},
};

/**
 * Maps signal sources to evidence types for audit trail.
 */
const SOURCE_TO_EVIDENCE_TYPE: Record<SignalSource, VerificationLink['evidenceType']> = {
  parser: 'static_analysis',
  typechecker: 'static_analysis',
  verifier: 'formal_proof',
  security_scanner: 'security_scan',
  dependency_audit: 'security_scan',
  test_runner: 'automated_test',
  chaos_engine: 'automated_test',
  hallucination_detector: 'static_analysis',
  trust_score: 'runtime_check',
  gate_verdict: 'runtime_check',
};

export class VerificationAutoLinker {
  private domain: Domain;
  private frameworks: ComplianceFramework[];

  constructor(domain: Domain, frameworks?: ComplianceFramework[]) {
    this.domain = domain;
    this.frameworks = frameworks || ['soc2', 'hipaa', 'eu-ai-act', 'pci-dss', 'fedramp', 'gdpr'];
  }

  /**
   * Auto-link verification signals to compliance controls.
   * This is the main entry point — feed it your verification results
   * and get back a complete compliance mapping with no manual work.
   */
  link(signals: VerificationSignal[]): AutoLinkResult {
    const timestamp = new Date().toISOString();
    const linkedControlsMap = new Map<string, LinkedControl>();
    const unmappedSignals: VerificationSignal[] = [];
    let totalLinks = 0;

    // Get all controls from all frameworks
    const allControls = this.getAllFrameworkControls();

    // Initialize all controls as unverified
    for (const control of allControls) {
      const key = `${control.framework}:${control.controlId}`;
      linkedControlsMap.set(key, {
        controlId: control.controlId,
        controlName: control.controlName,
        framework: control.framework,
        status: 'unverified',
        verificationLinks: [],
        evidenceStrength: 'weak',
      });
    }

    // Link each signal to controls
    for (const signal of signals) {
      const controlIds = SIGNAL_TO_CONTROL_MAP[signal.category] || {};
      let linked = false;

      for (const framework of this.frameworks) {
        const controls = controlIds[framework];
        if (!controls) continue;

        for (const controlId of controls) {
          const key = `${framework}:${controlId}`;
          const existing = linkedControlsMap.get(key);
          if (!existing) continue;

          const link: VerificationLink = {
            signalSource: signal.source,
            signalCategory: signal.category,
            passed: signal.passed,
            score: signal.score,
            evidenceType: SOURCE_TO_EVIDENCE_TYPE[signal.source],
            description: this.describeLink(signal),
            timestamp,
          };

          existing.verificationLinks.push(link);
          existing.lastVerified = timestamp;
          totalLinks++;
          linked = true;
        }
      }

      if (!linked) {
        unmappedSignals.push(signal);
      }
    }

    // Compute status and evidence strength for each control
    for (const control of linkedControlsMap.values()) {
      if (control.verificationLinks.length === 0) {
        control.status = 'unverified';
        control.evidenceStrength = 'weak';
        continue;
      }

      const allPassed = control.verificationLinks.every(l => l.passed);
      const anyFailed = control.verificationLinks.some(l => !l.passed);
      const hasFormalProof = control.verificationLinks.some(l => l.evidenceType === 'formal_proof');

      if (anyFailed) {
        control.status = 'failed';
      } else if (allPassed) {
        control.status = 'verified';
      } else {
        control.status = 'partial';
      }

      // Evidence strength based on evidence types and count
      if (hasFormalProof && allPassed) {
        control.evidenceStrength = 'strong';
      } else if (control.verificationLinks.length >= 2 && allPassed) {
        control.evidenceStrength = 'strong';
      } else if (allPassed) {
        control.evidenceStrength = 'moderate';
      } else {
        control.evidenceStrength = 'weak';
      }
    }

    const linkedControls = Array.from(linkedControlsMap.values());

    // Compute coverage by framework
    const coverageByFramework: AutoLinkResult['coverageByFramework'] = {};
    for (const framework of this.frameworks) {
      const fwControls = linkedControls.filter(c => c.framework === framework);
      const verified = fwControls.filter(c => c.status === 'verified').length;
      const partial = fwControls.filter(c => c.status === 'partial').length;
      const unverified = fwControls.filter(c => c.status === 'unverified').length;
      const failed = fwControls.filter(c => c.status === 'failed').length;
      const total = fwControls.length;

      coverageByFramework[framework] = {
        total,
        verified,
        partial,
        unverified,
        failed,
        percentage: total > 0 ? Math.round(((verified + partial * 0.5) / total) * 100) : 0,
      };
    }

    // Summary
    const strongEvidence = linkedControls.filter(c => c.evidenceStrength === 'strong').length;
    const moderateEvidence = linkedControls.filter(c => c.evidenceStrength === 'moderate').length;
    const weakEvidence = linkedControls.filter(c => c.evidenceStrength === 'weak').length;
    const totalControlsCovered = linkedControls.filter(c => c.status !== 'unverified').length;

    return {
      domain: this.domain.name,
      generatedAt: timestamp,
      linkedControls,
      coverageByFramework,
      unmappedSignals,
      summary: {
        totalSignals: signals.length,
        totalLinks,
        totalControlsCovered,
        totalControlsUncovered: linkedControls.length - totalControlsCovered,
        strongEvidence,
        moderateEvidence,
        weakEvidence,
      },
    };
  }

  /**
   * Convert ShipGate VerifyResult[] to VerificationSignal[] for auto-linking.
   * This bridges the existing verification pipeline to the compliance auto-linker.
   */
  static fromVerifyResults(results: VerifyResult[]): VerificationSignal[] {
    const signals: VerificationSignal[] = [];

    for (const result of results) {
      // Core verification signal
      signals.push({
        source: 'verifier',
        category: 'formal_verification',
        passed: result.passed,
        score: result.score,
        metadata: { behavior: result.behavior },
      });

      // Extract category signals from details
      if (result.details) {
        for (const detail of result.details) {
          const category = inferCategory(detail.check);
          if (category !== 'general') {
            signals.push({
              source: 'verifier',
              category,
              passed: detail.passed,
              metadata: { behavior: result.behavior, check: detail.check },
            });
          }
        }
      }
    }

    return signals;
  }

  private getAllFrameworkControls(): Array<{ framework: ComplianceFramework; controlId: string; controlName: string }> {
    const controls: Array<{ framework: ComplianceFramework; controlId: string; controlName: string }> = [];
    const generator = new ComplianceGenerator(this.domain);

    for (const framework of this.frameworks) {
      const report = generator.generate(framework);
      for (const mapping of report.controlMappings) {
        controls.push({
          framework,
          controlId: mapping.controlId,
          controlName: mapping.controlName,
        });
      }
    }

    return controls;
  }

  private describeLink(signal: VerificationSignal): string {
    const passText = signal.passed ? 'PASSED' : 'FAILED';
    const scoreText = signal.score !== undefined ? ` (score: ${signal.score}/100)` : '';
    return `${signal.source} ${signal.category} check ${passText}${scoreText}`;
  }
}

/**
 * Infer a signal category from a check name or description.
 */
function inferCategory(check: string): SignalCategory {
  const lower = check.toLowerCase();

  if (/auth(?:entication)?|login|credential|password|mfa|token/i.test(lower)) return 'authentication';
  if (/authori[sz]ation|permission|role|rbac|acl/i.test(lower)) return 'authorization';
  if (/encrypt|cipher|tls|https|crypto/i.test(lower)) return 'encryption';
  if (/input.*valid|sanitiz|precondition|schema.*valid/i.test(lower)) return 'input_validation';
  if (/output.*valid|postcondition|response.*valid/i.test(lower)) return 'output_validation';
  if (/audit|log|observability|trace/i.test(lower)) return 'audit_logging';
  if (/rate.*limit|throttl/i.test(lower)) return 'rate_limiting';
  if (/inject|xss|sql.*inject|ssrf/i.test(lower)) return 'injection_prevention';
  if (/secret|api.*key|credential.*stor/i.test(lower)) return 'secret_management';
  if (/depend|npm.*audit|supply.*chain|vulnerability/i.test(lower)) return 'dependency_security';
  if (/integrity|checksum|hash|tamper/i.test(lower)) return 'data_integrity';
  if (/error|exception|fallback|recovery/i.test(lower)) return 'error_handling';
  if (/access.*control|firewall|boundary/i.test(lower)) return 'access_control';
  if (/monitor|alert|metric|health/i.test(lower)) return 'monitoring';
  if (/incident|breach|escalat/i.test(lower)) return 'incident_response';
  if (/change.*manage|version|deploy/i.test(lower)) return 'change_management';

  return 'general';
}

/**
 * Quick auto-link function for a domain with verification results.
 */
export function autoLinkVerification(
  domain: Domain,
  signals: VerificationSignal[],
  frameworks?: ComplianceFramework[]
): AutoLinkResult {
  const linker = new VerificationAutoLinker(domain, frameworks);
  return linker.link(signals);
}
