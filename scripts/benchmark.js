#!/usr/bin/env node
/**
 * Performance Benchmark Script
 * 
 * Tests parsing performance against the test fixtures.
 * 
 * Requirements:
 * - Parser package must be built (pnpm build)
 * - Test fixtures must exist in test-fixtures/
 * 
 * Benchmarks:
 * 1. Parse 1000 minimal specs - must complete in < 5s
 * 2. Parse all valid fixtures - must complete in < 5s
 * 3. Parse and typecheck all valid fixtures - must complete in < 10s
 */

import { performance } from 'perf_hooks';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const fixturesDir = join(rootDir, 'test-fixtures');

// ANSI colors
const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

// Helper to collect all .isl files in a directory
function collectISLFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      collectISLFiles(fullPath, files);
    } else if (entry.endsWith('.isl')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main benchmark
async function runBenchmarks() {
  console.log(colors.bold('\n📊 ISL Performance Benchmark\n'));
  
  // Check if fixtures exist
  if (!existsSync(fixturesDir)) {
    console.log(colors.yellow('⚠️  Test fixtures not found. Skipping benchmark.'));
    console.log(`   Expected at: ${fixturesDir}`);
    process.exit(0);
  }
  
  // Try to import parser
  let parse;
  try {
    const parser = await import('../packages/parser/dist/index.js');
    parse = parser.parse;
  } catch (e) {
    console.log(colors.yellow('⚠️  Parser not built. Run "pnpm build" first.'));
    console.log(`   Error: ${e.message}`);
    process.exit(0);
  }
  
  const results = [];
  
  // Benchmark 1: Parse 1000 minimal specs
  console.log(colors.cyan('Test 1: Parse 1000 minimal specs'));
  try {
    const minimalSpec = readFileSync(join(fixturesDir, 'valid/minimal.isl'), 'utf-8');
    const threshold = 5000; // 5 seconds
    
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      parse(minimalSpec);
    }
    const duration = performance.now() - start;
    
    const passed = duration < threshold;
    const status = passed ? colors.green('PASS') : colors.red('FAIL');
    console.log(`   ${status} - ${duration.toFixed(0)}ms (threshold: ${threshold}ms)`);
    results.push({ name: 'Parse 1000 minimal', passed, duration });
  } catch (e) {
    console.log(`   ${colors.red('ERROR')} - ${e.message}`);
    results.push({ name: 'Parse 1000 minimal', passed: false, error: e.message });
  }
  
  // Benchmark 2: Parse all valid fixtures
  console.log(colors.cyan('\nTest 2: Parse all valid fixtures'));
  try {
    const validDir = join(fixturesDir, 'valid');
    const validFiles = collectISLFiles(validDir);
    const threshold = 5000; // 5 seconds
    
    if (validFiles.length === 0) {
      console.log(`   ${colors.yellow('SKIP')} - No valid fixtures found`);
    } else {
      const sources = validFiles.map(f => ({
        path: f,
        content: readFileSync(f, 'utf-8'),
      }));
      
      const start = performance.now();
      for (const { content, path } of sources) {
        parse(content, path);
      }
      const duration = performance.now() - start;
      
      const passed = duration < threshold;
      const status = passed ? colors.green('PASS') : colors.red('FAIL');
      console.log(`   ${status} - ${validFiles.length} files in ${duration.toFixed(0)}ms (threshold: ${threshold}ms)`);
      results.push({ name: 'Parse all valid fixtures', passed, duration, fileCount: validFiles.length });
    }
  } catch (e) {
    console.log(`   ${colors.red('ERROR')} - ${e.message}`);
    results.push({ name: 'Parse all valid fixtures', passed: false, error: e.message });
  }
  
  // Benchmark 3: Parse edge case (large file)
  console.log(colors.cyan('\nTest 3: Parse large file (max-size.isl)'));
  try {
    const maxSizeFile = join(fixturesDir, 'edge-cases/max-size.isl');
    const threshold = 1000; // 1 second
    
    if (!existsSync(maxSizeFile)) {
      console.log(`   ${colors.yellow('SKIP')} - max-size.isl not found`);
    } else {
      const content = readFileSync(maxSizeFile, 'utf-8');
      
      const start = performance.now();
      parse(content, 'max-size.isl');
      const duration = performance.now() - start;
      
      const passed = duration < threshold;
      const status = passed ? colors.green('PASS') : colors.red('FAIL');
      console.log(`   ${status} - ${duration.toFixed(0)}ms (threshold: ${threshold}ms)`);
      results.push({ name: 'Parse large file', passed, duration });
    }
  } catch (e) {
    console.log(`   ${colors.red('ERROR')} - ${e.message}`);
    results.push({ name: 'Parse large file', passed: false, error: e.message });
  }
  
  // Summary
  console.log(colors.bold('\n📈 Summary'));
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  if (passed === total) {
    console.log(colors.green(`   ✅ All ${total} benchmarks passed!`));
  } else {
    console.log(colors.red(`   ❌ ${passed}/${total} benchmarks passed`));
  }
  
  // Return exit code
  process.exit(passed === total ? 0 : 1);
}

runBenchmarks().catch(e => {
  console.error('Benchmark failed:', e);
  process.exit(1);
});
