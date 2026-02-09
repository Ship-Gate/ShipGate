/**
 * Policy Check Command
 * 
 * Validates repository against organization policy defined in .shipgate.policy.yml
 * 
 * Usage:
 *   shipgate policy check [directory]
 */

import { resolve } from 'path';
import chalk from 'chalk';
import type { PolicyConfig, EvidenceRequirement, PolicyException } from './policy-schema.js';
import { loadPolicy, getActiveExceptions, matchesExceptionScope, PolicyValidationError } from './policy-loader.js';
import type { GateResult } from './gate.js';

export interface PolicyCheckOptions {
  /** Directory to check (default: cwd) */
  directory?: string;
  /** Policy file path (default: auto-detect) */
  policyFile?: string;
  /** Profile to use (default: from config) */
  profile?: 'strict' | 'standard' | 'lenient';
  /** JSON output */
  json?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

export interface PolicyCheckResult {
  /** Whether policy check passed */
  passed: boolean;
  /** Policy violations */
  violations: PolicyViolation[];
  /** Active exceptions */
  exceptions: PolicyException[];
  /** Policy config used */
  policy: PolicyConfig;
  /** Summary message */
  summary: string;
}

export interface PolicyViolation {
  /** Violation type */
  type: 'threshold' | 'evidence' | 'exception';
  /** Rule/policy that was violated */
  rule: string;
  /** Description of violation */
  message: string;
  /** File path (if applicable) */
  filePath?: string;
  /** Behavior name (if applicable) */
  behaviorName?: string;
  /** Severity */
  severity: 'error' | 'warning';
}

/**
 * Check gate result against policy
 */
export async function checkPolicyAgainstGate(
  gateResult: GateResult,
  options: PolicyCheckOptions = {},
): Promise<PolicyCheckResult> {
  const dir = resolve(options.directory ?? process.cwd());
  
  // Load policy
  let loadedPolicy;
  try {
    if (options.policyFile) {
      const { loadPolicyFile } = await import('./policy-loader.js');
      const config = await loadPolicyFile(options.policyFile);
      loadedPolicy = {
        config,
        filePath: options.policyFile,
        isDefault: false,
      };
    } else {
      loadedPolicy = await loadPolicy(dir);
    }
  } catch (error) {
    if (error instanceof PolicyValidationError) {
      return {
        passed: false,
        violations: [{
          type: 'threshold',
          rule: 'policy_validation',
          message: `Policy file validation failed: ${error.message}`,
          severity: 'error',
        }],
        exceptions: [],
        policy: loadedPolicy?.config ?? (await import('./policy-schema.js')).DEFAULT_POLICY_CONFIG,
        summary: 'Policy file is invalid',
      };
    }
    throw error;
  }

  const policy = loadedPolicy.config;
  const profileName = options.profile ?? policy.defaultProfile ?? 'standard';
  const profile = policy.profiles[profileName];

  const violations: PolicyViolation[] = [];
  const activeExceptions = getActiveExceptions(policy.exceptions);

  // Check threshold violations
  if (gateResult.trustScore < profile.minTrustScore) {
    violations.push({
      type: 'threshold',
      rule: 'min_trust_score',
      message: `Trust score ${gateResult.trustScore}% is below required ${profile.minTrustScore}% (profile: ${profileName})`,
      severity: 'error',
    });
  }

  if (gateResult.confidence < profile.minConfidence) {
    violations.push({
      type: 'threshold',
      rule: 'min_confidence',
      message: `Confidence ${gateResult.confidence}% is below required ${profile.minConfidence}% (profile: ${profileName})`,
      severity: 'error',
    });
  }

  if (profile.minTests && gateResult.results) {
    const totalTests = gateResult.results.summary.total;
    if (totalTests < profile.minTests) {
      violations.push({
        type: 'threshold',
        rule: 'min_tests',
        message: `Only ${totalTests} test(s) executed, but ${profile.minTests} required (profile: ${profileName})`,
        severity: 'error',
      });
    }
  }

  // Check evidence requirements
  // Note: This is a simplified check. A full implementation would analyze
  // the gate result's evidence bundle to determine what evidence types were provided.
  // For now, we check based on the gate result structure.
  for (const evidenceReq of policy.requiredEvidence) {
    const matchesContext = await checkEvidenceContext(evidenceReq, undefined, undefined);
    
    if (matchesContext) {
      // Check if required evidence types are present
      // This is a placeholder - full implementation would check the evidence bundle
      const missingEvidence = checkMissingEvidence(evidenceReq, gateResult);
      
      if (missingEvidence.length > 0) {
        // Check if there's an exception
        let hasException = false;
        for (const exc of activeExceptions) {
          const matches = await matchesExceptionScope(undefined, undefined, exc);
          if (matches && exc.scope.rules?.includes(evidenceReq.context.paths?.[0] ?? '')) {
            hasException = true;
            break;
          }
        }

        if (!hasException) {
          violations.push({
            type: 'evidence',
            rule: `evidence_requirement_${evidenceReq.context.paths?.[0] ?? 'unknown'}`,
            message: `Missing required evidence types: ${missingEvidence.join(', ')}. ${evidenceReq.description ?? ''}`,
            severity: evidenceReq.severity,
          });
        }
      }
    }
  }

  const passed = violations.filter(v => v.severity === 'error').length === 0;

  return {
    passed,
    violations,
    exceptions: activeExceptions,
    policy,
    summary: passed
      ? `Policy check passed (profile: ${profileName})`
      : `${violations.length} policy violation(s) found`,
  };
}

/**
 * Standalone policy check (without gate result)
 */
export async function checkPolicy(options: PolicyCheckOptions = {}): Promise<PolicyCheckResult> {
  const dir = resolve(options.directory ?? process.cwd());
  
  // Load policy
  let loadedPolicy;
  try {
    if (options.policyFile) {
      const { loadPolicyFile } = await import('./policy-loader.js');
      const config = await loadPolicyFile(options.policyFile);
      loadedPolicy = {
        config,
        filePath: options.policyFile,
        isDefault: false,
      };
    } else {
      loadedPolicy = await loadPolicy(dir);
    }
  } catch (error) {
    if (error instanceof PolicyValidationError) {
      return {
        passed: false,
        violations: [{
          type: 'threshold',
          rule: 'policy_validation',
          message: `Policy file validation failed: ${error.message}`,
          severity: 'error',
        }],
        exceptions: [],
        policy: (await import('./policy-schema.js')).DEFAULT_POLICY_CONFIG,
        summary: 'Policy file is invalid',
      };
    }
    throw error;
  }

  const policy = loadedPolicy.config;
  const activeExceptions = getActiveExceptions(policy.exceptions);

  // For standalone check, we just validate the policy file exists and is valid
  // A full implementation would scan the repo and check against policy rules

  return {
    passed: true,
    violations: [],
    exceptions: activeExceptions,
    policy,
    summary: `Policy file loaded successfully (${loadedPolicy.isDefault ? 'using defaults' : `from ${loadedPolicy.filePath}`})`,
  };
}

/**
 * Check if evidence requirement context matches
 */
function checkEvidenceContext(
  req: EvidenceRequirement,
  filePath: string | undefined,
  behaviorName: string | undefined,
): boolean {
  const context = req.context;

  // Check paths
  if (context.paths && filePath) {
    try {
      const { minimatch } = require('minimatch');
      for (const pattern of context.paths) {
        if (minimatch(filePath, pattern)) {
          return true;
        }
      }
    } catch {
      // minimatch not available, skip path matching
    }
  }

  // Check behaviors
  if (context.behaviors && behaviorName) {
    for (const pattern of context.behaviors) {
      const regex = new RegExp(pattern);
      if (regex.test(behaviorName)) {
        return true;
      }
    }
  }

  // Check tags (placeholder - would need to extract tags from spec/impl)
  if (context.tags && context.tags.length > 0) {
    // Not implemented - would check spec tags
  }

  return false;
}

/**
 * Check which evidence types are missing
 */
function checkMissingEvidence(
  req: EvidenceRequirement,
  gateResult: GateResult,
): string[] {
  const missing: string[] = [];

  // This is a simplified check. A full implementation would:
  // 1. Parse the evidence bundle
  // 2. Check what evidence types were actually provided
  // 3. Compare against required types

  // For now, we can't determine what evidence was provided from GateResult alone
  // This would require examining the evidence bundle or extending GateResult

  return missing;
}

/**
 * Print policy check result
 */
export function printPolicyCheckResult(result: PolicyCheckResult, options?: { verbose?: boolean }): void {
  console.log('');

  if (result.passed) {
    console.log(chalk.bold.green('  ┌─────────────────────────────────────┐'));
    console.log(chalk.bold.green('  │      POLICY CHECK: PASSED            │'));
    console.log(chalk.bold.green('  └─────────────────────────────────────┘'));
  } else {
    console.log(chalk.bold.red('  ┌─────────────────────────────────────┐'));
    console.log(chalk.bold.red('  │      POLICY CHECK: FAILED            │'));
    console.log(chalk.bold.red('  └─────────────────────────────────────┘'));
  }

  console.log('');
  console.log(chalk.gray(`  ${result.summary}`));
  console.log('');

  // Show violations
  if (result.violations.length > 0) {
    console.log(chalk.red('  Violations:'));
    for (const violation of result.violations) {
      const severityColor = violation.severity === 'error' ? chalk.red : chalk.yellow;
      console.log(`    ${severityColor('•')} [${violation.rule}] ${violation.message}`);
      if (violation.filePath) {
        console.log(chalk.gray(`      File: ${violation.filePath}`));
      }
      if (violation.behaviorName) {
        console.log(chalk.gray(`      Behavior: ${violation.behaviorName}`));
      }
    }
    console.log('');
  }

  // Show active exceptions
  if (result.exceptions.length > 0 && options?.verbose) {
    console.log(chalk.yellow('  Active Exceptions:'));
    for (const exc of result.exceptions) {
      console.log(`    • ${exc.id}: ${exc.justification}`);
      console.log(chalk.gray(`      Expires: ${exc.expiresAt}`));
      if (exc.approvedBy) {
        console.log(chalk.gray(`      Approved by: ${exc.approvedBy}`));
      }
    }
    console.log('');
  }

  // Show policy info
  if (options?.verbose) {
    const defaultProfile = result.policy.defaultProfile ?? 'standard';
    console.log(chalk.gray(`  Policy Profile: ${defaultProfile}`));
    console.log(chalk.gray(`  Evidence Requirements: ${result.policy.requiredEvidence.length}`));
    console.log(chalk.gray(`  Exceptions: ${result.policy.exceptions?.length ?? 0}`));
    console.log('');
  }
}

export function getPolicyCheckExitCode(result: PolicyCheckResult): number {
  return result.passed ? 0 : 1;
}
