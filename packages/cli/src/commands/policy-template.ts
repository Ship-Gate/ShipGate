/**
 * Policy Template Generator
 * 
 * Generates .shipgate.policy.yml template files
 */

import type { PolicyConfig } from './policy-schema.js';
import { DEFAULT_POLICY_CONFIG } from './policy-schema.js';

/**
 * Generate a policy template YAML string
 */
export function generatePolicyTemplate(orgName?: string): string {
  const config: PolicyConfig = {
    ...DEFAULT_POLICY_CONFIG,
    org: orgName,
  };

  return `# ShipGate Organization Policy Configuration
# Define policy once, enforce across all repositories
#
# This file defines:
# - Threshold profiles (strict/standard/lenient)
# - Required evidence types (SMT for payments, etc.)
# - Exceptions with expiry + justification

version: 1
org: "${orgName ?? 'my-org'}"

# Threshold profiles
profiles:
  strict:
    min_trust_score: ${config.profiles.strict.minTrustScore}
    min_confidence: ${config.profiles.strict.minConfidence}
    min_tests: ${config.profiles.strict.minTests ?? 5}
    require_smt: ${config.profiles.strict.requireSMT ?? false}
    require_runtime: ${config.profiles.strict.requireRuntime ?? false}
    require_pbt: ${config.profiles.strict.requirePBT ?? false}

  standard:
    min_trust_score: ${config.profiles.standard.minTrustScore}
    min_confidence: ${config.profiles.standard.minConfidence}
    min_tests: ${config.profiles.standard.minTests ?? 3}
    require_smt: ${config.profiles.standard.requireSMT ?? false}
    require_runtime: ${config.profiles.standard.requireRuntime ?? false}
    require_pbt: ${config.profiles.standard.requirePBT ?? false}

  lenient:
    min_trust_score: ${config.profiles.lenient.minTrustScore}
    min_confidence: ${config.profiles.lenient.minConfidence}
    min_tests: ${config.profiles.lenient.minTests ?? 1}
    require_smt: ${config.profiles.lenient.requireSMT ?? false}
    require_runtime: ${config.profiles.lenient.requireRuntime ?? false}
    require_pbt: ${config.profiles.lenient.requirePBT ?? false}

# Default profile to use
default_profile: ${config.defaultProfile ?? 'standard'}

# Required evidence types by context
required_evidence:
  # Payment operations require SMT proofs and runtime verification
  - context:
      paths:
        - "**/payment*/**"
        - "**/billing/**"
      behaviors:
        - ".*payment.*"
        - ".*charge.*"
        - ".*refund.*"
    evidence_types:
      - smt
      - runtime
    severity: error
    description: "Payment operations require SMT proofs and runtime verification"

  # Authentication flows require runtime and unit test coverage
  - context:
      paths:
        - "**/auth/**"
      behaviors:
        - ".*login.*"
        - ".*auth.*"
    evidence_types:
      - runtime
      - unit
    severity: error
    description: "Authentication flows require runtime and unit test coverage"

# Exceptions/safelist (with expiry)
exceptions: []
  # Example exception:
  # - id: "payment-temp-exception-001"
  #   scope:
  #     paths:
  #       - "src/payments/legacy/**"
  #     behaviors:
  #       - ".*legacy.*"
  #   justification: "Legacy payment code being refactored, exception expires when migration completes"
  #   approved_by: "security-team@example.com"
  #   expires_at: "2026-03-01T00:00:00Z"
  #   created_at: "2026-02-01T00:00:00Z"
  #   active: true
`;
}
