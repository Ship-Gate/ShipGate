/**
 * SOC2 CC-Series Mapping for ShipGate Checks
 *
 * Maps ShipGate firewall rules, gate phases, and evidence to SOC2 Trust Services
 * Criteria (CC-series) so proof bundles translate into controls auditors understand.
 *
 * Mapping:
 *   - auth/authorization checks -> CC6.x (Logical and Physical Access)
 *   - secrets handling -> CC6.1 / CC6.6
 *   - change management / CI gate evidence -> CC8.x
 *   - logging/monitoring signals -> CC7.x
 */

export type SOC2ControlStatus = 'pass' | 'warn' | 'fail';

export interface SOC2ControlMapping {
  /** SOC2 control ID (e.g. CC6.1, CC7.2) */
  controlId: string;
  /** Control name for auditor display */
  controlName: string;
  /** Brief description of what the control addresses */
  description: string;
  /** Status: pass = satisfied, warn = partial, fail = not satisfied */
  status: SOC2ControlStatus;
  /** ShipGate checks that contributed to this control */
  contributingChecks: ContributingCheck[];
  /** Evidence references (proof bundle links, file paths) */
  evidenceRefs: EvidenceRef[];
}

export interface ContributingCheck {
  /** Check identifier (firewall rule ID, phase name) */
  checkId: string;
  /** Human-readable check name */
  checkName: string;
  /** Whether this check passed (no violations) */
  passed: boolean;
  /** Impact on control: positive = supports pass, negative = supports fail */
  impact: 'positive' | 'negative';
}

export interface EvidenceRef {
  /** Type of evidence */
  type: 'proof_bundle' | 'gate_verdict' | 'firewall_violation' | 'claim' | 'trace';
  /** Reference (bundle hash, file path, trace ID) */
  ref: string;
  /** Optional human-readable description */
  description?: string;
}

/** ShipGate firewall rule ID -> SOC2 control IDs */
export const SHIPGATE_RULE_TO_SOC2: Record<string, string[]> = {
  // ─── AUTH / AUTHORIZATION -> CC6.x ───
  'auth/bypass-detected': ['CC6.1', 'CC6.6'],
  'auth/hardcoded-credentials': ['CC6.1', 'CC6.6'],
  'auth/unprotected-route': ['CC6.1', 'CC6.2'],
  'auth/jwt-none-algorithm': ['CC6.1', 'CC6.6'],
  'auth/session-fixation': ['CC6.1', 'CC6.3'],

  // ─── SECRETS HANDLING -> CC6.1, CC6.6 ───
  'pii/exposed-in-url': ['CC6.6', 'CC6.7'],
  'intent/encryption-required': ['CC6.1', 'CC6.6'],

  // ─── LOGGING / MONITORING -> CC7.x ───
  'pii/logged-sensitive-data': ['CC7.2', 'CC7.3'],
  'pii/console-in-production': ['CC7.2'],
  'intent/pii-logging': ['CC7.2', 'CC7.3'],
  'intent/audit-missing': ['CC7.1', 'CC7.2'],

  // ─── RATE LIMIT -> CC6.6 ───
  'rate-limit/auth-endpoint': ['CC6.6'],
  'rate-limit/api-endpoint': ['CC6.6'],
  'rate-limit/password-reset': ['CC6.6'],
  'rate-limit/file-upload': ['CC6.6'],
  'rate-limit/otp-endpoint': ['CC6.6'],

  // ─── VALIDATION -> PI1.1 ───
  'intent/validation-missing': ['PI1.1'],
};

/** Gate phases -> CC8.1 (Change Management) */
export const GATE_PHASES_FOR_CC8 = ['gate', 'build', 'test', 'verify'];

/** SOC2 control metadata for auditor display */
export const SOC2_CONTROL_META: Record<
  string,
  { name: string; description: string; category: string }
> = {
  'CC6.1': {
    name: 'Logical Access Security',
    description: 'The entity implements logical access security software, infrastructure, and architectures',
    category: 'Logical and Physical Access',
  },
  'CC6.2': {
    name: 'User Registration',
    description: 'Prior to issuing credentials, the entity registers and authorizes users',
    category: 'Logical and Physical Access',
  },
  'CC6.3': {
    name: 'Credential Management',
    description: 'The entity authorizes, modifies, or removes access to data and assets',
    category: 'Logical and Physical Access',
  },
  'CC6.6': {
    name: 'External Boundaries',
    description: 'The entity implements controls to prevent or detect unauthorized access',
    category: 'Logical and Physical Access',
  },
  'CC6.7': {
    name: 'Transmission Protection',
    description: 'The entity restricts the transmission of information to authorized channels',
    category: 'Logical and Physical Access',
  },
  'CC7.1': {
    name: 'Detection of Changes',
    description: 'The entity detects changes to infrastructure and software',
    category: 'System Operations',
  },
  'CC7.2': {
    name: 'System Monitoring',
    description: 'The entity monitors system components to detect anomalies',
    category: 'System Operations',
  },
  'CC7.3': {
    name: 'Security Event Analysis',
    description: 'The entity evaluates security events to determine their impact',
    category: 'System Operations',
  },
  'CC8.1': {
    name: 'Change Authorization',
    description: 'The entity authorizes, designs, and develops changes to infrastructure and software',
    category: 'Change Management',
  },
  'PI1.1': {
    name: 'Input Validation',
    description: 'The entity validates inputs before processing',
    category: 'Processing Integrity',
  },
};
