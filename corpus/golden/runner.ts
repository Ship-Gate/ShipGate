/**
 * Golden Corpus Runner
 * 
 * Runs parse/check/verify on each ISL spec and compares against expected outcomes.
 * Outputs a fail report for any mismatches.
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const SPECS_DIR = path.join(__dirname, 'specs');
const EXPECTED_DIR = path.join(__dirname, 'expected');
const CLI_PATH = path.join(__dirname, '..', '..', 'packages', 'cli', 'dist', 'cli.js');

// Types
interface SpecResult {
  file: string;
  category: string;
  parseSuccess: boolean;
  parseErrors: string[];
  checkSuccess: boolean;
  checkErrors: string[];
  checkWarnings: string[];
  stats: {
    domains: number;
    entities: number;
    behaviors: number;
    types: number;
    enums: number;
    scenarios: number;
    invariants: number;
  };
}

interface ExpectedResult {
  parseSuccess: boolean;
  checkSuccess: boolean;
  minDomains?: number;
  minEntities?: number;
  minBehaviors?: number;
  minTypes?: number;
  expectedErrors?: string[];
  notes?: string;
}

interface FailureReport {
  totalSpecs: number;
  passed: number;
  failed: number;
  failures: {
    file: string;
    reason: string;
    expected: Partial<ExpectedResult>;
    actual: Partial<SpecResult>;
  }[];
  duration: number;
}

// Utility functions
function findSpecFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findSpecFiles(fullPath));
    } else if (entry.name.endsWith('.isl')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function getCategory(filePath: string): string {
  const relative = path.relative(SPECS_DIR, filePath);
  return relative.split(path.sep)[0] || 'unknown';
}

function loadExpected(category: string, specName: string): ExpectedResult {
  const expectedPath = path.join(EXPECTED_DIR, category, `${specName}.json`);
  
  // If specific expected file exists, use it
  if (fs.existsSync(expectedPath)) {
    return JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
  }
  
  // Load category defaults
  const categoryDefaultsPath = path.join(EXPECTED_DIR, category, '_defaults.json');
  if (fs.existsSync(categoryDefaultsPath)) {
    return JSON.parse(fs.readFileSync(categoryDefaultsPath, 'utf-8'));
  }
  
  // Global defaults - most specs should parse and check successfully
  return {
    parseSuccess: true,
    checkSuccess: true,
    minDomains: 1,
    minBehaviors: 1
  };
}

function runParse(filePath: string): { success: boolean; errors: string[]; output: string } {
  try {
    const output = execSync(`node "${CLI_PATH}" parse "${filePath}" --format json 2>&1`, {
      encoding: 'utf-8',
      timeout: 30000
    });
    
    try {
      const result = JSON.parse(output);
      return {
        success: result.success !== false,
        errors: result.errors || [],
        output
      };
    } catch {
      // If output isn't JSON, check for error indicators
      const hasError = output.toLowerCase().includes('error') || 
                       output.toLowerCase().includes('failed');
      return {
        success: !hasError,
        errors: hasError ? [output.trim()] : [],
        output
      };
    }
  } catch (err: any) {
    return {
      success: false,
      errors: [err.message || String(err)],
      output: err.stdout || err.stderr || ''
    };
  }
}

function runCheck(filePath: string): { 
  success: boolean; 
  errors: string[]; 
  warnings: string[];
  stats: SpecResult['stats'];
  output: string;
} {
  try {
    const output = execSync(`node "${CLI_PATH}" check "${filePath}" --format json 2>&1`, {
      encoding: 'utf-8',
      timeout: 30000
    });
    
    try {
      const result = JSON.parse(output);
      const fileResult = result.files?.[0] || result;
      return {
        success: result.success !== false && fileResult.valid !== false,
        errors: fileResult.errors || result.errors || [],
        warnings: fileResult.warnings || result.warnings || [],
        stats: fileResult.stats || {
          domains: 0,
          entities: 0,
          behaviors: 0,
          types: 0,
          enums: 0,
          scenarios: 0,
          invariants: 0
        },
        output
      };
    } catch {
      const hasError = output.toLowerCase().includes('error') ||
                       output.toLowerCase().includes('failed');
      return {
        success: !hasError,
        errors: hasError ? [output.trim()] : [],
        warnings: [],
        stats: { domains: 0, entities: 0, behaviors: 0, types: 0, enums: 0, scenarios: 0, invariants: 0 },
        output
      };
    }
  } catch (err: any) {
    return {
      success: false,
      errors: [err.message || String(err)],
      warnings: [],
      stats: { domains: 0, entities: 0, behaviors: 0, types: 0, enums: 0, scenarios: 0, invariants: 0 },
      output: err.stdout || err.stderr || ''
    };
  }
}

function processSpec(filePath: string): SpecResult {
  const category = getCategory(filePath);
  const parseResult = runParse(filePath);
  const checkResult = runCheck(filePath);
  
  return {
    file: path.relative(SPECS_DIR, filePath),
    category,
    parseSuccess: parseResult.success,
    parseErrors: parseResult.errors,
    checkSuccess: checkResult.success,
    checkErrors: checkResult.errors,
    checkWarnings: checkResult.warnings,
    stats: checkResult.stats
  };
}

function compareResult(actual: SpecResult, expected: ExpectedResult): { passed: boolean; reason: string } {
  // Check parse success
  if (expected.parseSuccess !== undefined && actual.parseSuccess !== expected.parseSuccess) {
    return {
      passed: false,
      reason: `Parse ${expected.parseSuccess ? 'should succeed' : 'should fail'} but ${actual.parseSuccess ? 'succeeded' : 'failed'}`
    };
  }
  
  // Check type-check success
  if (expected.checkSuccess !== undefined && actual.checkSuccess !== expected.checkSuccess) {
    return {
      passed: false,
      reason: `Check ${expected.checkSuccess ? 'should succeed' : 'should fail'} but ${actual.checkSuccess ? 'succeeded' : 'failed'}`
    };
  }
  
  // Check minimum counts
  if (expected.minDomains !== undefined && actual.stats.domains < expected.minDomains) {
    return {
      passed: false,
      reason: `Expected at least ${expected.minDomains} domains, got ${actual.stats.domains}`
    };
  }
  
  if (expected.minEntities !== undefined && actual.stats.entities < expected.minEntities) {
    return {
      passed: false,
      reason: `Expected at least ${expected.minEntities} entities, got ${actual.stats.entities}`
    };
  }
  
  if (expected.minBehaviors !== undefined && actual.stats.behaviors < expected.minBehaviors) {
    return {
      passed: false,
      reason: `Expected at least ${expected.minBehaviors} behaviors, got ${actual.stats.behaviors}`
    };
  }
  
  if (expected.minTypes !== undefined && actual.stats.types < expected.minTypes) {
    return {
      passed: false,
      reason: `Expected at least ${expected.minTypes} types, got ${actual.stats.types}`
    };
  }
  
  // Check for expected errors
  if (expected.expectedErrors && expected.expectedErrors.length > 0) {
    const allErrors = [...actual.parseErrors, ...actual.checkErrors].join(' ');
    for (const expectedError of expected.expectedErrors) {
      if (!allErrors.toLowerCase().includes(expectedError.toLowerCase())) {
        return {
          passed: false,
          reason: `Expected error containing "${expectedError}" not found`
        };
      }
    }
  }
  
  return { passed: true, reason: '' };
}

function generateReport(results: SpecResult[], startTime: number): FailureReport {
  const failures: FailureReport['failures'] = [];
  let passed = 0;
  
  for (const result of results) {
    const specName = path.basename(result.file, '.isl');
    const expected = loadExpected(result.category, specName);
    const comparison = compareResult(result, expected);
    
    if (comparison.passed) {
      passed++;
    } else {
      failures.push({
        file: result.file,
        reason: comparison.reason,
        expected,
        actual: {
          parseSuccess: result.parseSuccess,
          checkSuccess: result.checkSuccess,
          stats: result.stats,
          parseErrors: result.parseErrors,
          checkErrors: result.checkErrors
        }
      });
    }
  }
  
  return {
    totalSpecs: results.length,
    passed,
    failed: failures.length,
    failures,
    duration: Date.now() - startTime
  };
}

function printReport(report: FailureReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('GOLDEN CORPUS TEST REPORT');
  console.log('='.repeat(60));
  console.log(`\nTotal Specs: ${report.totalSpecs}`);
  console.log(`Passed: ${report.passed}`);
  console.log(`Failed: ${report.failed}`);
  console.log(`Duration: ${report.duration}ms`);
  
  if (report.failures.length > 0) {
    console.log('\n' + '-'.repeat(60));
    console.log('FAILURES:');
    console.log('-'.repeat(60));
    
    for (const failure of report.failures) {
      console.log(`\n[FAIL] ${failure.file}`);
      console.log(`  Reason: ${failure.reason}`);
      if (failure.actual.parseErrors && failure.actual.parseErrors.length > 0) {
        console.log(`  Parse Errors: ${failure.actual.parseErrors.slice(0, 3).join(', ')}`);
      }
      if (failure.actual.checkErrors && failure.actual.checkErrors.length > 0) {
        console.log(`  Check Errors: ${failure.actual.checkErrors.slice(0, 3).join(', ')}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (report.failed === 0) {
    console.log('ALL TESTS PASSED ✓');
  } else {
    console.log(`${report.failed} TEST(S) FAILED ✗`);
  }
  
  console.log('='.repeat(60) + '\n');
}

// Main execution
async function main(): Promise<void> {
  const startTime = Date.now();
  
  console.log('Golden Corpus Runner');
  console.log('Finding spec files...');
  
  const specFiles = findSpecFiles(SPECS_DIR);
  console.log(`Found ${specFiles.length} spec files`);
  
  if (specFiles.length === 0) {
    console.error('No spec files found!');
    process.exit(1);
  }
  
  console.log('Processing specs...\n');
  
  const results: SpecResult[] = [];
  let processed = 0;
  
  for (const file of specFiles) {
    processed++;
    const shortName = path.relative(SPECS_DIR, file);
    process.stdout.write(`[${processed}/${specFiles.length}] ${shortName}...`);
    
    const result = processSpec(file);
    results.push(result);
    
    const status = result.parseSuccess && result.checkSuccess ? '✓' : '✗';
    console.log(` ${status}`);
  }
  
  const report = generateReport(results, startTime);
  printReport(report);
  
  // Write JSON report
  const reportPath = path.join(__dirname, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report written to: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(report.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Runner error:', err);
  process.exit(1);
});
