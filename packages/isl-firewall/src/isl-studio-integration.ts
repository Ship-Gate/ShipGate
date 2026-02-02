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
   * Load ISL Studio policy packs (25 rules across 5 packs)
   */
  private loadISLPolicies(): void {
    // ========================================================================
    // AUTH PACK (5 rules)
    // ========================================================================
    this.islPolicies.set('auth/bypass-detected', {
      id: 'auth/bypass-detected',
      tier: 'hard_block',
      pattern: /skipAuth|noAuth|auth\s*=\s*false|bypassAuth|disableAuth/i,
      message: 'Auth bypass pattern detected',
      suggestion: 'Remove auth bypass. Use test tokens for testing.',
    });

    this.islPolicies.set('auth/hardcoded-credentials', {
      id: 'auth/hardcoded-credentials',
      tier: 'hard_block',
      pattern: /['"`](sk_live_|pk_live_|sk_test_|AKIA|password|secret|api_key|apikey|auth_token)[a-zA-Z0-9_]{8,}['"`]/i,
      message: 'Hardcoded credentials detected',
      suggestion: 'Move secrets to environment variables (process.env.SECRET)',
    });

    this.islPolicies.set('auth/unprotected-route', {
      id: 'auth/unprotected-route',
      tier: 'soft_block',
      pattern: /\.(get|post|put|delete|patch)\s*\(\s*['"`]\/api\/(admin|user|account|profile)/i,
      negativePattern: /auth|session|jwt|bearer|token|middleware/i,
      message: 'Sensitive API route may lack authentication',
      suggestion: 'Add auth middleware to protect this endpoint',
    });

    this.islPolicies.set('auth/jwt-none-algorithm', {
      id: 'auth/jwt-none-algorithm',
      tier: 'hard_block',
      pattern: /algorithm\s*[:=]\s*['"`]none['"`]|alg\s*[:=]\s*['"`]none['"`]/i,
      message: 'JWT "none" algorithm is insecure',
      suggestion: 'Use a secure algorithm like RS256 or HS256',
    });

    this.islPolicies.set('auth/session-fixation', {
      id: 'auth/session-fixation',
      tier: 'hard_block',
      pattern: /req\.session\s*=\s*req\.body|session\.id\s*=\s*req\.(body|query|params)/i,
      message: 'Potential session fixation vulnerability',
      suggestion: 'Regenerate session ID after authentication',
    });

    // ========================================================================
    // PII PACK (5 rules)
    // ========================================================================
    this.islPolicies.set('pii/logged-sensitive-data', {
      id: 'pii/logged-sensitive-data',
      tier: 'hard_block',
      pattern: /console\.(log|info|debug|warn|error)\s*\([^)]*\b(ssn|password|creditCard|cardNumber|cvv|email|phone|address)\b/i,
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

    this.islPolicies.set('pii/unmasked-response', {
      id: 'pii/unmasked-response',
      tier: 'soft_block',
      pattern: /res\.(json|send)\s*\([^)]*\b(password|ssn|creditCard|cardNumber)\b/i,
      message: 'Sensitive data may be exposed in response',
      suggestion: 'Mask or exclude sensitive fields from API responses',
    });

    this.islPolicies.set('pii/missing-encryption', {
      id: 'pii/missing-encryption',
      tier: 'soft_block',
      pattern: /\b(ssn|creditCard|cardNumber|bankAccount)\s*[:=]/i,
      negativePattern: /encrypt|hash|bcrypt|argon|crypto/i,
      message: 'Sensitive data may lack encryption at rest',
      suggestion: 'Encrypt sensitive data before storage',
    });

    this.islPolicies.set('pii/exposed-in-url', {
      id: 'pii/exposed-in-url',
      tier: 'hard_block',
      pattern: /\?(.*&)?(password|token|secret|apiKey|api_key)=/i,
      message: 'Sensitive data in URL query string',
      suggestion: 'Move sensitive data to request body or headers',
    });

    // ========================================================================
    // PAYMENTS PACK (5 rules)
    // ========================================================================
    this.islPolicies.set('payments/client-side-amount', {
      id: 'payments/client-side-amount',
      tier: 'hard_block',
      pattern: /req\.body\.amount|request\.body\.amount|body\.amount|body\.price/i,
      message: 'Payment amount from client is dangerous',
      suggestion: 'Calculate amounts server-side from product prices',
    });

    this.islPolicies.set('payments/missing-idempotency', {
      id: 'payments/missing-idempotency',
      tier: 'soft_block',
      pattern: /stripe\.paymentIntents\.create|stripe\.charges\.create|createPayment/i,
      negativePattern: /idempotencyKey|idempotency_key|idempotent/i,
      message: 'Payment operation lacks idempotency key',
      suggestion: 'Add idempotencyKey to prevent duplicate charges',
    });

    this.islPolicies.set('payments/missing-webhook-verification', {
      id: 'payments/missing-webhook-verification',
      tier: 'hard_block',
      pattern: /\/webhook|\/stripe-webhook|stripe\.webhooks/i,
      negativePattern: /constructEvent|verifySignature|stripe\.webhooks\.constructEvent/i,
      message: 'Webhook may lack signature verification',
      suggestion: 'Verify webhook signature with stripe.webhooks.constructEvent()',
    });

    this.islPolicies.set('payments/client-side-discount', {
      id: 'payments/client-side-discount',
      tier: 'hard_block',
      pattern: /req\.body\.discount|body\.discount|body\.coupon.*amount/i,
      message: 'Discount amount from client is dangerous',
      suggestion: 'Validate coupon codes server-side against database',
    });

    this.islPolicies.set('payments/currency-mismatch', {
      id: 'payments/currency-mismatch',
      tier: 'soft_block',
      pattern: /currency\s*[:=]\s*req\.body|body\.currency/i,
      message: 'Currency from client may allow manipulation',
      suggestion: 'Set currency server-side based on user locale/config',
    });

    // ========================================================================
    // RATE LIMIT PACK (5 rules)
    // ========================================================================
    this.islPolicies.set('rate-limit/auth-endpoint', {
      id: 'rate-limit/auth-endpoint',
      tier: 'soft_block',
      pattern: /\.(post|put)\s*\(\s*['"`](\/login|\/auth|\/register|\/signin|\/signup|\/forgot-password)/i,
      negativePattern: /rateLimit|rateLimiter|throttle|slowDown/i,
      message: 'Auth endpoint may lack rate limiting',
      suggestion: 'Add rate limiting middleware (e.g., express-rate-limit)',
    });

    this.islPolicies.set('rate-limit/api-endpoint', {
      id: 'rate-limit/api-endpoint',
      tier: 'warn',
      pattern: /\.(get|post|put|delete)\s*\(\s*['"`]\/api\//i,
      negativePattern: /rateLimit|rateLimiter|throttle|slowDown/i,
      message: 'API endpoint may benefit from rate limiting',
      suggestion: 'Consider adding rate limiting for abuse prevention',
    });

    this.islPolicies.set('rate-limit/password-reset', {
      id: 'rate-limit/password-reset',
      tier: 'hard_block',
      pattern: /\.(post)\s*\(\s*['"`](\/reset-password|\/forgot-password|\/password-reset)/i,
      negativePattern: /rateLimit|rateLimiter|throttle/i,
      message: 'Password reset endpoint MUST have rate limiting',
      suggestion: 'Add strict rate limiting (e.g., 3 requests per hour)',
    });

    this.islPolicies.set('rate-limit/file-upload', {
      id: 'rate-limit/file-upload',
      tier: 'soft_block',
      pattern: /multer|upload\.(single|array|fields)|formidable/i,
      negativePattern: /rateLimit|rateLimiter|throttle|limits/i,
      message: 'File upload may lack rate limiting',
      suggestion: 'Add rate limiting and file size limits',
    });

    this.islPolicies.set('rate-limit/otp-endpoint', {
      id: 'rate-limit/otp-endpoint',
      tier: 'hard_block',
      pattern: /\.(post)\s*\(\s*['"`](\/otp|\/verify-otp|\/send-otp|\/2fa)/i,
      negativePattern: /rateLimit|rateLimiter|throttle/i,
      message: 'OTP endpoint MUST have rate limiting',
      suggestion: 'Add strict rate limiting (e.g., 5 requests per 10 minutes)',
    });

    // ========================================================================
    // INTENT PACK (5 rules)
    // ========================================================================
    this.islPolicies.set('intent/missing-error-handling', {
      id: 'intent/missing-error-handling',
      tier: 'warn',
      pattern: /await\s+\w+\([^)]*\)\s*;?\s*$/m,
      negativePattern: /try\s*\{|\.catch\(|catch\s*\(/,
      message: 'Async operation may lack error handling',
      suggestion: 'Wrap async calls in try/catch or add .catch()',
    });

    this.islPolicies.set('intent/pii-logging', {
      id: 'intent/pii-logging',
      tier: 'hard_block',
      pattern: /logger?\.(info|debug|log|warn)\s*\([^)]*user\.(email|phone|ssn|address)/i,
      message: 'User PII should not be logged per intent declaration',
      suggestion: 'Remove PII from logs or use masking',
    });

    this.islPolicies.set('intent/audit-missing', {
      id: 'intent/audit-missing',
      tier: 'soft_block',
      pattern: /\.(delete|destroy|remove)\s*\(/i,
      negativePattern: /audit|log|track|record/i,
      message: 'Destructive operation may lack audit trail',
      suggestion: 'Add audit logging for compliance',
    });

    this.islPolicies.set('intent/validation-missing', {
      id: 'intent/validation-missing',
      tier: 'soft_block',
      pattern: /req\.body\.\w+\s*;|request\.body\.\w+\s*;/,
      negativePattern: /validate|zod|yup|joi|schema/i,
      message: 'Input may lack validation',
      suggestion: 'Add input validation with zod, yup, or joi',
    });

    this.islPolicies.set('intent/encryption-required', {
      id: 'intent/encryption-required',
      tier: 'hard_block',
      pattern: /\b(store|save|persist|write).*\b(password|secret|token|key)\b/i,
      negativePattern: /hash|encrypt|bcrypt|argon|crypto\.create/i,
      message: 'Sensitive data must be encrypted before storage',
      suggestion: 'Use bcrypt for passwords, encryption for tokens',
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
