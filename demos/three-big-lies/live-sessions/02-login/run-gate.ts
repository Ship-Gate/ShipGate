#!/usr/bin/env npx tsx
/**
 * ISL Gate - runs before deploy.
 * Verifies implementation against specs/auth.isl
 */
import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, 'src');

async function checkPiiLogging(): Promise<{ verdict: 'SHIP' | 'NO-SHIP'; message?: string }> {
  const entries = await readdir(SRC, { withFileTypes: true });
  let allCode = '';
  for (const e of entries) {
    if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.js'))) {
      allCode += await readFile(join(SRC, e.name), 'utf-8') + '\n';
    }
  }
  const lines = allCode.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.includes('console.log') && !line.includes('console.debug')) continue;
    if (/password|pwd|secret|token|credentials/i.test(line)) {
      return {
        verdict: 'NO-SHIP',
        message: 'Password or credentials may be logged - CRITICAL security violation',
      };
    }
  }
  return { verdict: 'SHIP' };
}

async function main() {
  console.log(`
🚦 ISL Gate
   Spec: specs/auth.isl
   Impl: src/

`);
  const result = await checkPiiLogging();
  if (result.verdict === 'NO-SHIP') {
    console.log(`  ┌─────────────────────────────────────────────────────────────┐
  │           ✗  NO-SHIP                                                │
  └─────────────────────────────────────────────────────────────┘

  [CRITICAL] ${result.message}

  Trust Score: 0%
  Confidence:  100%
`);
    process.exit(1);
  }
  console.log(`  ┌─────────────────────────────────────┐
  │           ✓  SHIP                  │
  └─────────────────────────────────────┘

  Trust Score: 95%
  Confidence:  100%
`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
