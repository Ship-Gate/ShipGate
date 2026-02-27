/**
 * Policy Schema for .shipgate.policy.yml
 * 
 * Defines organization-level policy configuration:
 * - Threshold profiles (strict/standard/lenient)
 * - Required evidence types (SMT for payments, etc.)
 * - Exceptions with expiry + justification
 */

export interface PolicyConfig {
  /** Schema version */
  version: number;
  /** Organization name */
  org?: string;
  /** Threshold profiles */
  profiles: {
    strict: ThresholdProfile;
    standard: ThresholdProfile;
    lenient: ThresholdProfile;
  };
  /** Default profile to use */
  defaultProfile?: 'strict' | 'standard' | 'lenient';
  /** Required evidence types by context */
  requiredEvidence: EvidenceRequirement[];
  /** Exceptions/safelist */
  exceptions?: PolicyException[];
}

export interface ThresholdProfile {
  /** Minimum trust score to SHIP (0-100) */
  minTrustScore: number;
  /** Minimum confidence level (0-100) */
  minConfidence: number;
  /** Minimum number of tests required */
  minTests?: number;
  /** Require SMT proofs for critical paths */
  requireSMT?: boolean;
  /** Require runtime verification */
  requireRuntime?: boolean;
  /** Require property-based tests */
  requirePBT?: boolean;
}

export interface EvidenceRequirement {
  /** Context where this evidence is required */
  context: {
    /** File patterns (glob) */
    paths?: string[];
    /** Behavior names (regex) */
    behaviors?: string[];
    /** Tags/categories */
    tags?: string[];
  };
  /** Required evidence types */
  evidenceTypes: EvidenceType[];
  /** Severity if missing */
  severity: 'error' | 'warning';
  /** Description */
  description?: string;
}

export type EvidenceType = 
  | 'smt'           // SMT solver proofs
  | 'runtime'       // Runtime verification
  | 'pbt'           // Property-based tests
  | 'unit'          // Unit tests
  | 'integration'   // Integration tests
  | 'chaos'         // Chaos testing
  | 'formal';       // Formal verification

export interface PolicyException {
  /** Unique exception ID */
  id: string;
  /** What this exception applies to */
  scope: {
    /** File patterns */
    paths?: string[];
    /** Behavior names */
    behaviors?: string[];
    /** Specific policy rule IDs */
    rules?: string[];
  };
  /** Justification for the exception */
  justification: string;
  /** Who approved this exception */
  approvedBy?: string;
  /** When this exception expires (ISO date string) */
  expiresAt: string;
  /** When this exception was created */
  createdAt: string;
  /** Whether this exception is active */
  active: boolean;
}

/**
 * Default policy configuration
 */
export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  version: 1,
  profiles: {
    strict: {
      minTrustScore: 95,
      minConfidence: 80,
      minTests: 5,
      requireSMT: true,
      requireRuntime: true,
      requirePBT: true,
    },
    standard: {
      minTrustScore: 85,
      minConfidence: 60,
      minTests: 3,
      requireSMT: false,
      requireRuntime: false,
      requirePBT: false,
    },
    lenient: {
      minTrustScore: 70,
      minConfidence: 40,
      minTests: 1,
      requireSMT: false,
      requireRuntime: false,
      requirePBT: false,
    },
  },
  defaultProfile: 'standard',
  requiredEvidence: [
    {
      context: {
        paths: ['**/payment*/**', '**/billing/**'],
        behaviors: ['.*payment.*', '.*charge.*', '.*refund.*'],
      },
      evidenceTypes: ['smt', 'runtime'],
      severity: 'error',
      description: 'Payment operations require SMT proofs and runtime verification',
    },
    {
      context: {
        paths: ['**/auth/**'],
        behaviors: ['.*login.*', '.*auth.*'],
      },
      evidenceTypes: ['runtime', 'unit'],
      severity: 'error',
      description: 'Authentication flows require runtime and unit test coverage',
    },
  ],
  exceptions: [],
};
