/**
 * Custom semantic conventions for ISL (Intent Specification Language)
 * These attributes provide standardized naming for ISL-specific telemetry data
 */
export const ISLSemanticAttributes = {
  // ═══════════════════════════════════════════════════════════════════════════
  // Domain Attributes
  // ═══════════════════════════════════════════════════════════════════════════

  /** Name of the ISL domain (e.g., "Auth", "Payments", "Inventory") */
  ISL_DOMAIN_NAME: 'isl.domain.name',

  /** Version of the ISL domain specification */
  ISL_DOMAIN_VERSION: 'isl.domain.version',

  /** Namespace for the domain (e.g., "com.example.auth") */
  ISL_DOMAIN_NAMESPACE: 'isl.domain.namespace',

  // ═══════════════════════════════════════════════════════════════════════════
  // Behavior Attributes
  // ═══════════════════════════════════════════════════════════════════════════

  /** Name of the behavior being executed */
  ISL_BEHAVIOR_NAME: 'isl.behavior.name',

  /** Actor performing the behavior (e.g., "User", "Admin", "System") */
  ISL_BEHAVIOR_ACTOR: 'isl.behavior.actor',

  /** Unique idempotency key for the behavior execution */
  ISL_BEHAVIOR_IDEMPOTENCY_KEY: 'isl.behavior.idempotency_key',

  /** Whether the behavior is idempotent */
  ISL_BEHAVIOR_IDEMPOTENT: 'isl.behavior.idempotent',

  /** Timeout configured for the behavior (in milliseconds) */
  ISL_BEHAVIOR_TIMEOUT_MS: 'isl.behavior.timeout_ms',

  /** Retry count for the behavior */
  ISL_BEHAVIOR_RETRY_COUNT: 'isl.behavior.retry_count',

  /** Maximum retries allowed */
  ISL_BEHAVIOR_MAX_RETRIES: 'isl.behavior.max_retries',

  // ═══════════════════════════════════════════════════════════════════════════
  // Verification Attributes
  // ═══════════════════════════════════════════════════════════════════════════

  /** Verification verdict: pass, fail, error, skip */
  ISL_VERIFICATION_VERDICT: 'isl.verification.verdict',

  /** Trust/verification score (0.0 - 1.0 or 0 - 100) */
  ISL_VERIFICATION_SCORE: 'isl.verification.score',

  /** Unique identifier for the verification run */
  ISL_VERIFICATION_ID: 'isl.verification.id',

  /** Type of verification: unit, integration, property, chaos */
  ISL_VERIFICATION_TYPE: 'isl.verification.type',

  /** Whether verification is in strict mode */
  ISL_VERIFICATION_STRICT: 'isl.verification.strict',

  /** Total number of checks in verification */
  ISL_VERIFICATION_CHECK_COUNT: 'isl.verification.check_count',

  /** Number of passed checks */
  ISL_VERIFICATION_PASSED_COUNT: 'isl.verification.passed_count',

  /** Number of failed checks */
  ISL_VERIFICATION_FAILED_COUNT: 'isl.verification.failed_count',

  // ═══════════════════════════════════════════════════════════════════════════
  // Check Attributes
  // ═══════════════════════════════════════════════════════════════════════════

  /** Type of check: precondition, postcondition, invariant */
  ISL_CHECK_TYPE: 'isl.check.type',

  /** Name/identifier of the check */
  ISL_CHECK_NAME: 'isl.check.name',

  /** Whether the check passed */
  ISL_CHECK_PASSED: 'isl.check.passed',

  /** The expression being checked */
  ISL_CHECK_EXPRESSION: 'isl.check.expression',

  /** Human-readable message for the check result */
  ISL_CHECK_MESSAGE: 'isl.check.message',

  /** Severity of check failure: error, warning, info */
  ISL_CHECK_SEVERITY: 'isl.check.severity',

  // ═══════════════════════════════════════════════════════════════════════════
  // Coverage Attributes
  // ═══════════════════════════════════════════════════════════════════════════

  /** Precondition coverage (e.g., "5/8" or percentage) */
  ISL_COVERAGE_PRECONDITIONS: 'isl.coverage.preconditions',

  /** Postcondition coverage */
  ISL_COVERAGE_POSTCONDITIONS: 'isl.coverage.postconditions',

  /** Invariant coverage */
  ISL_COVERAGE_INVARIANTS: 'isl.coverage.invariants',

  /** Overall coverage percentage */
  ISL_COVERAGE_TOTAL: 'isl.coverage.total',

  /** Number of behaviors covered */
  ISL_COVERAGE_BEHAVIORS: 'isl.coverage.behaviors',

  /** Number of edge cases covered */
  ISL_COVERAGE_EDGE_CASES: 'isl.coverage.edge_cases',

  // ═══════════════════════════════════════════════════════════════════════════
  // Chaos Engineering Attributes
  // ═══════════════════════════════════════════════════════════════════════════

  /** Type of chaos injection: latency, error, partition, resource */
  ISL_CHAOS_INJECTION_TYPE: 'isl.chaos.injection_type',

  /** Target of chaos injection (service, method, etc.) */
  ISL_CHAOS_TARGET: 'isl.chaos.target',

  /** Duration of chaos injection in milliseconds */
  ISL_CHAOS_DURATION_MS: 'isl.chaos.duration_ms',

  /** Intensity/severity of injection (0.0 - 1.0) */
  ISL_CHAOS_INTENSITY: 'isl.chaos.intensity',

  /** Whether the system recovered from chaos */
  ISL_CHAOS_RECOVERED: 'isl.chaos.recovered',

  /** Recovery time in milliseconds */
  ISL_CHAOS_RECOVERY_TIME_MS: 'isl.chaos.recovery_time_ms',

  // ═══════════════════════════════════════════════════════════════════════════
  // SLO Attributes
  // ═══════════════════════════════════════════════════════════════════════════

  /** SLO name/identifier */
  ISL_SLO_NAME: 'isl.slo.name',

  /** SLO target value */
  ISL_SLO_TARGET: 'isl.slo.target',

  /** Current SLO value */
  ISL_SLO_CURRENT: 'isl.slo.current',

  /** Whether SLO is met */
  ISL_SLO_MET: 'isl.slo.met',

  /** SLO budget remaining */
  ISL_SLO_BUDGET_REMAINING: 'isl.slo.budget_remaining',

  // ═══════════════════════════════════════════════════════════════════════════
  // Entity/State Attributes
  // ═══════════════════════════════════════════════════════════════════════════

  /** Entity type being operated on */
  ISL_ENTITY_TYPE: 'isl.entity.type',

  /** Entity identifier */
  ISL_ENTITY_ID: 'isl.entity.id',

  /** State before operation */
  ISL_STATE_BEFORE: 'isl.state.before',

  /** State after operation */
  ISL_STATE_AFTER: 'isl.state.after',

  /** State transition name */
  ISL_STATE_TRANSITION: 'isl.state.transition',
} as const;

/**
 * Type for ISL semantic attribute keys
 */
export type ISLSemanticAttributeKey = keyof typeof ISLSemanticAttributes;

/**
 * Type for ISL semantic attribute values
 */
export type ISLSemanticAttributeValue =
  (typeof ISLSemanticAttributes)[ISLSemanticAttributeKey];

/**
 * Verification verdict types
 */
export type VerificationVerdict = 'pass' | 'fail' | 'error' | 'skip';

/**
 * Check types
 */
export type CheckType = 'precondition' | 'postcondition' | 'invariant';

/**
 * Chaos injection types
 */
export type ChaosInjectionType =
  | 'latency'
  | 'error'
  | 'partition'
  | 'resource'
  | 'data'
  | 'clock';

/**
 * Verification types
 */
export type VerificationType =
  | 'unit'
  | 'integration'
  | 'property'
  | 'chaos'
  | 'formal';
