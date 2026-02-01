/**
 * @intentos/compliance
 * 
 * Generate compliance reports (SOC2, PCI-DSS, HIPAA, GDPR) from ISL specifications.
 * Maps ISL constructs to compliance framework requirements and produces
 * evidence-backed compliance reports.
 */

export { generate, generateReport, ComplianceGenerator } from './generator';
export { analyzeCompliance, ComplianceAnalyzer } from './analyzer';
export { collectEvidence, EvidenceCollector } from './evidence';

// Framework exports
export { SOC2Framework, SOC2_CONTROLS } from './frameworks/soc2';
export { PCIDSSFramework, PCI_REQUIREMENTS } from './frameworks/pci';
export { HIPAAFramework, HIPAA_RULES } from './frameworks/hipaa';
export { GDPRFramework, GDPR_ARTICLES } from './frameworks/gdpr';

// Types
export type {
  ComplianceFramework,
  ComplianceReport,
  ControlMapping,
  ControlStatus,
  ComplianceGap,
  ComplianceEvidence,
  VerificationProof,
  RiskLevel,
  ComplianceOptions,
} from './types';
