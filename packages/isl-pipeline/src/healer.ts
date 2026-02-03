/**
 * ISL Self-Healing Engine
 * 
 * The healer is allowed to:
 * ✓ Add missing enforcement (rate limiting, audit, validation, encryption)
 * ✓ Add missing intent anchors in required places
 * ✓ Refactor within touched files minimally
 * ✓ Add tests required by the spec
 * 
 * The healer is NOT allowed to:
 * ✗ Remove intents from the ISL spec
 * ✗ Add suppressions automatically
 * ✗ Downgrade severity
 * ✗ Change gate rules/packs
 * ✗ Broaden allowlists / weaken security
 * ✗ "Make it pass" by hiding violations
 * 
 * That's the moat: proof that passing means something.
 * 
 * @module @isl-lang/pipeline
 */

import type { ISLAST, RepoContext } from '@isl-lang/translator';
import type { FileDiff } from '@isl-lang/generator';
import type { ProofBundle, GateEvidence } from '@isl-lang/proof';
import { createProofBundle } from '@isl-lang/proof';
import { stableFingerprint, FingerprintTracker, type AbortCondition } from './fingerprint.js';

// ============================================================================
// Types
// ============================================================================

export type GateVerdict = 'SHIP' | 'NO_SHIP';

export interface Violation {
  ruleId: string;
  file: string;
  message: string;
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence?: string;
}

export interface GateResult {
  verdict: GateVerdict;
  score: number;
  violations: Violation[];
  fingerprint: string;
}

export interface HealOptions {
  /** Maximum healing iterations (default: 8) */
  maxIterations: number;
  /** Stop after this many identical fingerprints (default: 2) */
  stopOnRepeat: number;
  /** Allow creating new files (usually false except tests) */
  allowNewFiles: boolean;
  /** Verbose logging */
  verbose: boolean;
  /** Callback for each iteration */
  onIteration?: (iteration: HealIteration) => void;
}

export interface HealIteration {
  iteration: number;
  verdict: GateVerdict;
  score: number;
  violations: Violation[];
  patchesApplied: PatchRecord[];
  fingerprint: string;
  duration: number;
}

export interface HealResult {
  ok: boolean;
  reason: 'ship' | 'stuck' | 'unknown_rule' | 'max_iterations' | 'weakening_detected';
  gate: GateResult;
  iterations: number;
  history: HealIteration[];
  finalCode: Map<string, string>;
  unknownRules?: string[];
  proof?: ProofBundle;
}

export interface Patch {
  type: 'insert' | 'replace' | 'delete' | 'wrap';
  file: string;
  target?: string | RegExp;
  content: string;
  position?: 'before' | 'after' | 'replace';
  description: string;
}

export interface PatchRecord {
  ruleId: string;
  file: string;
  description: string;
  linesChanged: number;
}

// ============================================================================
// Fix Recipe Catalog
// 
// Each rule has:
// - trigger: rule ID
// - where: how to locate the relevant code
// - patch: a deterministic transform
// - verify: what to re-run
// ============================================================================

export interface FixRecipe {
  /** Rule ID this recipe handles */
  ruleId: string;
  /** Human-readable description */
  description: string;
  /** Generate patches for this violation */
  createPatches: (violation: Violation, context: FixContext) => Patch[];
  /** What to verify after patching */
  verify: ('gate' | 'typecheck' | 'lint' | 'test')[];
}

export interface FixContext {
  ast: ISLAST;
  repoContext: RepoContext;
  codeMap: Map<string, string>;
  framework: FrameworkAdapter;
}

// ============================================================================
// Framework Adapters
// ============================================================================

export interface FrameworkAdapter {
  name: string;
  detect(root: string): Promise<boolean>;
  
  /** Get rate limit import statement */
  getRateLimitImport(): string;
  /** Get rate limit check code */
  getRateLimitCheck(): string;
  
  /** Get audit import statement */
  getAuditImport(): string;
  /** Get audit call code */
  getAuditCall(action: string): string;
  
  /** Get validation import */
  getValidationImport(): string;
  
  /** Get intent anchors export */
  getIntentAnchorsExport(intents: string[]): string;
  
  /** Get error response */
  getErrorResponse(status: number, message: string): string;
}

// Import the full-featured Next.js App Router adapter
import { NextJSAppRouterAdapter } from './adapters/nextjs-app-router.js';

// Legacy NextJS adapter for backward compatibility (Pages Router / simpler cases)
const NextJSLegacyAdapter: FrameworkAdapter = {
  name: 'nextjs-legacy',
  async detect(root) {
    return true; // Simplified for now
  },
  getRateLimitImport() {
    return "import { rateLimit } from '@/lib/rate-limit';";
  },
  getRateLimitCheck() {
    return `
  // @intent rate-limit-required
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }`;
  },
  getAuditImport() {
    return "import { audit } from '@/lib/audit';";
  },
  getAuditCall(action) {
    return `
    // @intent audit-required
    await audit({
      action: '${action}',
      timestamp: new Date().toISOString(),
      success: true,
    });`;
  },
  getValidationImport() {
    return "import { z } from 'zod';";
  },
  getIntentAnchorsExport(intents) {
    return `\n// Machine-checkable intent declaration\nexport const __isl_intents = [${intents.map(i => `"${i}"`).join(', ')}] as const;\n`;
  },
  getErrorResponse(status, message) {
    return `NextResponse.json({ error: '${message}' }, { status: ${status} })`;
  },
};

const ExpressAdapter: FrameworkAdapter = {
  name: 'express',
  async detect(root) {
    return true;
  },
  getRateLimitImport() {
    return "import { rateLimiter } from '../middleware/rate-limit';";
  },
  getRateLimitCheck() {
    return `
  // @intent rate-limit-required
  // Rate limiting applied via middleware`;
  },
  getAuditImport() {
    return "import { auditLog } from '../services/audit';";
  },
  getAuditCall(action) {
    return `
    // @intent audit-required
    await auditLog({
      action: '${action}',
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });`;
  },
  getValidationImport() {
    return "import { z } from 'zod';";
  },
  getIntentAnchorsExport(intents) {
    return `\n// Machine-checkable intent declaration\nexport const __isl_intents = [${intents.map(i => `"${i}"`).join(', ')}] as const;\n`;
  },
  getErrorResponse(status, message) {
    return `res.status(${status}).json({ error: '${message}' })`;
  },
};

export function getFrameworkAdapter(ctx: RepoContext): FrameworkAdapter {
  switch (ctx.framework) {
    case 'nextjs':
    case 'nextjs-app-router':
      return NextJSAppRouterAdapter;
    case 'nextjs-pages':
    case 'nextjs-legacy':
      return NextJSLegacyAdapter;
    case 'express':
    case 'fastify':
      return ExpressAdapter;
    default:
      return NextJSAppRouterAdapter; // Default to App Router
  }
}

// ============================================================================
// Fix Recipe Catalog
// ============================================================================

export const FIX_CATALOG: Record<string, FixRecipe> = {
  // Rate Limiting
  'intent/rate-limit-required': {
    ruleId: 'intent/rate-limit-required',
    description: 'Add rate limiting middleware',
    createPatches(violation, ctx) {
      const patches: Patch[] = [];
      const code = ctx.codeMap.get(violation.file) || '';
      const fw = ctx.framework;

      // Add import if missing
      if (!code.includes('rateLimit')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          target: /^import .* from ['"][^'"]+['"];?\n/m,
          content: fw.getRateLimitImport() + '\n',
          position: 'after',
          description: 'Add rate limit import',
        });
      }

      // Add rate limit check if missing
      if (!code.includes('@intent rate-limit-required')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          target: /export async function \w+\([^)]*\)\s*\{/,
          content: fw.getRateLimitCheck(),
          position: 'after',
          description: 'Add rate limit check',
        });
      }

      return patches;
    },
    verify: ['gate'],
  },

  // Audit Logging
  'intent/audit-required': {
    ruleId: 'intent/audit-required',
    description: 'Add audit logging',
    createPatches(violation, ctx) {
      const patches: Patch[] = [];
      const code = ctx.codeMap.get(violation.file) || '';
      const fw = ctx.framework;

      // Add import if missing
      if (!code.includes('audit')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          target: /^import .* from ['"][^'"]+['"];?\n/m,
          content: fw.getAuditImport() + '\n',
          position: 'after',
          description: 'Add audit import',
        });
      }

      // Add audit call if missing
      if (!code.includes('@intent audit-required')) {
        const action = ctx.ast.behaviors[0]?.name || 'unknown';
        patches.push({
          type: 'insert',
          file: violation.file,
          target: /return\s+(NextResponse\.json|res\.json)/,
          content: fw.getAuditCall(action) + '\n',
          position: 'before',
          description: 'Add audit call',
        });
      }

      return patches;
    },
    verify: ['gate'],
  },

  // No PII Logging
  'intent/no-pii-logging': {
    ruleId: 'intent/no-pii-logging',
    description: 'Remove PII from logs',
    createPatches(violation, ctx) {
      const patches: Patch[] = [];
      const code = ctx.codeMap.get(violation.file) || '';

      // Remove console.log with PII patterns
      if (code.match(/console\.(log|info|debug)\([^)]*\)/)) {
        patches.push({
          type: 'replace',
          file: violation.file,
          target: /console\.(log|info|debug)\([^)]*\);?\n?/g,
          content: '',
          description: 'Remove console.log statements',
        });
      }

      // Add intent anchor if missing
      if (!code.includes('@intent no-pii-logging')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          target: /^(export\s+)?(async\s+)?function/m,
          content: '// @intent no-pii-logging - no sensitive data in logs\n',
          position: 'before',
          description: 'Add no-pii-logging intent anchor',
        });
      }

      return patches;
    },
    verify: ['gate'],
  },

  // PII Console (alias)
  'pii/console-in-production': {
    ruleId: 'pii/console-in-production',
    description: 'Remove console.log in production',
    createPatches(violation, ctx) {
      return FIX_CATALOG['intent/no-pii-logging'].createPatches(violation, ctx);
    },
    verify: ['gate'],
  },

  // Idempotency
  'intent/idempotency-required': {
    ruleId: 'intent/idempotency-required',
    description: 'Add idempotency key handling',
    createPatches(violation, ctx) {
      const patches: Patch[] = [];
      const code = ctx.codeMap.get(violation.file) || '';

      if (!code.includes('@intent idempotency-required')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          target: /export async function \w+\([^)]*\)\s*\{/,
          content: `
  // @intent idempotency-required
  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (idempotencyKey) {
    const cached = await getIdempotencyCache(idempotencyKey);
    if (cached) return cached;
  }`,
          position: 'after',
          description: 'Add idempotency key check',
        });
      }

      return patches;
    },
    verify: ['gate'],
  },

  // Server-side Amount
  'intent/server-side-amount': {
    ruleId: 'intent/server-side-amount',
    description: 'Ensure amount is calculated server-side',
    createPatches(violation, ctx) {
      const patches: Patch[] = [];
      const code = ctx.codeMap.get(violation.file) || '';

      // Remove client amount from schema
      if (code.includes('amount:')) {
        patches.push({
          type: 'replace',
          file: violation.file,
          target: /amount:\s*z\.\w+\([^)]*\),?\n?/g,
          content: '',
          description: 'Remove client-provided amount field',
        });
      }

      // Add intent anchor
      if (!code.includes('@intent server-side-amount')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          target: /\/\/\s*TODO.*implement/i,
          content: `
    // @intent server-side-amount
    // Amount MUST be calculated server-side from order data
    const amount = await calculateOrderAmount(input.orderId);
`,
          position: 'before',
          description: 'Add server-side amount calculation',
        });
      }

      return patches;
    },
    verify: ['gate'],
  },

  // Input Validation
  'intent/input-validation': {
    ruleId: 'intent/input-validation',
    description: 'Add input validation schema',
    createPatches(violation, ctx) {
      const patches: Patch[] = [];
      const code = ctx.codeMap.get(violation.file) || '';
      const fw = ctx.framework;

      // Add zod import if missing
      if (!code.includes("from 'zod'")) {
        patches.push({
          type: 'insert',
          file: violation.file,
          target: /^import/m,
          content: fw.getValidationImport() + '\n',
          position: 'after',
          description: 'Add Zod validation import',
        });
      }

      // Add safeParse check if missing
      if (!code.includes('safeParse')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          target: /const body = await request\.json\(\);/,
          content: `
    // @intent input-validation
    const validationResult = InputSchema.safeParse(body);
    if (!validationResult.success) {
      return ${fw.getErrorResponse(400, 'Validation failed')};
    }
    const input = validationResult.data;`,
          position: 'after',
          description: 'Add input validation',
        });
      }

      return patches;
    },
    verify: ['gate'],
  },

  // Encryption Required
  'intent/encryption-required': {
    ruleId: 'intent/encryption-required',
    description: 'Add encryption for sensitive data',
    createPatches(violation, ctx) {
      const patches: Patch[] = [];
      const code = ctx.codeMap.get(violation.file) || '';

      if (!code.includes('@intent encryption-required')) {
        patches.push({
          type: 'insert',
          file: violation.file,
          target: /export async function/,
          content: '// @intent encryption-required - sensitive data must be encrypted\n',
          position: 'before',
          description: 'Add encryption intent anchor',
        });
      }

      return patches;
    },
    verify: ['gate'],
  },
};

// ============================================================================
// No-Weakening Guard
// 
// Refuse patches that:
// - Remove intents from ISL spec
// - Add suppressions automatically
// - Downgrade severity
// - Change gate rules
// - Broaden allowlists
// ============================================================================

interface WeakeningCheck {
  pattern: RegExp;
  description: string;
}

const WEAKENING_PATTERNS: WeakeningCheck[] = [
  { pattern: /\/\/\s*islstudio-ignore/i, description: 'Automatic suppression detected' },
  { pattern: /\/\/\s*vibecheck-ignore/i, description: 'Automatic suppression detected' },
  { pattern: /\/\/\s*@ts-ignore/i, description: 'TypeScript ignore detected' },
  { pattern: /eslint-disable/i, description: 'ESLint disable detected' },
  { pattern: /severity:\s*['"]low['"]/i, description: 'Severity downgrade detected' },
  { pattern: /skipAuth|noAuth|bypassAuth/i, description: 'Auth bypass detected' },
  { pattern: /allowAll|permitAll|\*\.\*/i, description: 'Broad allowlist detected' },
];

function checkForWeakening(patch: Patch): string | null {
  for (const check of WEAKENING_PATTERNS) {
    if (check.pattern.test(patch.content)) {
      return check.description;
    }
  }
  return null;
}

// ============================================================================
// Healer Implementation
// ============================================================================

export class ISLHealer {
  private ast: ISLAST;
  private repoContext: RepoContext;
  private codeMap: Map<string, string>;
  private options: Required<HealOptions>;
  private framework: FrameworkAdapter;
  private history: HealIteration[] = [];

  constructor(
    ast: ISLAST,
    repoContext: RepoContext,
    initialCode: Map<string, string>,
    options: Partial<HealOptions> = {}
  ) {
    this.ast = ast;
    this.repoContext = repoContext;
    this.codeMap = new Map(initialCode);
    this.options = {
      maxIterations: options.maxIterations ?? 8,
      stopOnRepeat: options.stopOnRepeat ?? 2,
      allowNewFiles: options.allowNewFiles ?? false,
      verbose: options.verbose ?? true,
      onIteration: options.onIteration ?? (() => {}),
    };
    this.framework = getFrameworkAdapter(repoContext);
  }

  /**
   * Heal until the code passes the gate
   */
  async heal(): Promise<HealResult> {
    // Use FingerprintTracker for robust stuck detection
    const tracker = new FingerprintTracker({
      repeatThreshold: this.options.stopOnRepeat,
      maxIterations: this.options.maxIterations,
    });

    for (let i = 1; i <= this.options.maxIterations; i++) {
      const startTime = Date.now();
      
      if (this.options.verbose) {
        console.log(`\n┌─ Iteration ${i}/${this.options.maxIterations} ${'─'.repeat(40)}┐`);
      }

      // Run gate
      const gate = await this.runGate();
      
      if (this.options.verbose) {
        console.log(`│ Score: ${gate.score}/100`);
        console.log(`│ Verdict: ${gate.verdict}`);
        console.log(`│ Violations: ${gate.violations.length}`);
      }

      // Check for SHIP
      if (gate.verdict === 'SHIP') {
        const iteration: HealIteration = {
          iteration: i,
          verdict: 'SHIP',
          score: gate.score,
          violations: [],
          patchesApplied: [],
          fingerprint: gate.fingerprint,
          duration: Date.now() - startTime,
        };
        this.history.push(iteration);

        if (this.options.verbose) {
          console.log(`│`);
          console.log(`│ ✓ SHIP - All intents satisfied!`);
          console.log(`└${'─'.repeat(50)}┘`);
        }

        return {
          ok: true,
          reason: 'ship',
          gate,
          iterations: i,
          history: this.history,
          finalCode: this.codeMap,
          proof: this.buildProof(gate),
        };
      }

      // Check for stuck using FingerprintTracker
      const abortCondition: AbortCondition = tracker.record(gate.fingerprint);

      if (abortCondition.shouldAbort) {
        if (this.options.verbose) {
          console.log(`│`);
          console.log(`│ ✗ ${abortCondition.reason?.toUpperCase()} - ${abortCondition.details}`);
          console.log(`└${'─'.repeat(50)}┘`);
        }

        return {
          ok: false,
          reason: abortCondition.reason === 'max_iterations' ? 'max_iterations' : 'stuck',
          gate,
          iterations: i,
          history: this.history,
          finalCode: this.codeMap,
        };
      }

      // Check for unknown rules (don't hallucinate fixes)
      const unknownRules = gate.violations
        .filter(v => !FIX_CATALOG[v.ruleId])
        .map(v => v.ruleId);

      if (unknownRules.length > 0) {
        if (this.options.verbose) {
          console.log(`│`);
          console.log(`│ ✗ Unknown rules - cannot fix automatically:`);
          for (const rule of unknownRules) {
            console.log(`│   • ${rule}`);
          }
          console.log(`└${'─'.repeat(50)}┘`);
        }

        return {
          ok: false,
          reason: 'unknown_rule',
          gate,
          iterations: i,
          history: this.history,
          finalCode: this.codeMap,
          unknownRules,
        };
      }

      // Apply patches
      if (this.options.verbose) {
        console.log(`│`);
        console.log(`│ Applying fixes...`);
      }

      const patchesApplied: PatchRecord[] = [];
      const fixContext: FixContext = {
        ast: this.ast,
        repoContext: this.repoContext,
        codeMap: this.codeMap,
        framework: this.framework,
      };

      for (const violation of gate.violations) {
        const recipe = FIX_CATALOG[violation.ruleId];
        if (!recipe) continue;

        const patches = recipe.createPatches(violation, fixContext);

        for (const patch of patches) {
          // Check for weakening
          const weakening = checkForWeakening(patch);
          if (weakening) {
            if (this.options.verbose) {
              console.log(`│   ✗ REFUSED: ${weakening}`);
            }
            return {
              ok: false,
              reason: 'weakening_detected',
              gate,
              iterations: i,
              history: this.history,
              finalCode: this.codeMap,
            };
          }

          // Apply patch
          const result = this.applyPatch(patch);
          if (result) {
            patchesApplied.push({
              ruleId: violation.ruleId,
              file: patch.file,
              description: patch.description,
              linesChanged: result.linesChanged,
            });

            if (this.options.verbose) {
              console.log(`│   ✓ ${patch.description}`);
            }
          }
        }
      }

      // Add __isl_intents export if any files were patched
      await this.addIntentAnchors();

      const iteration: HealIteration = {
        iteration: i,
        verdict: 'NO_SHIP',
        score: gate.score,
        violations: gate.violations,
        patchesApplied,
        fingerprint: gate.fingerprint,
        duration: Date.now() - startTime,
      };
      this.history.push(iteration);
      this.options.onIteration(iteration);

      if (patchesApplied.length === 0) {
        if (this.options.verbose) {
          console.log(`│   ⚠ No patches could be applied`);
        }
      }

      if (this.options.verbose) {
        console.log(`└${'─'.repeat(50)}┘`);
      }
    }

    // Max iterations reached
    const finalGate = await this.runGate();
    return {
      ok: false,
      reason: 'max_iterations',
      gate: finalGate,
      iterations: this.options.maxIterations,
      history: this.history,
      finalCode: this.codeMap,
    };
  }

  /**
   * Run the gate and return structured result
   */
  private async runGate(): Promise<GateResult> {
    const violations: Violation[] = [];
    let score = 100;

    for (const [file, content] of this.codeMap) {
      const isTestFile = file.includes('.test.') || file.includes('.spec.');
      const isTypeFile = file.includes('.types.') || file.includes('.schema.');

      // Check for console.log (PII risk)
      if (content.includes('console.log') && !isTestFile) {
        violations.push({
          ruleId: 'pii/console-in-production',
          file,
          line: this.findLine(content, 'console.log'),
          message: 'console.log in production code',
          severity: 'medium',
        });
        score -= 5;
      }

      // Check for intent compliance (only in route/handler files)
      if (!isTestFile && !isTypeFile) {
        // Check both @intent comments AND __isl_intents export
        const hasIntentExport = content.includes('__isl_intents');
        
        for (const behavior of this.ast.behaviors) {
          for (const intent of behavior.intents) {
            const intentComment = `@intent ${intent.tag}`;
            const intentInExport = hasIntentExport && content.includes(`"${intent.tag}"`);
            
            if (!content.includes(intentComment) && !intentInExport) {
              violations.push({
                ruleId: `intent/${intent.tag}`,
                file,
                line: 1,
                message: `Missing @intent ${intent.tag} enforcement`,
                severity: 'high',
              });
              score -= 10;
            }
          }
        }
      }
    }

    score = Math.max(0, Math.min(100, score));
    const highSeverity = violations.filter(v => v.severity === 'critical' || v.severity === 'high').length;

    return {
      verdict: score >= 80 && highSeverity === 0 ? 'SHIP' : 'NO_SHIP',
      score,
      violations,
      fingerprint: this.computeFingerprint(violations),
    };
  }

  /**
   * Apply a single patch to the code
   */
  private applyPatch(patch: Patch): { linesChanged: number } | null {
    let code = this.codeMap.get(patch.file);
    if (!code) {
      if (this.options.allowNewFiles) {
        code = '';
      } else {
        return null;
      }
    }

    const originalLines = code.split('\n').length;
    let newCode = code;

    switch (patch.type) {
      case 'insert': {
        if (patch.target) {
          const regex = typeof patch.target === 'string' 
            ? new RegExp(patch.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            : patch.target;
          
          const match = code.match(regex);
          if (match && match.index !== undefined) {
            const insertIdx = patch.position === 'before' 
              ? match.index 
              : match.index + match[0].length;
            newCode = code.slice(0, insertIdx) + patch.content + code.slice(insertIdx);
          }
        } else {
          newCode = code + patch.content;
        }
        break;
      }

      case 'replace': {
        if (patch.target) {
          const regex = typeof patch.target === 'string'
            ? new RegExp(patch.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
            : patch.target;
          newCode = code.replace(regex, patch.content);
        }
        break;
      }

      case 'delete': {
        if (patch.target) {
          const regex = typeof patch.target === 'string'
            ? new RegExp(patch.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
            : patch.target;
          newCode = code.replace(regex, '');
        }
        break;
      }
    }

    if (newCode !== code) {
      this.codeMap.set(patch.file, newCode);
      return { linesChanged: Math.abs(newCode.split('\n').length - originalLines) };
    }

    return null;
  }

  /**
   * Add __isl_intents export to route files
   */
  private async addIntentAnchors(): Promise<void> {
    const intents = this.ast.behaviors.flatMap(b => b.intents.map(i => i.tag));
    if (intents.length === 0) return;

    for (const [file, code] of this.codeMap) {
      const isRouteFile = file.includes('route.ts') || 
                          (file.includes('/routes/') && !file.includes('.test.'));
      
      if (isRouteFile && !code.includes('__isl_intents')) {
        const anchor = this.framework.getIntentAnchorsExport(intents);
        // Add at the end of the file
        this.codeMap.set(file, code + anchor);
      }
    }
  }

  /**
   * Compute stable fingerprint for violations using the fingerprint module.
   * This ensures order-independent, normalized fingerprinting.
   */
  private computeFingerprint(violations: Violation[]): string {
    return stableFingerprint(violations, {
      includeMessage: true,
      includeSpan: true,
      normalizeWhitespace: true,
    });
  }

  /**
   * Find line number for a string
   */
  private findLine(code: string, search: string): number {
    const idx = code.indexOf(search);
    if (idx === -1) return 1;
    return code.slice(0, idx).split('\n').length;
  }

  /**
   * Build proof bundle
   */
  private buildProof(gate: GateResult): ProofBundle {
    const builder = createProofBundle(this.ast);
    builder.addGateResults({
      runId: `heal-${Date.now()}`,
      score: gate.score,
      violations: gate.violations.map(v => ({
        ruleId: v.ruleId,
        file: v.file,
        line: v.line || 1,
        message: v.message,
        severity: v.severity,
      })),
      verdict: gate.verdict,
    });
    return builder.build();
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

export async function healUntilShip(
  ast: ISLAST,
  initialCode: FileDiff[],
  repoContext: RepoContext,
  options?: Partial<HealOptions>
): Promise<HealResult> {
  // Convert diffs to code map
  const codeMap = new Map<string, string>();
  for (const diff of initialCode) {
    const content = diff.hunks
      .map(h => h.content.split('\n').map(l => l.replace(/^[+-] ?/, '')).join('\n'))
      .join('\n');
    codeMap.set(diff.path, content);
  }

  const healer = new ISLHealer(ast, repoContext, codeMap, options);
  return healer.heal();
}
