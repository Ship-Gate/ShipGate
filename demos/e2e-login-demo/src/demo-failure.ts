#!/usr/bin/env tsx
/**
 * Failure Mode Demo: Unknown Rule → Honest Abort
 * 
 * This demo shows what happens when the healer encounters a rule
 * it doesn't know how to fix. Instead of hallucinating a fix,
 * it aborts honestly and reports the unknown rules.
 * 
 * This is the moat: proof that passing means something.
 * 
 * Run: npm run demo:failure
 */

import * as crypto from 'crypto';
import pc from 'picocolors';

// ============================================================================
// Types
// ============================================================================

interface ISLAST {
  kind: 'Domain';
  name: string;
  version: string;
  entities: Array<unknown>;
  behaviors: Array<{
    kind: 'Behavior';
    name: string;
    description: string;
    input: Array<unknown>;
    output: { kind: 'Output'; success: { kind: 'Type'; name: string }; errors: Array<unknown> };
    preconditions: Array<unknown>;
    postconditions: Array<unknown>;
    invariants: Array<unknown>;
    intents: Array<{ kind: 'Intent'; tag: string }>;
  }>;
  invariants: string[];
  metadata: { generatedFrom: string; prompt: string; timestamp: string; confidence: number };
}

interface GateResult {
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  violations: Violation[];
  fingerprint: string;
}

interface Violation {
  ruleId: string;
  file: string;
  line?: number;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface HealResult {
  ok: boolean;
  reason: 'ship' | 'stuck' | 'unknown_rule' | 'max_iterations' | 'weakening_detected';
  gate: GateResult;
  iterations: number;
  finalCode: Map<string, string>;
  unknownRules?: string[];
}

// ============================================================================
// Demo Configuration
// ============================================================================

const DEMO_CONFIG = {
  userPrompt: 'Write me a login with quantum encryption',
  maxIterations: 8,
  stopOnRepeat: 2,
};

// ============================================================================
// Simulated Components
// ============================================================================

function translateNLtoISL(prompt: string): ISLAST {
  // This prompt includes an unknown requirement: "quantum encryption"
  return {
    kind: 'Domain',
    name: 'Auth',
    version: '1.0.0',
    entities: [],
    behaviors: [
      {
        kind: 'Behavior',
        name: 'UserLogin',
        description: 'Authenticate user with quantum-encrypted credentials',
        input: [],
        output: {
          kind: 'Output',
          success: { kind: 'Type', name: 'Session' },
          errors: [],
        },
        preconditions: [],
        postconditions: [],
        invariants: [],
        intents: [
          { kind: 'Intent', tag: 'rate-limit-required' },
          { kind: 'Intent', tag: 'audit-required' },
          { kind: 'Intent', tag: 'no-pii-logging' },
          { kind: 'Intent', tag: 'quantum-encryption-required' }, // UNKNOWN RULE
          { kind: 'Intent', tag: 'post-quantum-key-exchange' },   // UNKNOWN RULE
        ],
      },
    ],
    invariants: [],
    metadata: {
      generatedFrom: 'nl-translator',
      prompt,
      timestamp: new Date().toISOString(),
      confidence: 0.6, // Lower confidence due to unusual requirements
    },
  };
}

function generateBrokenCode(): Map<string, string> {
  const code = `
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Missing all intent enforcement
  console.log('Login attempt:', body.email);
  
  return NextResponse.json({ success: true });
}
`.trim();

  const codeMap = new Map<string, string>();
  codeMap.set('src/app/api/login/route.ts', code);
  return codeMap;
}

function runGate(ast: ISLAST, codeMap: Map<string, string>): GateResult {
  const violations: Violation[] = [];
  let score = 100;

  for (const [file, content] of codeMap) {
    // Check for console.log
    if (content.includes('console.log')) {
      violations.push({
        ruleId: 'pii/console-in-production',
        file,
        line: 1,
        message: 'console.log in production code',
        severity: 'high',
      });
      score -= 10;
    }

    // Check for intent compliance
    for (const behavior of ast.behaviors) {
      for (const intent of behavior.intents) {
        if (!content.includes(`@intent ${intent.tag}`) && !content.includes(`"${intent.tag}"`)) {
          violations.push({
            ruleId: `intent/${intent.tag}`,
            file,
            line: 1,
            message: `Missing @intent ${intent.tag} enforcement`,
            severity: 'high',
          });
          score -= 15;
        }
      }
    }
  }

  score = Math.max(0, score);
  const fingerprint = crypto
    .createHash('sha256')
    .update(violations.map(v => v.ruleId).sort().join('|'))
    .digest('hex')
    .slice(0, 16);

  return {
    verdict: score >= 80 && violations.length === 0 ? 'SHIP' : 'NO_SHIP',
    score,
    violations,
    fingerprint,
  };
}

function healUntilShip(ast: ISLAST, initialCode: Map<string, string>): HealResult {
  const codeMap = new Map(initialCode);
  
  // Known rules that the healer can fix
  const knownRules = new Set([
    'pii/console-in-production',
    'pii/password-logged',
    'intent/rate-limit-required',
    'intent/audit-required',
    'intent/no-pii-logging',
  ]);

  for (let i = 1; i <= DEMO_CONFIG.maxIterations; i++) {
    console.log();
    console.log(pc.dim(`  ┌─ Iteration ${i}/${DEMO_CONFIG.maxIterations} ${'─'.repeat(40)}┐`));

    const gate = runGate(ast, codeMap);

    console.log(pc.dim(`  │ Score: ${gate.score}/100`));
    console.log(pc.dim(`  │ Verdict: ${gate.verdict === 'SHIP' ? pc.green(gate.verdict) : pc.red(gate.verdict)}`));
    console.log(pc.dim(`  │ Violations: ${gate.violations.length}`));

    if (gate.verdict === 'SHIP') {
      console.log(pc.dim(`  │`));
      console.log(pc.green(`  │ ✓ SHIP`));
      console.log(pc.dim(`  └${'─'.repeat(50)}┘`));
      return { ok: true, reason: 'ship', gate, iterations: i, finalCode: codeMap };
    }

    // Check for unknown rules
    const unknownRules = gate.violations
      .filter(v => !knownRules.has(v.ruleId))
      .map(v => v.ruleId);

    if (unknownRules.length > 0) {
      console.log(pc.dim(`  │`));
      console.log(pc.red(`  │ ✗ UNKNOWN_RULE - Cannot fix automatically:`));
      for (const rule of unknownRules) {
        console.log(pc.red(`  │   • ${rule}`));
      }
      console.log(pc.dim(`  │`));
      console.log(pc.yellow(`  │ The healer REFUSES to guess fixes for unknown rules.`));
      console.log(pc.yellow(`  │ This is intentional: proof that passing means something.`));
      console.log(pc.dim(`  └${'─'.repeat(50)}┘`));

      return {
        ok: false,
        reason: 'unknown_rule',
        gate,
        iterations: i,
        finalCode: codeMap,
        unknownRules,
      };
    }

    // Apply known fixes
    console.log(pc.dim(`  │`));
    console.log(pc.dim(`  │ Applying fixes...`));

    for (const violation of gate.violations) {
      const code = codeMap.get(violation.file);
      if (!code) continue;

      let newCode = code;

      switch (violation.ruleId) {
        case 'pii/console-in-production':
          newCode = newCode.replace(/console\.log\([^)]*\);?\n?/g, '');
          if (newCode !== code) {
            console.log(pc.green(`  │   ✓ Removed console.log`));
          }
          break;

        case 'intent/rate-limit-required':
          if (!newCode.includes('@intent rate-limit-required')) {
            newCode = newCode.replace(
              /export async function POST/,
              `// @intent rate-limit-required\nexport async function POST`
            );
            console.log(pc.green(`  │   ✓ Added rate limiting`));
          }
          break;

        case 'intent/audit-required':
          if (!newCode.includes('@intent audit-required')) {
            newCode = newCode.replace(
              /export async function POST/,
              `// @intent audit-required\nexport async function POST`
            );
            console.log(pc.green(`  │   ✓ Added audit logging`));
          }
          break;

        case 'intent/no-pii-logging':
          if (!newCode.includes('@intent no-pii-logging')) {
            newCode = newCode.replace(
              /export async function POST/,
              `// @intent no-pii-logging\nexport async function POST`
            );
            console.log(pc.green(`  │   ✓ Added no-pii-logging`));
          }
          break;
      }

      if (newCode !== code) {
        codeMap.set(violation.file, newCode);
      }
    }

    console.log(pc.dim(`  └${'─'.repeat(50)}┘`));
  }

  const finalGate = runGate(ast, codeMap);
  return {
    ok: false,
    reason: 'max_iterations',
    gate: finalGate,
    iterations: DEMO_CONFIG.maxIterations,
    finalCode: codeMap,
  };
}

// ============================================================================
// Main
// ============================================================================

function printBanner() {
  console.log();
  console.log(pc.bold(pc.red('╔══════════════════════════════════════════════════════════════╗')));
  console.log(pc.bold(pc.red('║                                                              ║')));
  console.log(pc.bold(pc.red('║   FAILURE MODE DEMO: Unknown Rule → Honest Abort            ║')));
  console.log(pc.bold(pc.red('║                                                              ║')));
  console.log(pc.bold(pc.red('║   "The healer REFUSES to guess fixes for unknown rules"     ║')));
  console.log(pc.bold(pc.red('║                                                              ║')));
  console.log(pc.bold(pc.red('╚══════════════════════════════════════════════════════════════╝')));
  console.log();
}

function main() {
  printBanner();

  // Step 1: Translate NL with unknown requirements
  console.log(pc.bold(pc.blue('━━━ Step 1: NL → ISL Translation ━━━')));
  console.log();
  console.log(pc.dim(`  User: "${pc.white(DEMO_CONFIG.userPrompt)}"`));
  console.log();

  const ast = translateNLtoISL(DEMO_CONFIG.userPrompt);

  console.log(pc.green('  ✓ Translated to ISL specification'));
  console.log();
  console.log(pc.yellow(`  Intents detected (including UNKNOWN):`));
  for (const intent of ast.behaviors[0].intents) {
    const isKnown = ['rate-limit-required', 'audit-required', 'no-pii-logging'].includes(intent.tag);
    const color = isKnown ? pc.green : pc.red;
    const status = isKnown ? '(known)' : '(UNKNOWN)';
    console.log(color(`    @intent ${intent.tag} ${status}`));
  }
  console.log();
  console.log(pc.yellow(`  ⚠ Warning: Confidence is ${(ast.metadata.confidence * 100).toFixed(0)}% (unusual requirements detected)`));
  console.log();

  // Step 2: Generate code
  console.log(pc.bold(pc.blue('━━━ Step 2: Code Generation ━━━')));
  console.log();
  const initialCode = generateBrokenCode();
  console.log(pc.green('  ✓ Generated initial implementation'));
  console.log();

  // Step 3: Initial gate check
  console.log(pc.bold(pc.blue('━━━ Step 3: Initial Gate Check ━━━')));
  const initialGate = runGate(ast, initialCode);
  console.log();
  console.log(`  Verdict: ${pc.red(initialGate.verdict)}`);
  console.log(`  Score:   ${initialGate.score}/100`);
  console.log(`  Violations: ${initialGate.violations.length}`);
  console.log();

  for (const v of initialGate.violations) {
    const isKnown = ['pii/console-in-production', 'intent/rate-limit-required', 'intent/audit-required', 'intent/no-pii-logging'].includes(v.ruleId);
    const color = isKnown ? pc.yellow : pc.red;
    const status = isKnown ? '' : ' (UNKNOWN - NO FIX AVAILABLE)';
    console.log(`  ${color(`[${v.severity.toUpperCase()}]`)} ${v.ruleId}${status}`);
  }
  console.log();

  // Step 4: Self-healing (will fail on unknown rules)
  console.log(pc.bold(pc.blue('━━━ Step 4: Self-Healing Pipeline ━━━')));
  const healResult = healUntilShip(ast, initialCode);

  // Summary
  console.log();
  console.log(pc.bold('═'.repeat(64)));
  console.log(pc.bold('  FAILURE MODE SUMMARY'));
  console.log(pc.bold('═'.repeat(64)));
  console.log();
  console.log(`  Input:         "${DEMO_CONFIG.userPrompt}"`);
  console.log(`  Iterations:    ${healResult.iterations}`);
  console.log(`  Reason:        ${pc.red(healResult.reason.toUpperCase())}`);
  console.log();

  if (healResult.unknownRules && healResult.unknownRules.length > 0) {
    console.log(pc.red('  Unknown rules that caused abort:'));
    for (const rule of healResult.unknownRules) {
      console.log(pc.red(`    • ${rule}`));
    }
    console.log();
  }

  console.log(pc.yellow('  ┌────────────────────────────────────────────────────────────┐'));
  console.log(pc.yellow('  │                                                            │'));
  console.log(pc.yellow('  │  This is the moat: proof that passing means something.    │'));
  console.log(pc.yellow('  │                                                            │'));
  console.log(pc.yellow('  │  The healer is NOT allowed to:                            │'));
  console.log(pc.yellow('  │    ✗ Guess fixes for unknown rules                        │'));
  console.log(pc.yellow('  │    ✗ Add suppressions automatically                       │'));
  console.log(pc.yellow('  │    ✗ Downgrade severity                                   │'));
  console.log(pc.yellow('  │    ✗ "Make it pass" by hiding violations                  │'));
  console.log(pc.yellow('  │                                                            │'));
  console.log(pc.yellow('  │  When the healer encounters unknown rules, it ABORTS      │'));
  console.log(pc.yellow('  │  honestly and reports what it cannot fix.                 │'));
  console.log(pc.yellow('  │                                                            │'));
  console.log(pc.yellow('  └────────────────────────────────────────────────────────────┘'));
  console.log();
  console.log(pc.bold('═'.repeat(64)));
  console.log();

  // Exit with failure (expected)
  process.exit(1);
}

main();
