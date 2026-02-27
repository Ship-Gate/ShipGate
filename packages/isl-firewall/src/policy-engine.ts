/**
 * ISL Firewall - Policy Engine
 * 
 * Evaluates firewall policies against claims and evidence.
 * 
 * @module @isl-lang/firewall
 */

import type {
  Claim,
  Evidence,
  Policy,
  PolicyViolation,
  PolicyDecision,
  ConfidenceTier,
  ClaimType,
} from './types.js';

// ============================================================================
// Built-in Policies
// ============================================================================

/**
 * Ghost Route Policy - Detects API endpoints not in truthpack
 */
const ghostRoutePolicy: Policy = {
  id: 'ghost-route',
  name: 'Ghost Route Detection',
  description: 'Detects API endpoint references that do not exist in the truthpack',
  enabled: true,
  tier: 'hard_block',
  appliesTo: ['api_endpoint'],
  evaluate(claim: Claim, evidence: Evidence): PolicyViolation | null {
    if (claim.type !== 'api_endpoint') return null;
    if (evidence.found) return null;

    return {
      policyId: 'ghost-route',
      claimId: claim.id,
      message: `Ghost route detected: ${claim.value} is not defined in the truthpack`,
      severity: 'high',
      tier: 'hard_block',
      suggestion: 'Add this route to your routes configuration or fix the endpoint path',
      quickFixes: [
        {
          type: 'allow_pattern',
          label: `Allow route prefix: ${getRoutePrefix(claim.value)}`,
          value: getRoutePrefix(claim.value),
        },
      ],
    };
  },
};

/**
 * Ghost Env Policy - Detects env vars not in truthpack/.env
 */
const ghostEnvPolicy: Policy = {
  id: 'ghost-env',
  name: 'Ghost Environment Variable Detection',
  description: 'Detects environment variable references not defined in .env files',
  enabled: true,
  tier: 'hard_block',
  appliesTo: ['env_variable'],
  evaluate(claim: Claim, evidence: Evidence): PolicyViolation | null {
    if (claim.type !== 'env_variable') return null;
    if (evidence.found) return null;

    return {
      policyId: 'ghost-env',
      claimId: claim.id,
      message: `Ghost env var: ${claim.value} is not defined in .env files or truthpack`,
      severity: 'high',
      tier: 'hard_block',
      suggestion: 'Add this variable to your .env file or .env.example',
      quickFixes: [
        {
          type: 'add',
          label: `Add ${claim.value} to .env`,
          value: `${claim.value}=`,
        },
        {
          type: 'allow_pattern',
          label: `Allow env var: ${claim.value}`,
          value: claim.value,
        },
      ],
    };
  },
};

/**
 * Ghost Import Policy - Detects imports that don't exist
 */
const ghostImportPolicy: Policy = {
  id: 'ghost-import',
  name: 'Ghost Import Detection',
  description: 'Detects import paths that do not exist on disk',
  enabled: true,
  tier: 'hard_block',
  appliesTo: ['import', 'package_dependency'],
  evaluate(claim: Claim, evidence: Evidence): PolicyViolation | null {
    if (claim.type !== 'import' && claim.type !== 'package_dependency') return null;
    if (evidence.found) return null;

    return {
      policyId: 'ghost-import',
      claimId: claim.id,
      message: `Ghost import: ${claim.value} cannot be resolved`,
      severity: 'high',
      tier: 'hard_block',
      suggestion: 'Install the package or fix the import path',
    };
  },
};

/**
 * Ghost File Policy - Detects file references that don't exist
 */
const ghostFilePolicy: Policy = {
  id: 'ghost-file',
  name: 'Ghost File Reference Detection',
  description: 'Detects file path references that do not exist',
  enabled: true,
  tier: 'hard_block',
  appliesTo: ['file_reference'],
  evaluate(claim: Claim, evidence: Evidence): PolicyViolation | null {
    if (claim.type !== 'file_reference') return null;
    if (evidence.found) return null;

    return {
      policyId: 'ghost-file',
      claimId: claim.id,
      message: `Ghost file: ${claim.value} does not exist`,
      severity: 'medium',
      tier: 'hard_block',
      suggestion: 'Create the file or fix the reference',
    };
  },
};

/**
 * Low Confidence Policy - Warns about low-confidence claims
 */
const lowConfidencePolicy: Policy = {
  id: 'low-confidence',
  name: 'Low Confidence Warning',
  description: 'Warns about claims with low extraction confidence',
  enabled: true,
  tier: 'warn',
  appliesTo: ['function_call', 'type_reference'],
  evaluate(claim: Claim, evidence: Evidence): PolicyViolation | null {
    if (claim.confidence < 0.5 && !evidence.found) {
      return {
        policyId: 'low-confidence',
        claimId: claim.id,
        message: `Low confidence claim: ${claim.value} (${Math.round(claim.confidence * 100)}%)`,
        severity: 'low',
        tier: 'warn',
        suggestion: 'Verify this reference is correct',
      };
    }
    return null;
  },
};

// ============================================================================
// Policy Engine
// ============================================================================

/**
 * All built-in policies
 */
const BUILTIN_POLICIES: Policy[] = [
  ghostRoutePolicy,
  ghostEnvPolicy,
  ghostImportPolicy,
  ghostFilePolicy,
  lowConfidencePolicy,
];

/**
 * Policy Engine - evaluates claims against policies
 */
export class PolicyEngine {
  private policies: Policy[];

  constructor(enabledPolicies?: string[]) {
    if (enabledPolicies) {
      this.policies = BUILTIN_POLICIES.filter(p => enabledPolicies.includes(p.id));
    } else {
      this.policies = BUILTIN_POLICIES.filter(p => p.enabled);
    }
  }

  /**
   * Evaluate all policies against a claim and its evidence
   */
  evaluate(claim: Claim, evidence: Evidence): PolicyViolation[] {
    const violations: PolicyViolation[] = [];

    for (const policy of this.policies) {
      if (!policy.appliesTo.includes(claim.type)) continue;
      
      const violation = policy.evaluate(claim, evidence);
      if (violation) {
        violations.push(violation);
      }
    }

    return violations;
  }

  /**
   * Evaluate all claims and return a decision
   */
  evaluateAll(claims: Claim[], evidenceMap: Map<string, Evidence>): PolicyDecision {
    const allViolations: PolicyViolation[] = [];

    for (const claim of claims) {
      const evidence = evidenceMap.get(claim.id) ?? createNotFoundEvidence(claim.id);
      const violations = this.evaluate(claim, evidence);
      allViolations.push(...violations);
    }

    const hardBlocks = allViolations.filter(v => v.tier === 'hard_block');
    const softBlocks = allViolations.filter(v => v.tier === 'soft_block');

    const allowed = hardBlocks.length === 0;
    const message = allowed
      ? softBlocks.length > 0
        ? `${softBlocks.length} soft block(s) found but allowed`
        : 'All policies passed'
      : `Blocked: ${hardBlocks.length} hard block violation(s)`;

    return {
      allowed,
      violations: allViolations,
      message,
    };
  }

  /**
   * Get enabled policies
   */
  getPolicies(): Policy[] {
    return this.policies;
  }

  /**
   * Enable a policy by ID
   */
  enablePolicy(policyId: string): void {
    const policy = BUILTIN_POLICIES.find(p => p.id === policyId);
    if (policy && !this.policies.includes(policy)) {
      this.policies.push(policy);
    }
  }

  /**
   * Disable a policy by ID
   */
  disablePolicy(policyId: string): void {
    this.policies = this.policies.filter(p => p.id !== policyId);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getRoutePrefix(route: string): string {
  const parts = route.split('/').filter(Boolean);
  if (parts.length <= 2) return route;
  return '/' + parts.slice(0, 2).join('/') + '/';
}

function createNotFoundEvidence(claimId: string): Evidence {
  return {
    claimId,
    found: false,
    source: 'truthpack',
    confidence: 0,
    details: {},
  };
}

/**
 * Create a policy engine instance
 */
export function createPolicyEngine(enabledPolicies?: string[]): PolicyEngine {
  return new PolicyEngine(enabledPolicies);
}

/**
 * Get list of available policy IDs
 */
export function getAvailablePolicies(): string[] {
  return BUILTIN_POLICIES.map(p => p.id);
}
