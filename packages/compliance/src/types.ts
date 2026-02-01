/**
 * Types for compliance report generation
 */

export type ComplianceFramework = 'pci-dss' | 'soc2' | 'hipaa' | 'gdpr';

export type ControlStatus = 'implemented' | 'partial' | 'not_implemented' | 'not_applicable';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Domain {
  name: string;
  version: string;
  description?: string;
  types: TypeDefinition[];
  behaviors: BehaviorDefinition[];
  actors?: ActorDefinition[];
  compliance?: ComplianceSpec;
}

export interface TypeDefinition {
  name: string;
  fields: FieldDefinition[];
  annotations?: string[];
}

export interface FieldDefinition {
  name: string;
  type: string;
  annotations?: string[];
  constraints?: string[];
}

export interface BehaviorDefinition {
  name: string;
  input?: FieldDefinition[];
  output?: FieldDefinition[];
  preconditions?: ConditionDefinition[];
  postconditions?: ConditionDefinition[];
  security?: SecuritySpec;
  observability?: ObservabilitySpec;
  compliance?: BehaviorComplianceSpec;
}

export interface ConditionDefinition {
  name: string;
  expression: string;
}

export interface ActorDefinition {
  name: string;
  permissions: string[];
  authentication?: string;
}

export interface SecuritySpec {
  authentication?: string;
  authorization?: string[];
  rateLimit?: RateLimitSpec;
  encryption?: EncryptionSpec;
}

export interface RateLimitSpec {
  requests: number;
  window: string;
}

export interface EncryptionSpec {
  algorithm?: string;
  keyRotation?: string;
}

export interface ObservabilitySpec {
  logs?: LogSpec[];
  metrics?: string[];
  traces?: boolean;
}

export interface LogSpec {
  level: string;
  message: string;
  fields?: string[];
}

export interface ComplianceSpec {
  pci_dss?: Record<string, string | string[]>;
  soc2?: Record<string, string | string[]>;
  hipaa?: Record<string, string | string[]>;
  gdpr?: Record<string, string | string[]>;
}

export interface BehaviorComplianceSpec {
  pci_dss?: Record<string, string>;
  hipaa?: Record<string, string>;
  gdpr?: Record<string, string>;
}

export interface VerifyResult {
  behavior: string;
  passed: boolean;
  score: number;
  proofBundle?: string;
  timestamp: string;
  details?: VerifyDetail[];
}

export interface VerifyDetail {
  check: string;
  passed: boolean;
  message?: string;
}

export interface ControlMapping {
  controlId: string;
  controlName: string;
  description: string;
  status: ControlStatus;
  evidence: ComplianceEvidence[];
  notes?: string;
  risk?: RiskLevel;
}

export interface ComplianceEvidence {
  type: 'isl_spec' | 'verification' | 'configuration' | 'documentation';
  source: string;
  content: string;
  timestamp?: string;
}

export interface ComplianceGap {
  controlId: string;
  requirement: string;
  currentState: string;
  recommendation: string;
  suggestedISL?: string;
  priority: RiskLevel;
}

export interface VerificationProof {
  behavior: string;
  verified: boolean;
  score: number;
  proofBundle?: string;
}

export interface ComplianceReport {
  framework: ComplianceFramework;
  frameworkVersion: string;
  domain: string;
  domainVersion: string;
  generatedAt: string;
  status: 'compliant' | 'compliant_with_exceptions' | 'non_compliant';
  summary: ComplianceSummary;
  controlMappings: ControlMapping[];
  gaps: ComplianceGap[];
  verificationProofs: VerificationProof[];
  markdown: string;
}

export interface ComplianceSummary {
  totalControls: number;
  implementedControls: number;
  partialControls: number;
  notImplementedControls: number;
  notApplicableControls: number;
  compliancePercentage: number;
  riskLevel: RiskLevel;
}

export interface ComplianceOptions {
  includeEvidence?: boolean;
  includeRecommendations?: boolean;
  outputFormat?: 'markdown' | 'json' | 'html';
  verifyResults?: VerifyResult[];
  customMappings?: Record<string, string[]>;
}

export interface FrameworkControl {
  id: string;
  name: string;
  description: string;
  category: string;
  islMappings: ISLMapping[];
}

export interface ISLMapping {
  type: 'annotation' | 'spec' | 'behavior' | 'type' | 'field';
  pattern: string | RegExp;
  description: string;
}
