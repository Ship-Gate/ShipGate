#!/usr/bin/env npx tsx
/**
 * ISL Safe AI Demo — init --from-code flow
 *
 * Generate ISL spec from existing TypeScript code.
 *
 * Run: pnpm exec tsx demos/safe-ai-demo/run-demo-from-code.ts
 */

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DEMO_DIR = path.join(ROOT, '.demo-output-from-code');

function run(cmd: string, args: string[], cwd: string = ROOT): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d) => (stdout += d.toString()));
    proc.stderr?.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ISL init --from-code Demo                                   ║');
  console.log('║  Generate ISL spec from existing source code                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  await fs.rm(DEMO_DIR, { recursive: true }).catch(() => {});
  const node = process.execPath;
  const isl = path.join(ROOT, 'packages/cli/dist/index.js');
  const authPath = path.join(ROOT, 'demos/verification-demo/src/auth.ts');

  console.log('Running: isl init auth-from-code --from-code', authPath, '\n');
  const result = await run(process.execPath, [
    isl,
    'init',
    'auth-from-code',
    '--from-code',
    authPath,
    '-d',
    DEMO_DIR,
    '--force',
  ]);

  console.log(result.stdout || result.stderr);
  if (result.code === 0) {
    const specPath = path.join(DEMO_DIR, 'src', 'auth-from-code.isl');
    const spec = await fs.readFile(specPath, 'utf-8');
    console.log('\n--- Generated spec (excerpt) ---\n');
    console.log(spec.split('\n').slice(0, 35).join('\n'));
    console.log('\n...\n');
  }
  process.exit(result.code);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
