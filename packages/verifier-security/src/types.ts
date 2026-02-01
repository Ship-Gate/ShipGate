// ============================================================================
// Security Verifier Types
// ============================================================================

/**
 * Security check categories
 */
export type SecurityCategory = 
  | 'authentication'
  | 'authorization'
  | 'injection'
  | 'cryptography'
  | 'data-exposure'
  | 'rate-limiting'
  | 'input-validation'
  | 'session-management'
  | 'cors'
  | 'headers';

/**
 * Severity levels
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Security finding
 */
export interface SecurityFinding {
  id: string;
  category: SecurityCategory;
  severity: Severity;
  title: string;
  description: string;
  location: {
    domain: string;
    behavior?: string;
    line?: number;
    column?: number;
  };
  recommendation: string;
  cweId?: string;
  owaspId?: string;
  evidence?: string;
}

/**
 * Verification result
 */
export interface SecurityVerificationResult {
  passed: boolean;
  score: number;
  findings: SecurityFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  checkedCategories: SecurityCategory[];
  duration: number;
}

/**
 * Verifier options
 */
export interface SecurityVerifierOptions {
  /** Categories to check */
  categories?: SecurityCategory[];
  
  /** Minimum severity to report */
  minSeverity?: Severity;
  
  /** Fail on severity level */
  failOnSeverity?: Severity;
  
  /** Custom rules */
  customRules?: SecurityRule[];
  
  /** Exclude patterns */
  exclude?: string[];
}

/**
 * Security rule definition
 */
export interface SecurityRule {
  id: string;
  name: string;
  category: SecurityCategory;
  severity: Severity;
  description: string;
  check: (context: RuleContext) => SecurityFinding[];
}

/**
 * Rule context
 */
export interface RuleContext {
  domain: Domain;
  behavior?: Behavior;
  ast?: unknown;
}

/**
 * Domain and behavior types
 */
export interface Domain {
  name: string;
  behaviors: Behavior[];
  entities?: Entity[];
  config?: DomainConfig;
}

export interface DomainConfig {
  authentication?: AuthConfig;
  authorization?: AuthzConfig;
  rateLimit?: RateLimitConfig;
}

export interface AuthConfig {
  required?: boolean;
  methods?: string[];
  tokenValidation?: boolean;
}

export interface AuthzConfig {
  roles?: string[];
  permissions?: string[];
  rbac?: boolean;
}

export interface RateLimitConfig {
  enabled?: boolean;
  requestsPerMinute?: number;
  burstLimit?: number;
}

export interface Behavior {
  name: string;
  description?: string;
  input?: Record<string, PropertyDef>;
  output?: Record<string, PropertyDef>;
  preconditions?: string[];
  postconditions?: string[];
  auth?: BehaviorAuth;
}

export interface BehaviorAuth {
  required?: boolean;
  roles?: string[];
  permissions?: string[];
}

export interface Entity {
  name: string;
  properties: Record<string, PropertyDef>;
  sensitive?: string[];
}

export interface PropertyDef {
  type: string;
  required?: boolean;
  sensitive?: boolean;
  pii?: boolean;
  encrypted?: boolean;
  validation?: string[];
}

/**
 * Default options
 */
export const DEFAULT_OPTIONS: Required<SecurityVerifierOptions> = {
  categories: [
    'authentication',
    'authorization',
    'injection',
    'cryptography',
    'data-exposure',
    'input-validation',
  ],
  minSeverity: 'info',
  failOnSeverity: 'high',
  customRules: [],
  exclude: [],
};

/**
 * Severity priority for comparison
 */
export const SEVERITY_PRIORITY: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};
