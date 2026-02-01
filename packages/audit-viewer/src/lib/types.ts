// ============================================================================
// Audit Log Types
// ============================================================================

export type Verdict = 'verified' | 'risky' | 'unsafe';

export type CheckType = 'precondition' | 'postcondition' | 'invariant';

export interface Actor {
  type: 'user' | 'service' | 'system' | 'anonymous';
  id: string;
  name?: string;
  ip?: string;
}

export interface Check {
  type: CheckType;
  name: string;
  expression: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
  error?: string;
  duration: number;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  domain: string;
  behavior: string;
  verdict: Verdict;
  score: number;
  actor: Actor;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
  checks: Check[];
  duration: number;
  proofBundleId?: string;
  proofBundleUrl?: string;
  metadata?: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
}

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface AuditFilters {
  domain: string | null;
  behavior: string | null;
  actor: string | null;
  verdict: Verdict | null;
  dateRange: DateRange;
  search: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Compliance Types
export type ComplianceFramework = 'SOC2' | 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'ISO27001';

export type ControlStatus = 'compliant' | 'non-compliant' | 'not-applicable' | 'pending';

export interface ComplianceControl {
  id: string;
  framework: ComplianceFramework;
  name: string;
  description: string;
  status: ControlStatus;
  lastVerified?: string;
  violations: number;
  evidence: ComplianceEvidence[];
}

export interface ComplianceEvidence {
  eventId: string;
  timestamp: string;
  behavior: string;
  verdict: Verdict;
}

export interface ComplianceReport {
  framework: ComplianceFramework;
  dateRange: DateRange;
  generatedAt: string;
  totalEvents: number;
  verified: number;
  verifiedPercentage: number;
  risky: number;
  violations: number;
  complianceScore: number;
  controls: ComplianceControl[];
}

export interface ComplianceSummary {
  framework: ComplianceFramework;
  score: number;
  totalControls: number;
  compliantControls: number;
  violations: number;
  lastUpdated: string;
}

// Statistics
export interface AuditStatistics {
  totalEvents: number;
  byVerdict: {
    verified: number;
    risky: number;
    unsafe: number;
  };
  byDomain: Record<string, number>;
  byBehavior: Record<string, number>;
  averageDuration: number;
  averageScore: number;
}

// Export formats
export type ExportFormat = 'json' | 'csv' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  filters: AuditFilters;
  includeDetails: boolean;
  includeProofBundles: boolean;
}
