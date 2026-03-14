/**
 * Security Scanner Fuzzing Harness
 *
 * Generates random source code strings with embedded vulnerability patterns
 * and feeds them to each scanner (TypeScript, Python). Catches crashes
 * and excessive runtime.
 */

import { scanSource } from '../../src/scanner';
import { scanImplementation } from '../../src/impl-scanner';

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

// ─── Code Generators ─────────────────────────────────────────────────────────

const TS_FRAGMENTS = {
  imports: [
    `import express from 'express';`,
    `import { createPool } from 'mysql2';`,
    `import crypto from 'crypto';`,
    `import { exec } from 'child_process';`,
    `import jwt from 'jsonwebtoken';`,
    `import fs from 'fs';`,
    `const app = express();`,
  ],
  sqlPatterns: [
    `db.query("SELECT * FROM users WHERE id = " + userId);`,
    `db.query(\`SELECT * FROM users WHERE name = '\${name}'\`);`,
    `db.execute("DELETE FROM sessions WHERE token = " + token);`,
    `pool.query("INSERT INTO logs VALUES (" + data + ")");`,
    `db.raw(\`UPDATE users SET role = '\${role}' WHERE id = \${id}\`);`,
  ],
  safeSqlPatterns: [
    `db.query("SELECT * FROM users WHERE id = ?", [userId]);`,
    `db.query("SELECT * FROM users WHERE id = $1", [userId]);`,
    `await prisma.user.findUnique({ where: { id } });`,
  ],
  commandInjection: [
    `exec("rm -rf " + userInput);`,
    `exec(\`ls \${dir}\`);`,
    `require('child_process').execSync(cmd);`,
  ],
  hardcodedSecrets: [
    `const API_KEY = "sk_live_abc123def456";`,
    `const password = "admin123";`,
    `const secret = "super_secret_key_do_not_share";`,
    `jwt.sign(payload, "hardcoded-secret");`,
  ],
  xssPatterns: [
    `res.send("<div>" + userInput + "</div>");`,
    `element.innerHTML = userInput;`,
    `document.write(data);`,
  ],
  weakCrypto: [
    `crypto.createHash('md5').update(password).digest('hex');`,
    `crypto.createHash('sha1').update(data).digest('hex');`,
    `Math.random().toString(36);`,
  ],
  pathTraversal: [
    `fs.readFileSync("/uploads/" + filename);`,
    `fs.readFile(req.query.path, callback);`,
    `const file = path.join(baseDir, req.params.file);`,
  ],
  safePatterns: [
    `const hash = crypto.createHash('sha256').update(data).digest('hex');`,
    `const token = crypto.randomBytes(32).toString('hex');`,
    `app.use(helmet());`,
    `app.use(cors({ origin: allowedOrigins }));`,
    `if (!isValidEmail(email)) throw new Error('Invalid');`,
  ],
  functions: [
    `function handler(req, res) {`,
    `async function processRequest(data) {`,
    `const middleware = (req, res, next) => {`,
    `app.get('/api/users', async (req, res) => {`,
    `app.post('/api/login', async (req, res) => {`,
    `router.delete('/api/items/:id', async (req, res) => {`,
  ],
  closers: [
    `});`,
    `}`,
    `  return result;\n}`,
    `  res.json({ success: true });\n});`,
  ],
};

const PY_FRAGMENTS = {
  imports: [
    `import os`,
    `import subprocess`,
    `import hashlib`,
    `import sqlite3`,
    `from flask import Flask, request`,
  ],
  sqlPatterns: [
    `cursor.execute("SELECT * FROM users WHERE id = " + user_id)`,
    `cursor.execute(f"DELETE FROM items WHERE id = {item_id}")`,
    `db.execute("UPDATE users SET name = '" + name + "'")`,
  ],
  commandInjection: [
    `os.system("ls " + user_input)`,
    `subprocess.call(f"grep {pattern} /var/log/app.log", shell=True)`,
  ],
  weakCrypto: [
    `hashlib.md5(password.encode()).hexdigest()`,
    `hashlib.sha1(data.encode()).hexdigest()`,
  ],
  safePatterns: [
    `cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))`,
    `hashlib.sha256(data.encode()).hexdigest()`,
    `secrets.token_hex(32)`,
  ],
};

function generateTypeScriptSource(rng: SeededRandom): string {
  const lines: string[] = [];
  const lineCount = rng.int(5, 100);

  // Imports
  const importCount = rng.int(0, 4);
  for (let i = 0; i < importCount; i++) {
    lines.push(rng.pick(TS_FRAGMENTS.imports));
  }
  lines.push('');

  for (let i = 0; i < lineCount; i++) {
    const r = rng.next();
    if (r < 0.1) lines.push(rng.pick(TS_FRAGMENTS.functions));
    else if (r < 0.2) lines.push(rng.pick(TS_FRAGMENTS.sqlPatterns));
    else if (r < 0.25) lines.push(rng.pick(TS_FRAGMENTS.commandInjection));
    else if (r < 0.3) lines.push(rng.pick(TS_FRAGMENTS.hardcodedSecrets));
    else if (r < 0.35) lines.push(rng.pick(TS_FRAGMENTS.xssPatterns));
    else if (r < 0.4) lines.push(rng.pick(TS_FRAGMENTS.weakCrypto));
    else if (r < 0.45) lines.push(rng.pick(TS_FRAGMENTS.pathTraversal));
    else if (r < 0.55) lines.push(rng.pick(TS_FRAGMENTS.safePatterns));
    else if (r < 0.6) lines.push(rng.pick(TS_FRAGMENTS.closers));
    else if (r < 0.7) lines.push(`  const ${genVarName(rng)} = ${genValue(rng)};`);
    else if (r < 0.8) lines.push(`  // ${genComment(rng)}`);
    else lines.push('');
  }

  return lines.join('\n');
}

function generatePythonSource(rng: SeededRandom): string {
  const lines: string[] = [];
  const lineCount = rng.int(5, 60);

  const importCount = rng.int(0, 3);
  for (let i = 0; i < importCount; i++) {
    lines.push(rng.pick(PY_FRAGMENTS.imports));
  }
  lines.push('');

  for (let i = 0; i < lineCount; i++) {
    const r = rng.next();
    if (r < 0.15) lines.push(rng.pick(PY_FRAGMENTS.sqlPatterns));
    else if (r < 0.25) lines.push(rng.pick(PY_FRAGMENTS.commandInjection));
    else if (r < 0.35) lines.push(rng.pick(PY_FRAGMENTS.weakCrypto));
    else if (r < 0.5) lines.push(rng.pick(PY_FRAGMENTS.safePatterns));
    else if (r < 0.6) lines.push(`    ${genVarName(rng)} = ${genValue(rng)}`);
    else if (r < 0.7) lines.push(`def ${genVarName(rng)}():`);
    else if (r < 0.8) lines.push(`    # ${genComment(rng)}`);
    else lines.push('');
  }

  return lines.join('\n');
}

function generateBoundarySource(rng: SeededRandom): string {
  const kind = rng.int(0, 6);
  switch (kind) {
    case 0: return '';
    case 1: return '\0'.repeat(rng.int(1, 100));
    case 2: return 'a'.repeat(rng.int(10000, 50000));
    case 3: return '\n'.repeat(rng.int(1, 5000));
    case 4: return '`'.repeat(rng.int(1, 500));
    case 5: return Array.from({ length: rng.int(100, 1000) }, () =>
      String.fromCharCode(rng.int(0, 0xffff))
    ).join('');
    case 6: {
      // Deeply nested regex-like patterns that might cause catastrophic backtracking
      const depth = rng.int(10, 50);
      return 'a'.repeat(depth) + '(' + 'a?'.repeat(depth) + ')' + 'a'.repeat(depth);
    }
    default: return '';
  }
}

function genVarName(rng: SeededRandom): string {
  const names = ['result', 'data', 'user', 'config', 'output', 'temp', 'value', 'item'];
  return rng.pick(names) + rng.int(0, 99);
}

function genValue(rng: SeededRandom): string {
  const values = ['"hello"', '42', 'true', 'null', 'undefined', '[]', '{}', '""', 'NaN'];
  return rng.pick(values);
}

function genComment(rng: SeededRandom): string {
  const comments = ['TODO: fix this', 'HACK', 'temporary workaround', 'security review needed'];
  return rng.pick(comments);
}

function generateSource(rng: SeededRandom): { source: string; language: 'typescript' | 'python' } {
  const r = rng.next();
  if (r < 0.45) return { source: generateTypeScriptSource(rng), language: 'typescript' };
  if (r < 0.75) return { source: generatePythonSource(rng), language: 'python' };
  return { source: generateBoundarySource(rng), language: rng.bool() ? 'typescript' : 'python' };
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
  language: string;
  sourceLen: number;
  error: string;
  stack?: string;
}

export interface HangInfo {
  seed: number;
  language: string;
  elapsedMs: number;
}

export async function fuzzScanner(options: {
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
    const { source, language } = generateSource(inputRng);
    totalInputs++;

    const scanStart = Date.now();
    try {
      scanSource(source, language);

      const elapsed = Date.now() - scanStart;
      if (elapsed > inputTimeoutMs) {
        hangs.push({ seed: inputSeed, language, elapsedMs: elapsed });
      }
    } catch (err: unknown) {
      if (isCrash(err)) {
        crashes.push({
          seed: inputSeed,
          language,
          sourceLen: source.length,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
    }

    // Also fuzz scanImplementation with explicit options
    if (rng.bool(0.3)) {
      try {
        scanImplementation(source, {
          language,
          filePath: `fuzz.${language === 'python' ? 'py' : 'ts'}`,
        });
      } catch (err: unknown) {
        if (isCrash(err)) {
          crashes.push({
            seed: inputSeed,
            language: language + ':impl',
            sourceLen: source.length,
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
    durationMs: elapsed,
    inputsPerSecond: Math.round((totalInputs / elapsed) * 1000),
  };
}

function isCrash(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = err.message.toLowerCase();
  const expectedPatterns = [
    'invalid',
    'unsupported language',
    'cannot read',
    'is not a function',
  ];
  return !expectedPatterns.some(p => msg.includes(p));
}

function yieldThread(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith('fuzz-scanner.ts') || process.argv[1]?.endsWith('fuzz-scanner.js')) {
  const durationSec = parseInt(process.env.FUZZ_DURATION ?? '60', 10);
  const seed = process.env.FUZZ_SEED ? parseInt(process.env.FUZZ_SEED, 10) : Date.now();

  console.log(`[scanner-fuzzer] seed=${seed} duration=${durationSec}s`);

  fuzzScanner({
    durationMs: durationSec * 1000,
    seed,
    onProgress(count) {
      console.log(`  ... ${count} inputs tested`);
    },
  }).then(result => {
    console.log(`\n[scanner-fuzzer] Done.`);
    console.log(`  Inputs:     ${result.totalInputs}`);
    console.log(`  Rate:       ${result.inputsPerSecond} inputs/sec`);
    console.log(`  Crashes:    ${result.crashes.length}`);
    console.log(`  Hangs:      ${result.hangs.length}`);

    if (result.crashes.length > 0 || result.hangs.length > 0) {
      const artifactPath = `fuzz-crashes-scanner-${seed}.json`;
      const fs = require('fs');
      fs.writeFileSync(
        artifactPath,
        JSON.stringify({ seed, crashes: result.crashes, hangs: result.hangs }, null, 2)
      );
      console.log(`  Artifacts:  ${artifactPath}`);
      process.exit(1);
    }
  }).catch(err => {
    console.error('[scanner-fuzzer] Fuzzer itself crashed:', err);
    process.exit(2);
  });
}
