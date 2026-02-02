/**
 * ISL Studio Integration for VibeCheck
 * 
 * Combines VibeCheck's truthpack validation with ISL Studio's policy packs
 * for comprehensive code governance.
 * 
 * @module @isl-lang/firewall/isl-studio
 */

import type {
  FirewallConfig,
  FirewallResult,
  FirewallRequest,
  PolicyViolation,
} from './types.js';

import { AgentFirewall } from './agent-firewall.js';

/**
 * ISL Studio policy rule context
 */
interface ISLRuleContext {
  filePath: string;
  content: string;
  line?: number;
  projectRoot?: string;
}

/**
 * ISL Studio violation
 */
interface ISLViolation {
  ruleId: string;
  message: string;
  line?: number;
  tier: 'hard_block' | 'soft_block' | 'warn';
  suggestion?: string;
}

/**
 * ISL Studio gate result
 */
interface ISLGateResult {
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  violations: ISLViolation[];
}

/**
 * Combined VibeCheck + ISL Studio result
 */
export interface IntegratedGateResult extends FirewallResult {
  islStudio: {
    verdict: 'SHIP' | 'NO_SHIP';
    score: number;
    violations: ISLViolation[];
  };
  combined: {
    verdict: 'SHIP' | 'NO_SHIP';
    totalViolations: number;
    hardBlocks: number;
    softBlocks: number;
    warnings: number;
  };
}

/**
 * Integrated ISL Studio + VibeCheck Firewall
 * 
 * Runs both VibeCheck's truthpack validation AND ISL Studio's policy packs
 */
export class IntegratedFirewall {
  private vibecheck: AgentFirewall;
  private islPolicies: Map<string, ISLPolicy>;

  constructor(config: Partial<FirewallConfig> = {}) {
    this.vibecheck = new AgentFirewall(config);
    this.islPolicies = new Map();
    this.loadISLPolicies();
  }

  /**
   * Load ISL Studio policy packs
   */
  private loadISLPolicies(): void {
    // Auth pack rules
    this.islPolicies.set('auth/bypass-detected', {
      id: 'auth/bypass-detected',
      tier: 'hard_block',
      pattern: /skipAuth|noAuth|auth\s*=\s*false|bypassAuth/i,
      message: 'Auth bypass pattern detected',
      suggestion: 'Remove auth bypass. Use test tokens for testing.',
    });

    this.islPolicies.set('auth/hardcoded-credentials', {
      id: 'auth/hardcoded-credentials',
      tier: 'hard_block',
      pattern: /['"`](sk_live_|pk_live_|password|secret|api_key)[a-zA-Z0-9_]{8,}['"`]/i,
      message: 'Hardcoded credentials detected',
      suggestion: 'Move secrets to environment variables (process.env.SECRET)',
    });

    this.islPolicies.set('auth/unprotected-route', {
      id: 'auth/unprotected-route',
      tier: 'soft_block',
      pattern: /\.(get|post|put|delete|patch)\s*\(\s*['"`]\/api\//i,
      negativePattern: /auth|session|jwt|bearer|token/i,
      message: 'API route may lack authentication',
      suggestion: 'Add auth middleware to protect this endpoint',
    });

    // PII pack rules
    this.islPolicies.set('pii/logged-sensitive-data', {
      id: 'pii/logged-sensitive-data',
      tier: 'hard_block',
      pattern: /console\.(log|info|debug|warn|error)\s*\([^)]*\b(ssn|password|creditCard|email|phone)\b/i,
      message: 'Sensitive data may be logged',
      suggestion: 'Remove PII from logs or mask sensitive fields',
    });

    this.islPolicies.set('pii/console-in-production', {
      id: 'pii/console-in-production',
      tier: 'soft_block',
      pattern: /console\.log\s*\(/,
      fileExclude: /\.(test|spec)\.(ts|js)$/,
      message: 'console.log should be removed in production',
      suggestion: 'Use a proper logger or remove before production',
    });

    // Payments pack rules
    this.islPolicies.set('payments/client-side-amount', {
      id: 'payments/client-side-amount',
      tier: 'hard_block',
      pattern: /req\.body\.amount|request\.body\.amount|body\.amount/i,
      message: 'Payment amount from client is dangerous',
      suggestion: 'Calculate amounts server-side from product prices',
    });

    this.islPolicies.set('payments/missing-idempotency', {
      id: 'payments/missing-idempotency',
      tier: 'soft_block',
      pattern: /stripe\.paymentIntents\.create|stripe\.charges\.create/i,
      negativePattern: /idempotencyKey|idempotency_key/i,
      message: 'Payment operation lacks idempotency key',
      suggestion: 'Add idempotencyKey to prevent duplicate charges',
    });

    // Rate limit pack rules
    this.islPolicies.set('rate-limit/auth-endpoint', {
      id: 'rate-limit/auth-endpoint',
      tier: 'soft_block',
      pattern: /\.(post|put)\s*\(\s*['"`](\/login|\/auth|\/register|\/signin|\/signup)/i,
      negativePattern: /rateLimit|rateLimiter|throttle/i,
      message: 'Auth endpoint may lack rate limiting',
      suggestion: 'Add rate limiting middleware (e.g., express-rate-limit)',
    });

    // Intent pack rules
    this.islPolicies.set('intent/missing-error-handling', {
      id: 'intent/missing-error-handling',
      tier: 'warn',
      pattern: /await\s+\w+\(.*\)/,
      negativePattern: /try\s*\{|\.catch\(|catch\s*\(/,
      message: 'Async operation may lack error handling',
      suggestion: 'Wrap async calls in try/catch or add .catch()',
    });
  }

  /**
   * Evaluate content with both VibeCheck and ISL Studio
   */
  async evaluate(request: FirewallRequest): Promise<IntegratedGateResult> {
    // Run VibeCheck (truthpack validation)
    const vibecheckResult = await this.vibecheck.evaluate(request);

    // Run ISL Studio policies
    const islResult = this.runISLPolicies(request);

    // Combine results
    const totalHardBlocks = vibecheckResult.stats.hardBlocks + 
      islResult.violations.filter(v => v.tier === 'hard_block').length;
    const totalSoftBlocks = vibecheckResult.stats.softBlocks +
      islResult.violations.filter(v => v.tier === 'soft_block').length;
    const totalWarnings = vibecheckResult.stats.warnings +
      islResult.violations.filter(v => v.tier === 'warn').length;

    const combinedVerdict = (totalHardBlocks > 0 || !vibecheckResult.allowed) 
      ? 'NO_SHIP' 
      : 'SHIP';

    // Map ISL violations to policy violations for consistent format
    const islPolicyViolations: PolicyViolation[] = islResult.violations.map(v => ({
      policyId: v.ruleId,
      claimId: `line-${v.line || 0}`,
      message: v.message,
      severity: tierToSeverity(v.tier),
      tier: v.tier,
      suggestion: v.suggestion,
    }));

    return {
      ...vibecheckResult,
      // Add ISL violations to main violations array
      violations: [...vibecheckResult.violations, ...islPolicyViolations],
      // ISL Studio specific results
      islStudio: {
        verdict: islResult.verdict,
        score: islResult.score,
        violations: islResult.violations,
      },
      // Combined summary
      combined: {
        verdict: combinedVerdict,
        totalViolations: vibecheckResult.violations.length + islResult.violations.length,
        hardBlocks: totalHardBlocks,
        softBlocks: totalSoftBlocks,
        warnings: totalWarnings,
      },
      // Update allowed based on combined result
      allowed: combinedVerdict === 'SHIP',
    };
  }

  /**
   * Run ISL Studio policies
   */
  private runISLPolicies(request: FirewallRequest): ISLGateResult {
    const violations: ISLViolation[] = [];
    const lines = request.content.split('\n');

    for (const [_, policy] of this.islPolicies) {
      // Check file exclusions
      if (policy.fileExclude && policy.fileExclude.test(request.filePath)) {
        continue;
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Skip suppressed lines
        if (line.includes('islstudio-ignore') && line.includes(policy.id)) {
          continue;
        }
        if (line.includes('vibecheck-ignore')) {
          continue;
        }

        // Check pattern match
        if (policy.pattern.test(line)) {
          // If there's a negative pattern, check if it's present in the file
          if (policy.negativePattern) {
            if (policy.negativePattern.test(request.content)) {
              continue; // Negative pattern found, skip this violation
            }
          }

          violations.push({
            ruleId: policy.id,
            message: policy.message,
            line: lineNum,
            tier: policy.tier,
            suggestion: policy.suggestion,
          });
        }
      }
    }

    // Calculate score
    const hardBlockCount = violations.filter(v => v.tier === 'hard_block').length;
    const softBlockCount = violations.filter(v => v.tier === 'soft_block').length;
    const warnCount = violations.filter(v => v.tier === 'warn').length;

    const score = Math.max(0, 100 - (hardBlockCount * 25) - (softBlockCount * 10) - (warnCount * 2));
    const verdict = hardBlockCount > 0 ? 'NO_SHIP' : 'SHIP';

    return { verdict, score, violations };
  }

  /**
   * Quick gate check - returns combined SHIP/NO_SHIP
   */
  async gate(request: FirewallRequest): Promise<{
    verdict: 'SHIP' | 'NO_SHIP';
    score: number;
    reason: string;
    violations: number;
  }> {
    const result = await this.evaluate(request);
    return {
      verdict: result.combined.verdict,
      score: result.islStudio.score,
      reason: result.combined.totalViolations > 0
        ? `${result.combined.hardBlocks} hard blocks, ${result.combined.softBlocks} soft blocks, ${result.combined.warnings} warnings`
        : 'All checks passed',
      violations: result.combined.totalViolations,
    };
  }

  /**
   * Get firewall status
   */
  getStatus(): {
    mode: string;
    vibecheckPolicies: string[];
    islStudioRules: string[];
  } {
    return {
      mode: this.vibecheck.getMode(),
      vibecheckPolicies: this.vibecheck.getStatus().policies,
      islStudioRules: Array.from(this.islPolicies.keys()),
    };
  }

  /**
   * Set firewall mode
   */
  setMode(mode: 'observe' | 'enforce' | 'lockdown'): void {
    this.vibecheck.setMode(mode);
  }
}

/**
 * Map confidence tier to severity
 */
function tierToSeverity(tier: 'hard_block' | 'soft_block' | 'warn'): 'critical' | 'high' | 'medium' | 'low' {
  switch (tier) {
    case 'hard_block': return 'critical';
    case 'soft_block': return 'medium';
    case 'warn': return 'low';
  }
}

/**
 * ISL Policy definition
 */
interface ISLPolicy {
  id: string;
  tier: 'hard_block' | 'soft_block' | 'warn';
  pattern: RegExp;
  negativePattern?: RegExp;
  fileExclude?: RegExp;
  message: string;
  suggestion?: string;
}

/**
 * Create an integrated firewall instance
 */
export function createIntegratedFirewall(config?: Partial<FirewallConfig>): IntegratedFirewall {
  return new IntegratedFirewall(config);
}

/**
 * Export for MCP tool integration
 */
export const integratedGate = {
  /**
   * Run the integrated gate (VibeCheck + ISL Studio)
   */
  async run(filePath: string, content: string, projectRoot?: string): Promise<{
    verdict: 'SHIP' | 'NO_SHIP';
    score: number;
    vibecheck: { allowed: boolean; violations: number };
    islStudio: { violations: number };
    total: { violations: number; hardBlocks: number };
  }> {
    const firewall = createIntegratedFirewall({ projectRoot });
    const result = await firewall.evaluate({ filePath, content });
    
    return {
      verdict: result.combined.verdict,
      score: result.islStudio.score,
      vibecheck: {
        allowed: result.allowed,
        violations: result.violations.filter(v => !v.policyId.startsWith('isl-')).length,
      },
      islStudio: {
        violations: result.islStudio.violations.length,
      },
      total: {
        violations: result.combined.totalViolations,
        hardBlocks: result.combined.hardBlocks,
      },
    };
  },
};
