export type ComplianceFramework = 'soc2' | 'hipaa' | 'pci-dss' | 'eu-ai-act';

export interface ComplianceReport {
  framework: ComplianceFramework;
  timestamp: string;
  version: string;
  controls: ControlResult[];
  summary: ComplianceSummary;
}

export interface ControlResult {
  controlId: string;
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'partial' | 'not_applicable';
  evidence: string[];
  recommendations?: string[];
}

export interface ComplianceSummary {
  totalControls: number;
  passed: number;
  failed: number;
  partial: number;
  notApplicable: number;
  complianceScore: number;
}
