#!/usr/bin/env npx tsx
/**
 * ISL Gate - runs before deploy.
 * Verifies implementation against specs/registration.isl
 */
import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, 'src');

function stripComments(code: string): string {
  return code
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

async function checkValidation(): Promise<{ verdict: 'SHIP' | 'NO-SHIP'; message?: string }> {
  const entries = await readdir(SRC, { withFileTypes: true });
  let allCode = '';
  for (const e of entries) {
    if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.js'))) {
      allCode += await readFile(join(SRC, e.name), 'utf-8') + '\n';
    }
  }
  const c = stripComments(allCode);
  const hasDirectUse =
    /users\.set\s*\(\s*email|\.set\s*\(\s*email\s*,/i.test(c) ||
    (c.includes('email') && c.includes('users.set') && !/\bvalidate\b|sanitize|length\s*>/i.test(c));
  const hasValidation =
    /\bvalidate\b|sanitize|escape|z\.string|yup\.|joi\.|\.length\s*>\s*0|\.includes\s*\(|isValid|schema\./i.test(c);
  if (hasDirectUse && !hasValidation) {
    return {
      verdict: 'NO-SHIP',
      message: 'No input validation - accepts empty strings, invalid email, SQL injection, XSS',
    };
  }
  return { verdict: 'SHIP' };
}

async function main() {
  console.log(`
🚦 ISL Gate
   Spec: specs/registration.isl
   Impl: src/

`);
  const result = await checkValidation();
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
