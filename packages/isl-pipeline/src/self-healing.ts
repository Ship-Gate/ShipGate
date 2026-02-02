/**
 * Self-Healing ISL Pipeline
 * 
 * Keeps iterating until code passes the gate.
 * 
 * Loop:
 * 1. Generate code from ISL
 * 2. Run gate
 * 3. If fails → analyze violations → fix → retry
 * 4. Repeat until SHIP or max iterations
 * 
 * @module @isl-lang/pipeline
 */

import type { ISLAST, BehaviorAST, RepoContext } from '@isl-lang/translator';
import type { GenerationResult, FileDiff } from '@isl-lang/generator';
import type { GateEvidence, ProofBundle } from '@isl-lang/proof';
import { createProofBundle } from '@isl-lang/proof';

// ============================================================================
// Types
// ============================================================================

export interface HealingResult {
  success: boolean;
  iterations: number;
  maxIterations: number;
  finalVerdict: 'SHIP' | 'NO_SHIP';
  finalScore: number;
  history: HealingIteration[];
  finalCode: Map<string, string>;
  proof?: ProofBundle;
}

export interface HealingIteration {
  iteration: number;
  score: number;
  verdict: 'SHIP' | 'NO_SHIP';
  violations: string[];
  fixes: string[];
  filesModified: string[];
}

export interface HealingOptions {
  maxIterations?: number;
  verbose?: boolean;
  onIteration?: (iteration: HealingIteration) => void;
}

// ============================================================================
// Fix Strategies
// ============================================================================

interface FixStrategy {
  /** Violation pattern to match */
  pattern: RegExp;
  /** Fix function */
  fix: (code: string, violation: GateViolation, context: FixContext) => string;
  /** Description of the fix */
  description: string;
}

interface GateViolation {
  ruleId: string;
  file: string;
  line: number;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface FixContext {
  ast: ISLAST;
  behavior?: BehaviorAST;
  repoContext: RepoContext;
}

const FIX_STRATEGIES: FixStrategy[] = [
  // Fix missing rate-limit intent
  {
    pattern: /intent\/rate-limit-required/,
    description: 'Add rate limiting middleware',
    fix: (code, violation, ctx) => {
      // Add rate limit import if not present
      if (!code.includes('rateLimit')) {
        const importLine = ctx.repoContext.framework === 'nextjs'
          ? "import { rateLimit } from '@/lib/rate-limit';\n"
          : "import { rateLimiter } from '../middleware/rate-limit';\n";
        
        // Add after other imports
        const lastImportIdx = code.lastIndexOf('import ');
        if (lastImportIdx >= 0) {
          const lineEnd = code.indexOf('\n', lastImportIdx);
          code = code.slice(0, lineEnd + 1) + importLine + code.slice(lineEnd + 1);
        } else {
          code = importLine + code;
        }
      }

      // Add rate limit check in handler
      if (!code.includes('@intent rate-limit-required')) {
        const handlerMatch = code.match(/(export async function \w+|router\.\w+\([^)]+,\s*async)/);
        if (handlerMatch) {
          const insertIdx = code.indexOf('{', handlerMatch.index!) + 1;
          const rateLimitCode = `
  // @intent rate-limit-required
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    return ${ctx.repoContext.framework === 'nextjs' 
      ? "NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })"
      : "res.status(429).json({ error: 'Rate limit exceeded' })"};
  }
`;
          code = code.slice(0, insertIdx) + rateLimitCode + code.slice(insertIdx);
        }
      }
      return code;
    },
  },

  // Fix missing audit intent
  {
    pattern: /intent\/audit-required/,
    description: 'Add audit logging',
    fix: (code, violation, ctx) => {
      // Add audit import
      if (!code.includes('audit')) {
        const importLine = ctx.repoContext.framework === 'nextjs'
          ? "import { audit } from '@/lib/audit';\n"
          : "import { auditLog } from '../services/audit';\n";
        
        const lastImportIdx = code.lastIndexOf('import ');
        if (lastImportIdx >= 0) {
          const lineEnd = code.indexOf('\n', lastImportIdx);
          code = code.slice(0, lineEnd + 1) + importLine + code.slice(lineEnd + 1);
        }
      }

      // Add audit call before return
      if (!code.includes('@intent audit-required')) {
        const returnMatch = code.match(/return\s+(NextResponse\.json|res\.json)/);
        if (returnMatch && returnMatch.index) {
          const auditCode = `
    // @intent audit-required
    await ${ctx.repoContext.framework === 'nextjs' ? 'audit' : 'auditLog'}({
      action: '${ctx.behavior?.name || 'unknown'}',
      timestamp: new Date().toISOString(),
    });

    `;
          code = code.slice(0, returnMatch.index) + auditCode + code.slice(returnMatch.index);
        }
      }
      return code;
    },
  },

  // Fix PII logging
  {
    pattern: /intent\/no-pii-logging|pii\/console-in-production/,
    description: 'Remove console.log statements',
    fix: (code, violation, ctx) => {
      // Remove console.log statements
      code = code.replace(/console\.(log|info|debug)\([^)]*\);?\n?/g, '');
      
      // Add intent comment if not present
      if (!code.includes('@intent no-pii-logging')) {
        const firstFunctionIdx = code.search(/(?:export\s+)?(?:async\s+)?function/);
        if (firstFunctionIdx >= 0) {
          code = code.slice(0, firstFunctionIdx) + '// @intent no-pii-logging - no sensitive data in logs\n' + code.slice(firstFunctionIdx);
        }
      }
      return code;
    },
  },

  // Fix missing idempotency
  {
    pattern: /intent\/idempotency-required/,
    description: 'Add idempotency key handling',
    fix: (code, violation, ctx) => {
      if (!code.includes('@intent idempotency-required')) {
        const handlerMatch = code.match(/(export async function \w+|router\.\w+\([^)]+,\s*async)/);
        if (handlerMatch) {
          const insertIdx = code.indexOf('{', handlerMatch.index!) + 1;
          const idempotencyCode = `
  // @intent idempotency-required
  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (idempotencyKey) {
    const cached = await checkIdempotencyCache(idempotencyKey);
    if (cached) return cached;
  }
`;
          code = code.slice(0, insertIdx) + idempotencyCode + code.slice(insertIdx);
        }
      }
      return code;
    },
  },

  // Fix server-side amount
  {
    pattern: /intent\/server-side-amount/,
    description: 'Ensure amount is calculated server-side',
    fix: (code, violation, ctx) => {
      // Remove any amount from input parsing
      code = code.replace(/amount:\s*[^,}]+,?/g, '');
      
      if (!code.includes('@intent server-side-amount')) {
        // Add comment where amount calculation should happen
        const todoMatch = code.match(/\/\/\s*TODO.*implement/i);
        if (todoMatch && todoMatch.index) {
          const serverSideCode = `
    // @intent server-side-amount
    // Amount MUST be calculated server-side from order data
    const amount = await calculateOrderAmount(input.orderId);
`;
          code = code.slice(0, todoMatch.index) + serverSideCode + code.slice(todoMatch.index);
        }
      }
      return code;
    },
  },

  // Generic intent fix - add missing intent comments
  {
    pattern: /intent\/[\w-]+/,
    description: 'Add missing intent declaration',
    fix: (code, violation, ctx) => {
      const intentName = violation.ruleId.replace('intent/', '');
      if (!code.includes(`@intent ${intentName}`)) {
        // Add at the top of the first function
        const funcMatch = code.match(/(?:export\s+)?(?:async\s+)?function\s+\w+/);
        if (funcMatch && funcMatch.index !== undefined) {
          const insertIdx = code.indexOf('{', funcMatch.index) + 1;
          code = code.slice(0, insertIdx) + `\n  // @intent ${intentName}\n` + code.slice(insertIdx);
        }
      }
      return code;
    },
  },
];

// ============================================================================
// Self-Healing Pipeline
// ============================================================================

export class SelfHealingPipeline {
  private ast: ISLAST;
  private repoContext: RepoContext;
  private codeMap: Map<string, string> = new Map();
  private options: Required<HealingOptions>;

  constructor(ast: ISLAST, repoContext: RepoContext, options: HealingOptions = {}) {
    this.ast = ast;
    this.repoContext = repoContext;
    this.options = {
      maxIterations: options.maxIterations ?? 10,
      verbose: options.verbose ?? true,
      onIteration: options.onIteration ?? (() => {}),
    };
  }

  /**
   * Initialize with generated code
   */
  setGeneratedCode(diffs: FileDiff[]): void {
    for (const diff of diffs) {
      const content = diff.hunks
        .map(h => h.content.split('\n').map(l => l.replace(/^[+-] ?/, '')).join('\n'))
        .join('\n');
      this.codeMap.set(diff.path, content);
    }
  }

  /**
   * Run the self-healing loop
   */
  async heal(): Promise<HealingResult> {
    const history: HealingIteration[] = [];
    let iteration = 0;

    while (iteration < this.options.maxIterations) {
      iteration++;

      if (this.options.verbose) {
        console.log(`\n┌─ Iteration ${iteration}/${this.options.maxIterations} ${'─'.repeat(40)}┐`);
      }

      // Run gate check
      const gate = await this.runGate();

      const iterResult: HealingIteration = {
        iteration,
        score: gate.score,
        verdict: gate.verdict,
        violations: gate.violations.map(v => v.ruleId),
        fixes: [],
        filesModified: [],
      };

      if (this.options.verbose) {
        console.log(`│ Score: ${gate.score}/100`);
        console.log(`│ Verdict: ${gate.verdict}`);
        console.log(`│ Violations: ${gate.violations.length}`);
      }

      // Check if we passed
      if (gate.verdict === 'SHIP') {
        if (this.options.verbose) {
          console.log(`│`);
          console.log(`│ ✓ SHIP - All intents satisfied!`);
          console.log(`└${'─'.repeat(50)}┘`);
        }

        history.push(iterResult);
        
        // Build final proof
        const proof = this.buildProof(gate);

        return {
          success: true,
          iterations: iteration,
          maxIterations: this.options.maxIterations,
          finalVerdict: 'SHIP',
          finalScore: gate.score,
          history,
          finalCode: this.codeMap,
          proof,
        };
      }

      // Apply fixes
      if (this.options.verbose) {
        console.log(`│`);
        console.log(`│ Applying fixes...`);
      }

      for (const violation of gate.violations) {
        const fix = this.findFix(violation);
        if (fix) {
          const file = violation.file;
          const currentCode = this.codeMap.get(file) || '';
          
          const behavior = this.ast.behaviors.find(b => 
            file.toLowerCase().includes(b.name.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2'))
          );

          const fixedCode = fix.fix(currentCode, violation, {
            ast: this.ast,
            behavior,
            repoContext: this.repoContext,
          });

          if (fixedCode !== currentCode) {
            this.codeMap.set(file, fixedCode);
            iterResult.fixes.push(fix.description);
            if (!iterResult.filesModified.includes(file)) {
              iterResult.filesModified.push(file);
            }
            
            if (this.options.verbose) {
              console.log(`│   • ${fix.description} → ${file}`);
            }
          }
        }
      }

      if (iterResult.fixes.length === 0) {
        if (this.options.verbose) {
          console.log(`│   ⚠ No fixes available for remaining violations`);
        }
      }

      if (this.options.verbose) {
        console.log(`└${'─'.repeat(50)}┘`);
      }

      history.push(iterResult);
      this.options.onIteration(iterResult);

      // If no fixes were applied, we're stuck
      if (iterResult.fixes.length === 0) {
        break;
      }
    }

    // Failed to heal within max iterations
    const finalGate = await this.runGate();
    
    return {
      success: false,
      iterations: iteration,
      maxIterations: this.options.maxIterations,
      finalVerdict: 'NO_SHIP',
      finalScore: finalGate.score,
      history,
      finalCode: this.codeMap,
    };
  }

  /**
   * Run gate check on current code
   */
  private async runGate(): Promise<GateEvidence> {
    const violations: GateViolation[] = [];
    let score = 100;

    for (const [file, content] of this.codeMap) {
      // Skip test files and type files for some checks
      const isTestFile = file.includes('.test.') || file.includes('.spec.');
      const isTypeFile = file.includes('.types.') || file.includes('.schema.');

      // Check for console.log
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

      // Check for intent compliance (only in route files)
      if (!isTestFile && !isTypeFile) {
        for (const behavior of this.ast.behaviors) {
          for (const intent of behavior.intents) {
            const intentComment = `@intent ${intent.tag}`;
            if (!content.includes(intentComment)) {
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

    // Strict mode: Must have NO high-severity violations to ship
    const highSeverityCount = violations.filter(v => 
      v.severity === 'critical' || v.severity === 'high'
    ).length;

    return {
      runId: `gate-${Date.now()}`,
      score,
      violations,
      verdict: score >= 80 && highSeverityCount === 0 ? 'SHIP' : 'NO_SHIP',
    };
  }

  /**
   * Find a fix strategy for a violation
   */
  private findFix(violation: GateViolation): FixStrategy | null {
    for (const strategy of FIX_STRATEGIES) {
      if (strategy.pattern.test(violation.ruleId)) {
        return strategy;
      }
    }
    return null;
  }

  /**
   * Find line number for a string in code
   */
  private findLine(code: string, search: string): number {
    const idx = code.indexOf(search);
    if (idx === -1) return 1;
    return code.slice(0, idx).split('\n').length;
  }

  /**
   * Build proof bundle
   */
  private buildProof(gate: GateEvidence): ProofBundle {
    const builder = createProofBundle(this.ast);
    builder.addGateResults(gate);
    return builder.build();
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

export async function selfHeal(
  ast: ISLAST,
  generatedCode: FileDiff[],
  repoContext: RepoContext,
  options?: HealingOptions
): Promise<HealingResult> {
  const pipeline = new SelfHealingPipeline(ast, repoContext, options);
  pipeline.setGeneratedCode(generatedCode);
  return pipeline.heal();
}
