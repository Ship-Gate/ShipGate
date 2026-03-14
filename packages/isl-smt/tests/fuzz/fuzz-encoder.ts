/**
 * SMT Encoder Fuzzing Harness
 *
 * Generates random SMT expressions and declarations, feeds them to the
 * builtin solver and SMT-LIB serializer, and verifies the output is
 * valid (basic syntax check). Catches crashes and hangs.
 */

import { Expr, Sort, Decl, toSMTLib, declToSMTLib, simplify } from '@isl-lang/prover';
import type { SMTExpr, SMTSort, SMTDecl } from '@isl-lang/prover';
import { BuiltinSolver } from '../../src/builtin-solver.js';

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
}

// ─── SMT Expression Generators ──────────────────────────────────────────────

function genSort(rng: SeededRandom): SMTSort {
  const kinds = ['Bool', 'Int', 'Real', 'String'] as const;
  return { kind: rng.pick(kinds) } as SMTSort;
}

function genSortAdvanced(rng: SeededRandom, depth: number = 0): SMTSort {
  if (depth >= 2) return genSort(rng);

  const r = rng.next();
  if (r < 0.3) return Sort.Bool();
  if (r < 0.55) return Sort.Int();
  if (r < 0.7) return Sort.Real();
  if (r < 0.8) return Sort.String();
  if (r < 0.9) return Sort.Array(genSortAdvanced(rng, depth + 1), genSortAdvanced(rng, depth + 1));
  return Sort.Uninterpreted('CustomSort' + rng.int(0, 5));
}

function genExpr(rng: SeededRandom, depth: number = 0): SMTExpr {
  const MAX_DEPTH = 6;
  if (depth >= MAX_DEPTH) return genTerminal(rng);

  const r = rng.next();
  if (r < 0.25) return genTerminal(rng);
  if (r < 0.45) return genBoolOp(rng, depth);
  if (r < 0.65) return genArithOp(rng, depth);
  if (r < 0.80) return genCompare(rng, depth);
  if (r < 0.90) return genIte(rng, depth);
  return genQuantifier(rng, depth);
}

function genTerminal(rng: SeededRandom): SMTExpr {
  const r = rng.next();
  if (r < 0.2) return Expr.bool(rng.bool());
  if (r < 0.5) return Expr.int(rng.int(-10000, 10000));
  if (r < 0.65) return Expr.real(rng.int(-100, 100) + rng.next());
  if (r < 0.75) return Expr.string(genRandomString(rng));
  return Expr.var('v' + rng.int(0, 9), genSort(rng));
}

function genRandomString(rng: SeededRandom): string {
  const len = rng.int(0, 20);
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789 _-';
  return Array.from({ length: len }, () => chars[rng.int(0, chars.length - 1)]).join('');
}

function genBoolOp(rng: SeededRandom, depth: number): SMTExpr {
  const ops = ['and', 'or', 'not', 'implies', 'iff'] as const;
  const op = rng.pick(ops);

  switch (op) {
    case 'not': return Expr.not(genExpr(rng, depth + 1));
    case 'and': {
      const count = rng.int(2, 4);
      return Expr.and(...Array.from({ length: count }, () => genExpr(rng, depth + 1)));
    }
    case 'or': {
      const count = rng.int(2, 4);
      return Expr.or(...Array.from({ length: count }, () => genExpr(rng, depth + 1)));
    }
    case 'implies': return Expr.implies(genExpr(rng, depth + 1), genExpr(rng, depth + 1));
    case 'iff': return Expr.iff(genExpr(rng, depth + 1), genExpr(rng, depth + 1));
  }
}

function genArithOp(rng: SeededRandom, depth: number): SMTExpr {
  const ops = ['add', 'sub', 'mul', 'div', 'mod', 'neg', 'abs'] as const;
  const op = rng.pick(ops);

  switch (op) {
    case 'add': {
      const count = rng.int(2, 4);
      return Expr.add(...Array.from({ length: count }, () => genExpr(rng, depth + 1)));
    }
    case 'sub': return Expr.sub(genExpr(rng, depth + 1), genExpr(rng, depth + 1));
    case 'mul': {
      const count = rng.int(2, 3);
      return Expr.mul(...Array.from({ length: count }, () => genExpr(rng, depth + 1)));
    }
    case 'div': return Expr.div(genExpr(rng, depth + 1), genExpr(rng, depth + 1));
    case 'mod': return Expr.mod(genExpr(rng, depth + 1), genExpr(rng, depth + 1));
    case 'neg': return Expr.neg(genExpr(rng, depth + 1));
    case 'abs': return Expr.abs(genExpr(rng, depth + 1));
  }
}

function genCompare(rng: SeededRandom, depth: number): SMTExpr {
  const ops = ['eq', 'lt', 'le', 'gt', 'ge', 'distinct'] as const;
  const op = rng.pick(ops);

  switch (op) {
    case 'eq': return Expr.eq(genExpr(rng, depth + 1), genExpr(rng, depth + 1));
    case 'lt': return Expr.lt(genExpr(rng, depth + 1), genExpr(rng, depth + 1));
    case 'le': return Expr.le(genExpr(rng, depth + 1), genExpr(rng, depth + 1));
    case 'gt': return Expr.gt(genExpr(rng, depth + 1), genExpr(rng, depth + 1));
    case 'ge': return Expr.ge(genExpr(rng, depth + 1), genExpr(rng, depth + 1));
    case 'distinct': {
      const count = rng.int(2, 5);
      return Expr.distinct(...Array.from({ length: count }, () => genExpr(rng, depth + 1)));
    }
  }
}

function genIte(rng: SeededRandom, depth: number): SMTExpr {
  return Expr.ite(genExpr(rng, depth + 1), genExpr(rng, depth + 1), genExpr(rng, depth + 1));
}

function genQuantifier(rng: SeededRandom, depth: number): SMTExpr {
  const count = rng.int(1, 3);
  const vars = Array.from({ length: count }, (_, i) => ({
    name: 'q' + i + '_' + rng.int(0, 100),
    sort: genSort(rng),
  }));
  const body = genExpr(rng, depth + 1);
  return rng.bool() ? Expr.forall(vars, body) : Expr.exists(vars, body);
}

function genDeclarations(rng: SeededRandom): SMTDecl[] {
  const count = rng.int(0, 8);
  const decls: SMTDecl[] = [];
  for (let i = 0; i < count; i++) {
    const r = rng.next();
    if (r < 0.5) {
      decls.push(Decl.const('v' + i, genSortAdvanced(rng)));
    } else if (r < 0.8) {
      const paramCount = rng.int(0, 3);
      decls.push(Decl.fun(
        'fn' + i,
        Array.from({ length: paramCount }, () => genSort(rng)),
        genSort(rng),
      ));
    } else {
      decls.push(Decl.sort('S' + i, rng.int(0, 2)));
    }
  }
  return decls;
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateSMTLib(smtlib: string): boolean {
  let parens = 0;
  for (const ch of smtlib) {
    if (ch === '(') parens++;
    else if (ch === ')') parens--;
    if (parens < 0) return false;
  }
  return parens === 0;
}

// ─── Fuzzing Engine ──────────────────────────────────────────────────────────

export interface FuzzResult {
  totalInputs: number;
  crashes: CrashInfo[];
  hangs: HangInfo[];
  invalidSMTLib: number;
  durationMs: number;
  inputsPerSecond: number;
}

export interface CrashInfo {
  seed: number;
  phase: 'simplify' | 'toSMTLib' | 'solve';
  error: string;
  stack?: string;
}

export interface HangInfo {
  seed: number;
  phase: string;
  elapsedMs: number;
}

export async function fuzzEncoder(options: {
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
  let invalidSMTLib = 0;
  const startTime = Date.now();
  const deadline = startTime + durationMs;

  while (Date.now() < deadline) {
    const inputSeed = rng.int(0, 0x7fffffff);
    const inputRng = new SeededRandom(inputSeed);
    const expr = genExpr(inputRng);
    const decls = genDeclarations(inputRng);
    totalInputs++;

    // Phase 1: simplify
    try {
      simplify(expr);
    } catch (err: unknown) {
      if (isCrash(err)) {
        crashes.push({
          seed: inputSeed,
          phase: 'simplify',
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
    }

    // Phase 2: toSMTLib serialization
    try {
      const smtlib = toSMTLib(expr);
      if (!validateSMTLib(smtlib)) {
        invalidSMTLib++;
      }

      for (const decl of decls) {
        const declLib = declToSMTLib(decl);
        if (!validateSMTLib(declLib)) {
          invalidSMTLib++;
        }
      }
    } catch (err: unknown) {
      if (isCrash(err)) {
        crashes.push({
          seed: inputSeed,
          phase: 'toSMTLib',
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
    }

    // Phase 3: solver (only for simple formulas to keep speed up)
    if (rng.bool(0.2)) {
      const solveStart = Date.now();
      try {
        const solver = new BuiltinSolver({ timeout: 500, maxIterations: 1000 });
        await solver.checkSat(expr, decls);

        const elapsed = Date.now() - solveStart;
        if (elapsed > inputTimeoutMs) {
          hangs.push({ seed: inputSeed, phase: 'solve', elapsedMs: elapsed });
        }
      } catch (err: unknown) {
        if (isCrash(err)) {
          crashes.push({
            seed: inputSeed,
            phase: 'solve',
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
        }
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
    invalidSMTLib,
    durationMs: elapsed,
    inputsPerSecond: Math.round((totalInputs / elapsed) * 1000),
  };
}

function isCrash(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = err.message.toLowerCase();
  const expectedPatterns = [
    'timeout',
    'unsupported',
    'unknown sort',
    'unknown expression',
    'cannot convert',
    'max iterations',
    'not supported',
  ];
  return !expectedPatterns.some(p => msg.includes(p));
}

function yieldThread(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith('fuzz-encoder.ts') || process.argv[1]?.endsWith('fuzz-encoder.js')) {
  const durationSec = parseInt(process.env.FUZZ_DURATION ?? '60', 10);
  const seed = process.env.FUZZ_SEED ? parseInt(process.env.FUZZ_SEED, 10) : Date.now();

  console.log(`[smt-fuzzer] seed=${seed} duration=${durationSec}s`);

  fuzzEncoder({
    durationMs: durationSec * 1000,
    seed,
    onProgress(count) {
      console.log(`  ... ${count} inputs tested`);
    },
  }).then(result => {
    console.log(`\n[smt-fuzzer] Done.`);
    console.log(`  Inputs:       ${result.totalInputs}`);
    console.log(`  Rate:         ${result.inputsPerSecond} inputs/sec`);
    console.log(`  Crashes:      ${result.crashes.length}`);
    console.log(`  Hangs:        ${result.hangs.length}`);
    console.log(`  Invalid SMTL: ${result.invalidSMTLib}`);

    if (result.crashes.length > 0 || result.hangs.length > 0) {
      const artifactPath = `fuzz-crashes-smt-${seed}.json`;
      const fs = require('fs');
      fs.writeFileSync(
        artifactPath,
        JSON.stringify({ seed, crashes: result.crashes, hangs: result.hangs }, null, 2)
      );
      console.log(`  Artifacts:    ${artifactPath}`);
      process.exit(1);
    }
  }).catch(err => {
    console.error('[smt-fuzzer] Fuzzer itself crashed:', err);
    process.exit(2);
  });
}
