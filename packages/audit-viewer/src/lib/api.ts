// ============================================================================
// Audit Log API Client
// ============================================================================

import type {
  AuditEvent,
  AuditFilters,
  PaginatedResult,
  ComplianceReport,
  ComplianceSummary,
  ComplianceFramework,
  DateRange,
  AuditStatistics,
  ExportOptions,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_AUDIT_API_URL || '/api/audit';

/**
 * Build query string from filters
 */
function buildQueryString(filters: AuditFilters, page: number, pageSize: number): string {
  const params = new URLSearchParams();
  
  if (filters.domain) params.set('domain', filters.domain);
  if (filters.behavior) params.set('behavior', filters.behavior);
  if (filters.actor) params.set('actor', filters.actor);
  if (filters.verdict) params.set('verdict', filters.verdict);
  if (filters.search) params.set('search', filters.search);
  if (filters.dateRange.start) params.set('startDate', filters.dateRange.start.toISOString());
  if (filters.dateRange.end) params.set('endDate', filters.dateRange.end.toISOString());
  
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  
  return params.toString();
}

/**
 * Fetch audit events with pagination and filters
 */
export async function fetchAuditEvents(
  filters: AuditFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedResult<AuditEvent>> {
  const query = buildQueryString(filters, page, pageSize);
  const response = await fetch(`${API_BASE}/events?${query}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch audit events: ${response.statusText}`);
  }
  
  return response.json() as Promise<PaginatedResult<AuditEvent>>;
}

/**
 * Fetch a single audit event by ID
 */
export async function fetchAuditEvent(id: string): Promise<AuditEvent> {
  const response = await fetch(`${API_BASE}/events/${id}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch audit event: ${response.statusText}`);
  }
  
  return response.json() as Promise<AuditEvent>;
}

/**
 * Fetch audit statistics
 */
export async function fetchAuditStatistics(
  dateRange?: DateRange
): Promise<AuditStatistics> {
  const params = new URLSearchParams();
  
  if (dateRange?.start) params.set('startDate', dateRange.start.toISOString());
  if (dateRange?.end) params.set('endDate', dateRange.end.toISOString());
  
  const response = await fetch(`${API_BASE}/statistics?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch statistics: ${response.statusText}`);
  }
  
  return response.json() as Promise<AuditStatistics>;
}

/**
 * Fetch available domains
 */
export async function fetchDomains(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/domains`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch domains: ${response.statusText}`);
  }
  
  return response.json() as Promise<string[]>;
}

/**
 * Fetch behaviors for a domain
 */
export async function fetchBehaviors(domain?: string): Promise<string[]> {
  const params = domain ? `?domain=${encodeURIComponent(domain)}` : '';
  const response = await fetch(`${API_BASE}/behaviors${params}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch behaviors: ${response.statusText}`);
  }
  
  return response.json() as Promise<string[]>;
}

/**
 * Fetch compliance report
 */
export async function fetchComplianceReport(
  framework: ComplianceFramework,
  dateRange: DateRange
): Promise<ComplianceReport> {
  const params = new URLSearchParams();
  params.set('framework', framework);
  if (dateRange.start) params.set('startDate', dateRange.start.toISOString());
  if (dateRange.end) params.set('endDate', dateRange.end.toISOString());
  
  const response = await fetch(`${API_BASE}/compliance/report?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch compliance report: ${response.statusText}`);
  }
  
  return response.json() as Promise<ComplianceReport>;
}

/**
 * Fetch compliance summary for all frameworks
 */
export async function fetchComplianceSummary(): Promise<ComplianceSummary[]> {
  const response = await fetch(`${API_BASE}/compliance/summary`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch compliance summary: ${response.statusText}`);
  }
  
  return response.json() as Promise<ComplianceSummary[]>;
}

/**
 * Export audit events
 */
export async function exportAuditEvents(options: ExportOptions): Promise<Blob> {
  const response = await fetch(`${API_BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to export audit events: ${response.statusText}`);
  }
  
  return response.blob();
}

/**
 * Download proof bundle
 */
export async function downloadProofBundle(eventId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/events/${eventId}/proof-bundle`);
  
  if (!response.ok) {
    throw new Error(`Failed to download proof bundle: ${response.statusText}`);
  }
  
  return response.blob();
}

/**
 * Replay verification for an event
 */
export async function replayVerification(eventId: string): Promise<AuditEvent> {
  const response = await fetch(`${API_BASE}/events/${eventId}/replay`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to replay verification: ${response.statusText}`);
  }
  
  return response.json() as Promise<AuditEvent>;
}

// ============================================================================
// Mock Data (for development)
// ============================================================================

export function generateMockEvents(count: number = 50): AuditEvent[] {
  const domains = ['auth', 'payment', 'inventory', 'shipping'];
  const behaviors = {
    auth: ['Login', 'Logout', 'Register', 'ResetPassword'],
    payment: ['ProcessPayment', 'Refund', 'CreateSubscription'],
    inventory: ['CreateProduct', 'UpdateStock', 'ReserveItems'],
    shipping: ['CreateShipment', 'UpdateTracking', 'DeliverPackage'],
  };
  const verdicts: Array<'verified' | 'risky' | 'unsafe'> = ['verified', 'risky', 'unsafe'];
  const actorTypes: Array<'user' | 'service' | 'system'> = ['user', 'service', 'system'];

  return Array.from({ length: count }, (_, i) => {
    const domain = domains[Math.floor(Math.random() * domains.length)]!;
    const behaviorList = behaviors[domain as keyof typeof behaviors];
    const behavior = behaviorList[Math.floor(Math.random() * behaviorList.length)]!;
    const verdict = verdicts[Math.random() < 0.8 ? 0 : Math.random() < 0.9 ? 1 : 2]!;
    
    return {
      id: `evt_${Date.now()}_${i}`,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      domain,
      behavior,
      verdict,
      score: verdict === 'verified' ? 90 + Math.random() * 10 : verdict === 'risky' ? 70 + Math.random() * 20 : Math.random() * 70,
      actor: {
        type: actorTypes[Math.floor(Math.random() * actorTypes.length)]!,
        id: `actor_${Math.floor(Math.random() * 1000)}`,
        name: `User ${Math.floor(Math.random() * 100)}`,
      },
      input: {
        email: 'user@example.com',
        amount: Math.floor(Math.random() * 10000) / 100,
      },
      output: verdict === 'verified' ? { success: true, id: `result_${i}` } : { error: 'VALIDATION_FAILED' },
      checks: [
        { type: 'precondition' as const, name: 'input.email.is_valid', expression: 'input.email.is_valid', passed: true, duration: 1 },
        { type: 'postcondition' as const, name: 'result.id exists', expression: 'result.id != null', passed: verdict === 'verified', duration: 2 },
        { type: 'invariant' as const, name: 'no_negative_balance', expression: 'balance >= 0', passed: true, duration: 1 },
      ],
      duration: Math.floor(50 + Math.random() * 450),
      proofBundleUrl: `/api/audit/events/evt_${Date.now()}_${i}/proof-bundle`,
    };
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function generateMockComplianceReport(framework: ComplianceFramework): ComplianceReport {
  const controls: Array<{ id: string; name: string; description: string }> = {
    'SOC2': [
      { id: 'CC6.1', name: 'Logical Access', description: 'Logical access security controls' },
      { id: 'CC6.2', name: 'Access Removal', description: 'Removal of access upon termination' },
      { id: 'CC6.3', name: 'Role-Based Access', description: 'Role-based access control' },
      { id: 'CC7.1', name: 'System Operations', description: 'System operations monitoring' },
      { id: 'CC7.2', name: 'Change Management', description: 'Change management controls' },
    ],
    'GDPR': [
      { id: 'Art.5', name: 'Data Principles', description: 'Principles relating to processing' },
      { id: 'Art.6', name: 'Lawfulness', description: 'Lawfulness of processing' },
      { id: 'Art.17', name: 'Right to Erasure', description: 'Right to be forgotten' },
      { id: 'Art.32', name: 'Security', description: 'Security of processing' },
    ],
    'HIPAA': [
      { id: '164.312(a)', name: 'Access Control', description: 'Technical access controls' },
      { id: '164.312(b)', name: 'Audit Controls', description: 'Hardware, software audit controls' },
      { id: '164.312(c)', name: 'Integrity', description: 'Data integrity controls' },
    ],
    'PCI-DSS': [
      { id: 'Req 1', name: 'Firewall', description: 'Install and maintain firewall' },
      { id: 'Req 3', name: 'Cardholder Data', description: 'Protect stored cardholder data' },
      { id: 'Req 8', name: 'Authentication', description: 'Identify and authenticate access' },
    ],
    'ISO27001': [
      { id: 'A.9.1', name: 'Access Control', description: 'Business requirements of access control' },
      { id: 'A.12.4', name: 'Logging', description: 'Logging and monitoring' },
      { id: 'A.18.1', name: 'Compliance', description: 'Compliance with legal requirements' },
    ],
  }[framework] ?? [];

  const totalEvents = 1000 + Math.floor(Math.random() * 5000);
  const verified = Math.floor(totalEvents * (0.9 + Math.random() * 0.08));
  const risky = Math.floor((totalEvents - verified) * 0.7);
  const violations = totalEvents - verified - risky;

  return {
    framework,
    dateRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
    generatedAt: new Date().toISOString(),
    totalEvents,
    verified,
    verifiedPercentage: Math.round((verified / totalEvents) * 100),
    risky,
    violations,
    complianceScore: Math.round(((verified + risky * 0.5) / totalEvents) * 100),
    controls: controls.map((c) => ({
      ...c,
      framework,
      status: Math.random() > 0.1 ? 'compliant' as const : 'non-compliant' as const,
      lastVerified: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      violations: Math.random() > 0.9 ? Math.floor(Math.random() * 5) : 0,
      evidence: [],
    })),
  };
}
