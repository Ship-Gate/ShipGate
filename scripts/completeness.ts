#!/usr/bin/env npx tsx
/**
 * Completeness System - Main Entry Point
 * 
 * Runs the complete completeness checking and reporting pipeline:
 * 1. Checks all packages for completeness
 * 2. Generates prioritized backlog
 * 3. Generates markdown report
 * 
 * Usage:
 *   npx tsx scripts/completeness.ts          # full report
 *   npx tsx scripts/completeness.ts --ci    # CI mode (fails on mismatches)
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const args = process.argv.slice(2);
const ciMode = args.includes('--ci');

console.log('\n🎯 Platform Completion Program');
console.log('================================\n');

try {
  // Step 1: Run completeness checker
  console.log('📋 Step 1: Checking package completeness...');
  execSync(
    `npx tsx scripts/completeness-checker.ts${ciMode ? ' --ci' : ''}`,
    { cwd: rootDir, stdio: 'inherit' },
  );

  // Step 2: Generate prioritized backlog
  console.log('\n📊 Step 2: Generating prioritized backlog...');
  execSync('npx tsx scripts/completeness-backlog.ts', {
    cwd: rootDir,
    stdio: 'inherit',
  });

  // Step 3: Generate markdown report
  console.log('\n📄 Step 3: Generating completeness report...');
  execSync('npx tsx scripts/completeness-report.ts', {
    cwd: rootDir,
    stdio: 'inherit',
  });

  console.log('\n✅ Completeness report generated successfully!');
  console.log('📄 See reports/completeness.md for the full dashboard\n');
} catch (error) {
  console.error('\n❌ Completeness check failed');
  process.exit(1);
}
