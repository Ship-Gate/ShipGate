/**
 * Parser Fuzzing Harness
 *
 * Generates random ISL-like strings using grammar-aware mutation and feeds
 * them to the parser. Reports actual crashes/hangs — not parse errors.
 *
 * Strategies:
 *   1. Mutate valid ISL seeds (swap tokens, insert/delete chars, shuffle blocks)
 *   2. Completely random strings
 *   3. Boundary cases (empty, huge, unicode, null bytes)
 *   4. Grammar-guided generation from tokens/keywords
 */

import { parse, Parser } from '../../src/index.js';
import {
  SEED_CORPUS,
  ISL_KEYWORDS,
  ISL_TYPES,
  ISL_OPERATORS,
  ISL_DELIMITERS,
} from './fuzz-corpus.js';

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

// ─── Input Generation ────────────────────────────────────────────────────────

function mutateSeed(rng: SeededRandom, seed: string): string {
  const mutations = [
    insertRandomToken,
    deleteRandomSlice,
    swapRandomChars,
    duplicateBlock,
    corruptBraces,
    insertUnicode,
    insertNullBytes,
    replaceKeyword,
    repeatToken,
    truncateInput,
  ];

  let result = seed;
  const count = rng.int(1, 4);
  for (let i = 0; i < count; i++) {
    const mutation = rng.pick(mutations);
    result = mutation(rng, result);
  }
  return result;
}

function insertRandomToken(rng: SeededRandom, s: string): string {
  const allTokens = [...ISL_KEYWORDS, ...ISL_TYPES, ...ISL_OPERATORS, ...ISL_DELIMITERS];
  const token = rng.pick(allTokens);
  const pos = rng.int(0, s.length);
  return s.slice(0, pos) + ' ' + token + ' ' + s.slice(pos);
}

function deleteRandomSlice(rng: SeededRandom, s: string): string {
  if (s.length < 2) return s;
  const start = rng.int(0, s.length - 1);
  const len = rng.int(1, Math.min(20, s.length - start));
  return s.slice(0, start) + s.slice(start + len);
}

function swapRandomChars(rng: SeededRandom, s: string): string {
  if (s.length < 2) return s;
  const chars = s.split('');
  const a = rng.int(0, chars.length - 1);
  const b = rng.int(0, chars.length - 1);
  [chars[a], chars[b]] = [chars[b], chars[a]];
  return chars.join('');
}

function duplicateBlock(rng: SeededRandom, s: string): string {
  const start = rng.int(0, Math.max(0, s.length - 10));
  const len = rng.int(1, Math.min(50, s.length - start));
  const block = s.slice(start, start + len);
  const insertPos = rng.int(0, s.length);
  return s.slice(0, insertPos) + block + s.slice(insertPos);
}

function corruptBraces(rng: SeededRandom, s: string): string {
  const braces = ['{', '}', '(', ')', '[', ']'];
  const pos = rng.int(0, s.length);
  return s.slice(0, pos) + rng.pick(braces) + s.slice(pos);
}

function insertUnicode(rng: SeededRandom, s: string): string {
  const unicodeChars = [
    '\u0000', '\u00ff', '\u0100', '\u200b', '\u200d', '\ufeff',
    '\ud800', '\udbff', '\udc00', '\udfff', // surrogate pairs
    '\u2028', '\u2029', // line/paragraph separators
    '🎉', '∑', 'λ', '→', '∀', '∃',
    '\u0300', '\u0301', // combining diacriticals
  ];
  const pos = rng.int(0, s.length);
  const chars = Array.from({ length: rng.int(1, 5) }, () => rng.pick(unicodeChars)).join('');
  return s.slice(0, pos) + chars + s.slice(pos);
}

function insertNullBytes(rng: SeededRandom, s: string): string {
  const pos = rng.int(0, s.length);
  const count = rng.int(1, 3);
  return s.slice(0, pos) + '\0'.repeat(count) + s.slice(pos);
}

function replaceKeyword(rng: SeededRandom, s: string): string {
  const keyword = rng.pick(ISL_KEYWORDS);
  const replacement = rng.pick(ISL_KEYWORDS);
  return s.replace(keyword, replacement);
}

function repeatToken(rng: SeededRandom, s: string): string {
  const token = rng.pick(ISL_KEYWORDS);
  const times = rng.int(5, 50);
  const pos = rng.int(0, s.length);
  return s.slice(0, pos) + (token + ' ').repeat(times) + s.slice(pos);
}

function truncateInput(rng: SeededRandom, s: string): string {
  if (s.length < 5) return s;
  return s.slice(0, rng.int(1, s.length - 1));
}

function generateRandomString(rng: SeededRandom): string {
  const len = rng.int(1, 500);
  const chars = ' abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}()[]<>:;,.!@#$%^&*_-+="\'`\n\t';
  return Array.from({ length: len }, () => chars[rng.int(0, chars.length - 1)]).join('');
}

function generateGrammarGuided(rng: SeededRandom): string {
  const name = 'Fuzz' + rng.int(0, 9999);
  const blocks: string[] = [];

  if (rng.bool(0.6)) {
    const typeName = 'T' + rng.int(0, 99);
    const baseType = rng.pick(ISL_TYPES);
    blocks.push(`  type ${typeName} = ${baseType}`);
  }

  if (rng.bool(0.5)) {
    const fields = Array.from({ length: rng.int(1, 5) }, (_, i) => {
      const ft = rng.pick(ISL_TYPES);
      const opt = rng.bool(0.3) ? '?' : '';
      return `    f${i}: ${ft}${opt}`;
    }).join('\n');
    blocks.push(`  entity E${rng.int(0, 99)} {\n${fields}\n  }`);
  }

  if (rng.bool(0.5)) {
    const inputFields = Array.from({ length: rng.int(1, 3) }, (_, i) =>
      `${rng.pick(['a', 'b', 'data', 'id', 'name'])}${i}: ${rng.pick(ISL_TYPES)}`
    ).join(', ');
    const pre = rng.bool(0.5) ? '\n    preconditions {\n      input.a0 != null\n    }' : '';
    const post = '\n    postconditions {\n      on success { result != null }\n    }';
    blocks.push(`  behavior B${rng.int(0, 99)} {\n    input { ${inputFields} }\n    output { ok: Boolean }${pre}${post}\n  }`);
  }

  return `domain ${name} "1.0" {\n${blocks.join('\n\n')}\n}`;
}

function generateBoundaryCase(rng: SeededRandom): string {
  const kind = rng.int(0, 7);
  switch (kind) {
    case 0: return '';
    case 1: return ' '.repeat(rng.int(1, 10000));
    case 2: return '\n'.repeat(rng.int(1, 5000));
    case 3: return 'a'.repeat(rng.int(50000, 100000));
    case 4: return '"'.repeat(rng.int(1, 1000));
    case 5: return '{'.repeat(rng.int(100, 500)) + '}'.repeat(rng.int(100, 500));
    case 6: return '\0'.repeat(rng.int(1, 100));
    case 7: return '🎉'.repeat(rng.int(1, 5000));
    default: return '';
  }
}

function generateInput(rng: SeededRandom): string {
  const r = rng.next();
  if (r < 0.35) {
    return mutateSeed(rng, rng.pick(SEED_CORPUS));
  } else if (r < 0.55) {
    return generateGrammarGuided(rng);
  } else if (r < 0.80) {
    return generateRandomString(rng);
  } else {
    return generateBoundaryCase(rng);
  }
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
  input: string;
  error: string;
  stack?: string;
}

export interface HangInfo {
  seed: number;
  input: string;
  elapsedMs: number;
}

/**
 * Run the parser fuzzer for a given duration.
 *
 * Only reports actual crashes (uncaught exceptions that aren't parser
 * diagnostics) and hangs. Normal parse errors are expected and ignored.
 */
export async function fuzzParser(options: {
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
    const input = generateInput(inputRng);
    totalInputs++;

    try {
      const parseStart = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), inputTimeoutMs);

      try {
        const parser = new Parser('<fuzz>');
        parser.parse(input);
      } finally {
        clearTimeout(timer);
      }

      const elapsed = Date.now() - parseStart;
      if (elapsed > inputTimeoutMs) {
        hangs.push({ seed: inputSeed, input: input.slice(0, 500), elapsedMs: elapsed });
      }
    } catch (err: unknown) {
      if (isCrash(err)) {
        crashes.push({
          seed: inputSeed,
          input: input.slice(0, 2000),
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

/**
 * Distinguish real crashes from expected parse errors.
 * Parser errors (diagnostics, limit violations) are normal and expected.
 */
function isCrash(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = err.message.toLowerCase();
  const expectedPatterns = [
    'max parse depth',
    'token count',
    'maximum',
    'unexpected token',
    'expected',
    'unterminated',
    'invalid',
    'parse error',
    'limit',
    'exceeded',
    'file size',
  ];
  return !expectedPatterns.some(p => msg.includes(p));
}

function yieldThread(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith('fuzz-parser.ts') || process.argv[1]?.endsWith('fuzz-parser.js')) {
  const durationSec = parseInt(process.env.FUZZ_DURATION ?? '60', 10);
  const seed = process.env.FUZZ_SEED ? parseInt(process.env.FUZZ_SEED, 10) : Date.now();

  console.log(`[parser-fuzzer] seed=${seed} duration=${durationSec}s`);

  fuzzParser({
    durationMs: durationSec * 1000,
    seed,
    onProgress(count) {
      console.log(`  ... ${count} inputs tested`);
    },
  }).then(result => {
    console.log(`\n[parser-fuzzer] Done.`);
    console.log(`  Inputs:     ${result.totalInputs}`);
    console.log(`  Rate:       ${result.inputsPerSecond} inputs/sec`);
    console.log(`  Crashes:    ${result.crashes.length}`);
    console.log(`  Hangs:      ${result.hangs.length}`);

    if (result.crashes.length > 0 || result.hangs.length > 0) {
      const artifactPath = `fuzz-crashes-parser-${seed}.json`;
      const fs = require('fs');
      fs.writeFileSync(
        artifactPath,
        JSON.stringify({ seed, crashes: result.crashes, hangs: result.hangs }, null, 2)
      );
      console.log(`  Artifacts:  ${artifactPath}`);
      process.exit(1);
    }
  }).catch(err => {
    console.error('[parser-fuzzer] Fuzzer itself crashed:', err);
    process.exit(2);
  });
}
