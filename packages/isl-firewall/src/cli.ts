#!/usr/bin/env node
/**
 * ISL Firewall CLI
 * 
 * Unified gate command for ShipGate integrated firewall.
 * 
 * Usage:
 *   npx @isl-lang/firewall gate [file]     # Check a file
 *   npx @isl-lang/firewall gate --ci       # CI mode with JSON output
 *   npx @isl-lang/firewall status          # Show firewall status
 */

import { createIntegratedFirewall, type IntegratedGateResult } from './isl-studio-integration.js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, relative } from 'path';
import { glob } from 'glob';

interface CliOptions {
  ci: boolean;
  output: 'text' | 'json' | 'sarif';
  changedOnly: boolean;
  explain: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'gate':
      await runGate(args.slice(1));
      break;
    case 'status':
      showStatus();
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      if (command && !command.startsWith('-')) {
        // Treat as file path
        await runGate([command, ...args.slice(1)]);
      } else {
        showHelp();
      }
  }
}

async function runGate(args: string[]) {
  const options = parseOptions(args);
  const files = args.filter(a => !a.startsWith('-') && !a.startsWith('--'));
  
  const firewall = createIntegratedFirewall({
    projectRoot: process.cwd(),
    mode: 'enforce',
  });

  // Get files to check
  let filesToCheck: string[] = [];
  
  if (files.length > 0) {
    filesToCheck = files.map(f => resolve(f));
  } else if (options.changedOnly) {
    // Get changed files from git
    const { execSync } = await import('child_process');
    try {
      const diff = execSync('git diff --name-only HEAD', { encoding: 'utf-8' });
      const staged = execSync('git diff --name-only --cached', { encoding: 'utf-8' });
      filesToCheck = [...new Set([...diff.split('\n'), ...staged.split('\n')])]
        .filter(f => f && f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.tsx') || f.endsWith('.jsx'))
        .map(f => resolve(f));
    } catch {
      // Fall back to all files
      filesToCheck = await glob('**/*.{ts,js,tsx,jsx}', { 
        ignore: ['node_modules/**', 'dist/**', 'build/**'],
        absolute: true,
      });
    }
  } else {
    // Check all files
    filesToCheck = await glob('**/*.{ts,js,tsx,jsx}', { 
      ignore: ['node_modules/**', 'dist/**', 'build/**'],
      absolute: true,
    });
  }

  if (filesToCheck.length === 0) {
    console.log('No files to check');
    process.exit(0);
  }

  // Run checks
  let totalViolations = 0;
  let totalHardBlocks = 0;
  const results: Array<{ file: string; result: IntegratedGateResult }> = [];

  for (const file of filesToCheck) {
    if (!existsSync(file)) continue;
    
    const content = readFileSync(file, 'utf-8');
    const result = await firewall.evaluate({ filePath: file, content });
    
    results.push({ file, result });
    totalViolations += result.combined?.totalViolations ?? 0;
    totalHardBlocks += result.combined?.hardBlocks ?? 0;
  }

  // Calculate combined verdict (guard against NaN from undefined values)
  const verdict = totalHardBlocks > 0 ? 'NO_SHIP' : 'SHIP';
  const rawScore = 100 - (totalHardBlocks * 25) - ((totalViolations - totalHardBlocks) * 5);
  const score = Number.isFinite(rawScore) ? Math.max(0, rawScore) : 100;

  // Output results
  if (options.output === 'json' || options.ci) {
    const output = {
      verdict,
      score,
      filesChecked: filesToCheck.length,
      violations: totalViolations,
      hardBlocks: totalHardBlocks,
      results: results.map(r => ({
        file: relative(process.cwd(), r.file),
        verdict: r.result.combined.verdict,
        violations: r.result.violations.map(v => ({
          rule: v.policyId,
          message: v.message,
          severity: v.severity,
          tier: v.tier,
          suggestion: v.suggestion,
        })),
      })).filter(r => r.violations.length > 0),
    };
    console.log(JSON.stringify(output, null, 2));
  } else if (options.output === 'sarif') {
    const sarif = generateSARIF(results);
    console.log(JSON.stringify(sarif, null, 2));
  } else {
    // Text output
    console.log();
    console.log(`┌${'─'.repeat(50)}┐`);
    console.log(`│ ShipGate Gate${' '.repeat(34)}│`);
    console.log(`├${'─'.repeat(50)}┤`);
    console.log(`│ Verdict: ${verdict === 'SHIP' ? '✓ SHIP' : '✗ NO_SHIP'}${' '.repeat(verdict === 'SHIP' ? 32 : 30)}│`);
    console.log(`│ Score:   ${score}/100${' '.repeat(36)}│`);
    console.log(`│ Files:   ${filesToCheck.length}${' '.repeat(40 - String(filesToCheck.length).length)}│`);
    console.log(`└${'─'.repeat(50)}┘`);
    console.log();

    if (totalViolations > 0) {
      console.log(`Found ${totalViolations} violation(s):`);
      console.log();

      for (const { file, result } of results) {
        if (result.violations.length === 0) continue;

        console.log(`  ${relative(process.cwd(), file)}`);
        for (const v of result.violations) {
          const icon = v.tier === 'hard_block' ? '✗' : v.tier === 'soft_block' ? '!' : '○';
          console.log(`    ${icon} [${v.policyId}] ${v.message}`);
          if (options.explain && v.suggestion) {
            console.log(`      └─ Fix: ${v.suggestion}`);
          }
        }
        console.log();
      }
    } else {
      console.log('  All checks passed! ✓');
      console.log();
    }
  }

  // Record run for evidence/metrics (blocked PR metrics, rule calibration)
  await recordGateRun({
    verdict: verdict as 'SHIP' | 'NO_SHIP',
    score,
    filesChecked: filesToCheck.length,
    violations: results.flatMap((r) =>
      r.result.violations.map((v) => ({
        policyId: v.policyId,
        message: v.message,
        severity: v.severity,
        tier: v.tier,
        file: relative(process.cwd(), r.file),
      }))
    ),
    source: 'firewall',
  });

  // Exit with appropriate code
  process.exit(verdict === 'SHIP' ? 0 : 1);
}

async function recordGateRun(record: {
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  filesChecked: number;
  violations: Array<{ policyId: string; message: string; severity: string; tier: string; file?: string }>;
  source: string;
}): Promise<void> {
  try {
    const { mkdir, writeFile } = await import('fs/promises');
    const { join } = await import('path');
    const runId = `${new Date().toISOString().replace(/[:-]/g, '').slice(0, 15)}-${Math.random().toString(36).slice(2, 10)}`;
    const runsDir = join(process.cwd(), '.shipgate', 'runs');
    const runDir = join(runsDir, runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(
      join(runDir, 'manifest.json'),
      JSON.stringify({ ...record, runId, timestamp: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  } catch {
    // Non-fatal: metrics recording failed
  }
}

function showStatus() {
  const firewall = createIntegratedFirewall({ projectRoot: process.cwd() });
  const status = firewall.getStatus();

  console.log();
  console.log('ShipGate Firewall Status');
  console.log('─'.repeat(40));
  console.log(`Mode: ${status.mode}`);
  console.log();
  console.log('ShipGate Policies:');
  for (const p of status.shipgatePolicies) {
    console.log(`  • ${p}`);
  }
  console.log();
  console.log('ShipGate Rules:');
  for (const r of status.shipgateRules) {
    console.log(`  • ${r}`);
  }
  console.log();
}

function showHelp() {
  console.log(`
ShipGate Firewall CLI

Usage:
  firewall gate [files...]      Check files for violations
  firewall status               Show firewall status
  firewall help                 Show this help

Options:
  --ci                          CI mode (JSON output, exit code)
  --output <format>             Output format: text, json, sarif
  --changed-only                Only check git-changed files
  --explain                     Show fix suggestions

Examples:
  firewall gate src/api/*.ts    Check specific files
  firewall gate --changed-only  Check only changed files
  firewall gate --ci            Run in CI with JSON output
  firewall status               Show active rules

ShipGate validates against truthpack (routes, env, contracts)
and enforces policy packs (auth, pii, payments, rate-limit, intent).

Combined verdict: SHIP (safe to merge) or NO_SHIP (blocked).
`);
}

function parseOptions(args: string[]): CliOptions {
  return {
    ci: args.includes('--ci'),
    output: args.includes('--output') 
      ? (args[args.indexOf('--output') + 1] as 'text' | 'json' | 'sarif') 
      : args.includes('--ci') ? 'json' : 'text',
    changedOnly: args.includes('--changed-only'),
    explain: args.includes('--explain'),
  };
}

function generateSARIF(results: Array<{ file: string; result: IntegratedGateResult }>) {
  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'ShipGate',
          version: '0.1.0',
          informationUri: 'https://shipgate.dev',
          rules: [
            { id: 'auth/bypass-detected', shortDescription: { text: 'Auth bypass pattern detected' } },
            { id: 'auth/hardcoded-credentials', shortDescription: { text: 'Hardcoded credentials' } },
            { id: 'pii/logged-sensitive-data', shortDescription: { text: 'Sensitive data logged' } },
            { id: 'pii/console-in-production', shortDescription: { text: 'console.log in production' } },
            { id: 'payments/client-side-amount', shortDescription: { text: 'Client-side payment amount' } },
            { id: 'payments/missing-idempotency', shortDescription: { text: 'Missing idempotency key' } },
            { id: 'rate-limit/auth-endpoint', shortDescription: { text: 'Missing rate limit' } },
            { id: 'intent/missing-error-handling', shortDescription: { text: 'Missing error handling' } },
          ],
        },
      },
      results: results.flatMap(({ file, result }) =>
        result.violations.map(v => ({
          ruleId: v.policyId,
          message: { text: v.message },
          level: v.tier === 'hard_block' ? 'error' : v.tier === 'soft_block' ? 'warning' : 'note',
          locations: [{
            physicalLocation: {
              artifactLocation: { uri: relative(process.cwd(), file) },
            },
          }],
        }))
      ),
    }],
  };
}

main().catch(console.error);
