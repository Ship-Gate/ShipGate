#!/usr/bin/env npx tsx
/**
 * Three Big Lies Demo — Video Recording Script
 *
 * Shows the 3 biggest lies AI tells when generating code, and ISL catching each one.
 *
 * Run: pnpm exec tsx demos/three-big-lies/run-demo.ts
 *
 * For video: Run this, screen record. Use the output as your script.
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { checkMoneyTransfer, checkPiiLogging, checkInputValidation } from './checker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function header(title: string) {
  console.log('\n' + '═'.repeat(70));
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`);
  console.log('═'.repeat(70) + '\n');
}

function codeBlock(path: string, content: string, maxLines = 12) {
  console.log(`${DIM}// ${path}${RESET}`);
  console.log('```');
  content
    .split('\n')
    .slice(0, maxLines)
    .forEach((line) => console.log(line));
  if (content.split('\n').length > maxLines) {
    console.log('...');
  }
  console.log('```\n');
}

async function runScenario(
  id: number,
  name: string,
  path: string,
  check: (code: string) => { verdict: string; violations: Array<{ message: string; severity: string }>; lie: string }
) {
  header(`LIE #${id}: ${name}`);
  const code = await readFile(path, 'utf-8');

  console.log(`${YELLOW}The AI said:${RESET} ${check(code).lie}\n`);
  console.log(`${DIM}The code it generated:${RESET}\n`);
  codeBlock(path, code);

  const result = check(code);
  console.log(`${BOLD}Running ISL Gate...${RESET}\n`);

  if (result.verdict === 'NO-SHIP') {
    console.log(`  ${RED}${BOLD}✗  NO-SHIP${RESET}`);
    console.log('');
    for (const v of result.violations) {
      const sev = v.severity === 'critical' ? RED : YELLOW;
      console.log(`  ${sev}[${v.severity.toUpperCase()}]${RESET} ${v.message}`);
    }
    console.log('');
    console.log(`  ${GREEN}→ ISL caught it. This code would NEVER ship.${RESET}`);
  } else {
    console.log(`  ${GREEN}✓ SHIP${RESET} (no violations found)`);
  }
}

async function main() {
  console.log(`
${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   THE 3 BIGGEST LIES AI TELLS WHEN GENERATING CODE                   ║
║   (And how ISL catches every single one)                             ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝${RESET}
`);

  const base = join(__dirname, 'scenarios');

  await runScenario(
    1,
    'MONEY — "This handles transfers correctly"',
    join(base, '01-money-transfer', 'bad.ts'),
    checkMoneyTransfer
  );

  await runScenario(
    2,
    'SECURITY — "This handles login securely"',
    join(base, '02-login-pii', 'bad.ts'),
    checkPiiLogging
  );

  await runScenario(
    3,
    'VALIDATION — "Input is validated"',
    join(base, '03-input-validation', 'bad.ts'),
    checkInputValidation
  );

  header('SUMMARY');
  console.log(`
  ${GREEN}3/3 lies caught.${RESET}
  
  AI generates code that compiles. It looks right. It "works."
  But it has bugs that would cause:
    • Theft (negative balances)
    • Data breaches (passwords in logs)
    • Security holes (no input validation)

  ${BOLD}ISL doesn't trust "it looks right." ISL verifies.${RESET}
  
  ${DIM}No AI code ships without passing the gate.${RESET}
`);

  console.log('═'.repeat(70) + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
