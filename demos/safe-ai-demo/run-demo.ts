#!/usr/bin/env npx tsx
/**
 * ISL Safe AI Code Demo — 90-Second Flow
 *
 * Demonstrates the complete pipeline:
 * 1. isl init --from-prompt "Build me a todo app with tasks"
 * 2. (Optional) isl init --from-code ./impl.ts
 * 3. isl check
 * 4. isl verify (with implementation)
 * 5. isl gate — SHIP/NO-SHIP decision
 *
 * Run: pnpm exec tsx demos/safe-ai-demo/run-demo.ts
 * Record: Use this flow for screen recording
 */

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = typeof import.meta.url === 'string'
  ? path.dirname(fileURLToPath(import.meta.url))
  : process.cwd();
const ROOT = path.resolve(__dirname, '../..');
const DEMO_DIR = path.join(ROOT, '.demo-output');

function run(
  cmd: string,
  args: string[],
  cwd: string = ROOT
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d) => (stdout += d.toString()));
    proc.stderr?.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function log(step: number, title: string) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  Step ${step}: ${title}`);
  console.log('═'.repeat(60) + '\n');
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ISL Safe AI Code Demo — 90-Second Flow                      ║
║                                                              ║
║  prompt → spec → verify → gate (SHIP/NO-SHIP)                ║
╚══════════════════════════════════════════════════════════════╝
`);

  await fs.rm(DEMO_DIR, { recursive: true }).catch(() => {});
  await fs.mkdir(DEMO_DIR, { recursive: true });

  const isl = path.join(ROOT, 'packages/cli/dist/index.js');

  // Step 1: init --from-prompt
  log(1, 'Init from prompt: "Build me a todo app with tasks"');
  const initPrompt = await run(process.execPath, [
    isl,
    'init',
    'todo-app',
    '--from-prompt',
    'Build me a todo app with tasks',
    '-d',
    path.join(DEMO_DIR, 'todo-app'),
    '--force',
  ]);
  console.log(initPrompt.stdout || initPrompt.stderr);
  if (initPrompt.code !== 0) {
    console.error('Init from prompt failed');
    process.exit(1);
  }

  // Step 2: Create a minimal implementation
  log(2, 'Add implementation (simulated AI-generated code)');
  const implDir = path.join(DEMO_DIR, 'todo-app', 'src');
  await fs.mkdir(implDir, { recursive: true });
  const implPath = path.join(implDir, 'todo.ts');
  await fs.writeFile(
    implPath,
    `// Simulated AI-generated implementation
export interface Task {
  id: string;
  title: string;
  completed: boolean;
}

const tasks = new Map<string, Task>();

export function createTask(title: string): Task {
  const id = crypto.randomUUID();
  const task: Task = { id, title, completed: false };
  tasks.set(id, task);
  return task;
}

export function getTask(id: string): Task | undefined {
  return tasks.get(id);
}
`,
    'utf-8'
  );
  console.log('  ✓ Created src/todo.ts\n');

  // Step 3: isl check
  log(3, 'isl check — validate spec');
  const specPath = path.join(DEMO_DIR, 'todo-app', 'src', 'todo-app.isl');
  const check = await run(process.execPath, [isl, 'check', specPath], path.join(DEMO_DIR, 'todo-app'));
  console.log(check.stdout || check.stderr);

  // Step 4: isl verify
  log(4, 'isl verify — verify implementation vs spec');
  const verify = await run(process.execPath, [isl, 'verify', specPath, '--impl', implPath], path.join(DEMO_DIR, 'todo-app'));
  console.log(verify.stdout || verify.stderr);

  // Step 5: isl gate
  log(5, 'isl gate — SHIP/NO-SHIP decision');
  const gate = await run(
    process.execPath,
    [isl, 'gate', specPath, '--impl', implDir, '--threshold', '50', '--output', path.join(DEMO_DIR, 'todo-app', 'evidence')],
    path.join(DEMO_DIR, 'todo-app')
  );
  console.log(gate.stdout || gate.stderr);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Demo complete!                                              ║
║  Output: ${DEMO_DIR.padEnd(42)}║
╚══════════════════════════════════════════════════════════════╝
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
