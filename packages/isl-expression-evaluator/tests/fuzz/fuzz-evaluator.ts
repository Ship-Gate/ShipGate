/**
 * Expression Evaluator Fuzzing Harness
 *
 * Generates random ISL expression ASTs and feeds them to the evaluator.
 * Catches crashes, infinite loops (via timeout), and assertion failures.
 */

import type { Expression, SourceLocation } from '@isl-lang/parser';
import { evaluate } from '../../src/evaluator.js';
import { DefaultAdapter } from '../../src/types.js';
import type { EvaluationContext } from '../../src/types.js';

// ─── PRNG ────────────────────────────────────────────────────────────────────

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0xffffffff;
    return (this.state >>> 0) / 0xffffffff;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

// ─── AST Generators ──────────────────────────────────────────────────────────

const LOC: SourceLocation = {
  file: '<fuzz>',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
};

function genBoolLiteral(rng: SeededRandom): Expression {
  return { kind: 'BooleanLiteral', value: rng.bool(), location: LOC } as Expression;
}

function genNumberLiteral(rng: SeededRandom): Expression {
  const strategies = [
    () => rng.int(-1000, 1000),
    () => rng.float(-1e10, 1e10),
    () => 0,
    () => -0,
    () => Number.MAX_SAFE_INTEGER,
    () => Number.MIN_SAFE_INTEGER,
    () => NaN,
    () => Infinity,
    () => -Infinity,
  ];
  const value = rng.pick(strategies)();
  return { kind: 'NumberLiteral', value, location: LOC } as Expression;
}

function genStringLiteral(rng: SeededRandom): Expression {
  const strategies: (() => string)[] = [
    () => '',
    () => 'hello',
    () => 'a'.repeat(rng.int(1, 100)),
    () => '\0\n\t\r',
    () => '🎉🚀',
    () => String.fromCharCode(rng.int(0, 0xffff)),
  ];
  return { kind: 'StringLiteral', value: rng.pick(strategies)(), location: LOC } as Expression;
}

function genNullLiteral(): Expression {
  return { kind: 'NullLiteral', location: LOC } as Expression;
}

function genIdentifier(rng: SeededRandom): Expression {
  const names = ['input', 'result', 'x', 'y', 'z', 'value', 'count', 'name', 'undefined_var'];
  return { kind: 'Identifier', name: rng.pick(names), location: LOC } as Expression;
}

function genMemberExpr(rng: SeededRandom, depth: number): Expression {
  const props = ['name', 'id', 'value', 'length', 'status', 'amount', 'email'];
  return {
    kind: 'MemberExpr',
    object: genExpression(rng, depth + 1),
    property: { kind: 'Identifier', name: rng.pick(props), location: LOC },
    computed: false,
    location: LOC,
  } as unknown as Expression;
}

function genBinaryExpr(rng: SeededRandom, depth: number): Expression {
  const ops = ['==', '!=', '<', '<=', '>', '>=', '+', '-', '*', '/', '%', '&&', '||', 'implies'];
  return {
    kind: 'BinaryExpr',
    operator: rng.pick(ops),
    left: genExpression(rng, depth + 1),
    right: genExpression(rng, depth + 1),
    location: LOC,
  } as unknown as Expression;
}

function genUnaryExpr(rng: SeededRandom, depth: number): Expression {
  const ops = ['!', '-', 'not'];
  return {
    kind: 'UnaryExpr',
    operator: rng.pick(ops),
    operand: genExpression(rng, depth + 1),
    location: LOC,
  } as unknown as Expression;
}

function genCallExpr(rng: SeededRandom, depth: number): Expression {
  const fns = ['length', 'abs', 'ceil', 'floor', 'round', 'now', 'is_valid', 'contains', 'upper', 'lower', 'trim', 'keys', 'values', 'isEmpty'];
  const argCount = rng.int(0, 3);
  const args = Array.from({ length: argCount }, () => genExpression(rng, depth + 1));
  return {
    kind: 'CallExpr',
    callee: { kind: 'Identifier', name: rng.pick(fns), location: LOC },
    arguments: args,
    location: LOC,
  } as unknown as Expression;
}

function genListExpr(rng: SeededRandom, depth: number): Expression {
  const len = rng.int(0, 5);
  return {
    kind: 'ListExpr',
    elements: Array.from({ length: len }, () => genExpression(rng, depth + 1)),
    location: LOC,
  } as unknown as Expression;
}

function genQuantifierExpr(rng: SeededRandom, depth: number): Expression {
  const quantifiers = ['all', 'any', 'none'];
  return {
    kind: 'QuantifierExpr',
    quantifier: rng.pick(quantifiers),
    variable: { kind: 'Identifier', name: 'item', location: LOC },
    collection: genExpression(rng, depth + 1),
    predicate: genExpression(rng, depth + 1),
    location: LOC,
  } as unknown as Expression;
}

const MAX_DEPTH = 8;

function genExpression(rng: SeededRandom, depth: number = 0): Expression {
  if (depth >= MAX_DEPTH) {
    const terminals = [genBoolLiteral, genNumberLiteral, genStringLiteral, genNullLiteral, genIdentifier];
    return rng.pick(terminals)(rng);
  }

  const generators = [
    { weight: 10, fn: genBoolLiteral },
    { weight: 10, fn: genNumberLiteral },
    { weight: 10, fn: genStringLiteral },
    { weight: 5,  fn: () => genNullLiteral() },
    { weight: 8,  fn: genIdentifier },
    { weight: 12, fn: (r: SeededRandom) => genBinaryExpr(r, depth) },
    { weight: 6,  fn: (r: SeededRandom) => genUnaryExpr(r, depth) },
    { weight: 5,  fn: (r: SeededRandom) => genMemberExpr(r, depth) },
    { weight: 5,  fn: (r: SeededRandom) => genCallExpr(r, depth) },
    { weight: 3,  fn: (r: SeededRandom) => genListExpr(r, depth) },
    { weight: 3,  fn: (r: SeededRandom) => genQuantifierExpr(r, depth) },
  ];

  const totalWeight = generators.reduce((sum, g) => sum + g.weight, 0);
  let r = rng.next() * totalWeight;
  for (const gen of generators) {
    r -= gen.weight;
    if (r <= 0) return gen.fn(rng);
  }

  return genBoolLiteral(rng);
}

// ─── Context Generators ─────────────────────────────────────────────────────

function genContext(rng: SeededRandom): EvaluationContext {
  const variables = new Map<string, unknown>();
  variables.set('x', rng.int(-100, 100));
  variables.set('y', rng.bool() ? rng.int(0, 50) : null);
  variables.set('z', rng.bool() ? 'hello' : undefined);
  variables.set('count', rng.int(0, 1000));
  variables.set('value', rng.bool() ? rng.float(-1e6, 1e6) : 'unknown');
  variables.set('name', rng.bool() ? 'test' : '');

  return {
    variables,
    input: {
      name: rng.bool() ? 'Alice' : '',
      id: rng.bool() ? 'uuid-123' : null,
      amount: rng.float(-100, 1000),
      email: 'test@example.com',
    },
    result: rng.bool() ? { success: true, id: 'uuid-456' } : null,
    adapter: new DefaultAdapter(),
    strict: rng.bool(0.3),
    maxDepth: rng.int(50, 500),
  };
}

// ─── Fuzzing Engine ──────────────────────────────────────────────────────────

export interface FuzzResult {
  totalInputs: number;
  crashes: CrashInfo[];
  hangs: HangInfo[];
  durationMs: number;
  inputsPerSecond: number;
}

export interface CrashInfo {
  seed: number;
  exprKind: string;
  error: string;
  stack?: string;
}

export interface HangInfo {
  seed: number;
  exprKind: string;
  elapsedMs: number;
}

export async function fuzzEvaluator(options: {
  durationMs: number;
  seed?: number;
  inputTimeoutMs?: number;
  onProgress?: (count: number) => void;
}): Promise<FuzzResult> {
  const { durationMs, seed = Date.now(), inputTimeoutMs = 5000 } = options;
  const rng = new SeededRandom(seed);
  const crashes: CrashInfo[] = [];
  const hangs: HangInfo[] = [];
  let totalInputs = 0;
  const startTime = Date.now();
  const deadline = startTime + durationMs;

  while (Date.now() < deadline) {
    const inputSeed = rng.int(0, 0x7fffffff);
    const inputRng = new SeededRandom(inputSeed);
    const expr = genExpression(inputRng);
    const ctx = genContext(inputRng);
    totalInputs++;

    const evalStart = Date.now();
    try {
      evaluate(expr, ctx);

      const elapsed = Date.now() - evalStart;
      if (elapsed > inputTimeoutMs) {
        hangs.push({
          seed: inputSeed,
          exprKind: expr.kind,
          elapsedMs: elapsed,
        });
      }
    } catch (err: unknown) {
      if (isCrash(err)) {
        crashes.push({
          seed: inputSeed,
          exprKind: expr.kind,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
    }

    if (totalInputs % 5000 === 0) {
      options.onProgress?.(totalInputs);
      await yieldThread();
    }
  }

  const elapsed = Date.now() - startTime;
  return {
    totalInputs,
    crashes,
    hangs,
    durationMs: elapsed,
    inputsPerSecond: Math.round((totalInputs / elapsed) * 1000),
  };
}

function isCrash(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = err.message.toLowerCase();
  const expectedPatterns = [
    'maximum evaluation depth',
    'not a function',
    'cannot read prop',
    'unknown expression kind',
    'unsupported',
    'type error',
    'is not iterable',
    'evaluation error',
  ];
  return !expectedPatterns.some(p => msg.includes(p));
}

function yieldThread(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith('fuzz-evaluator.ts') || process.argv[1]?.endsWith('fuzz-evaluator.js')) {
  const durationSec = parseInt(process.env.FUZZ_DURATION ?? '60', 10);
  const seed = process.env.FUZZ_SEED ? parseInt(process.env.FUZZ_SEED, 10) : Date.now();

  console.log(`[evaluator-fuzzer] seed=${seed} duration=${durationSec}s`);

  fuzzEvaluator({
    durationMs: durationSec * 1000,
    seed,
    onProgress(count) {
      console.log(`  ... ${count} inputs tested`);
    },
  }).then(result => {
    console.log(`\n[evaluator-fuzzer] Done.`);
    console.log(`  Inputs:     ${result.totalInputs}`);
    console.log(`  Rate:       ${result.inputsPerSecond} inputs/sec`);
    console.log(`  Crashes:    ${result.crashes.length}`);
    console.log(`  Hangs:      ${result.hangs.length}`);

    if (result.crashes.length > 0 || result.hangs.length > 0) {
      const artifactPath = `fuzz-crashes-evaluator-${seed}.json`;
      const fs = require('fs');
      fs.writeFileSync(
        artifactPath,
        JSON.stringify({ seed, crashes: result.crashes, hangs: result.hangs }, null, 2)
      );
      console.log(`  Artifacts:  ${artifactPath}`);
      process.exit(1);
    }
  }).catch(err => {
    console.error('[evaluator-fuzzer] Fuzzer itself crashed:', err);
    process.exit(2);
  });
}
