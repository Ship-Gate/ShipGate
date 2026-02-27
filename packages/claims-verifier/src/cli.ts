#!/usr/bin/env node
// ============================================================================
// Claims Verifier CLI
// ============================================================================

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { glob } from 'glob';
import { resolve, relative } from 'path';
import { ClaimsLinter, formatLintResults, type LinterOptions } from './linter.js';
import { AutoSoftener } from './softener.js';
import type { KnownFact, LintResult } from './types.js';

interface CliOptions {
  /** Glob patterns for files to lint */
  include: string[];
  
  /** Path to known facts JSON file */
  factsFile?: string;
  
  /** Auto-fix (soften) unverifiable claims */
  fix?: boolean;
  
  /** Output format */
  format?: 'text' | 'json' | 'sarif';
  
  /** Fail on warnings */
  strict?: boolean;
  
  /** Working directory */
  cwd?: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    include: [],
    fix: false,
    format: 'text',
    strict: false,
    cwd: process.cwd(),
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--fix' || arg === '-f') {
      options.fix = true;
    } else if (arg === '--strict' || arg === '-s') {
      options.strict = true;
    } else if (arg === '--format') {
      options.format = args[++i] as 'text' | 'json' | 'sarif';
    } else if (arg === '--facts') {
      options.factsFile = args[++i];
    } else if (arg === '--cwd') {
      options.cwd = args[++i];
    } else if (!arg.startsWith('-')) {
      options.include.push(arg);
    }
  }
  
  // Default patterns
  if (options.include.length === 0) {
    options.include = [
      'docs/**/*.md',
      'README.md',
      '**/Landing.tsx',
      '**/page.tsx',
    ];
  }
  
  return options;
}

/**
 * Load known facts from file
 */
function loadFacts(factsFile?: string): KnownFact[] {
  if (!factsFile || !existsSync(factsFile)) {
    return [];
  }
  
  try {
    const content = readFileSync(factsFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    console.error(`Warning: Could not load facts from ${factsFile}`);
    return [];
  }
}

/**
 * Find files matching patterns
 */
async function findFiles(patterns: string[], cwd: string): Promise<string[]> {
  const files: string[] = [];
  
  for (const pattern of patterns) {
    const matches = await glob(pattern, { cwd, absolute: true });
    files.push(...matches);
  }
  
  return [...new Set(files)]; // Deduplicate
}

/**
 * Format results as SARIF
 */
function formatSarif(results: LintResult[]): string {
  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'claims-verifier',
          version: '0.1.0',
          rules: [
            {
              id: 'unverifiable-claim',
              name: 'UnverifiableClaim',
              shortDescription: { text: 'Numeric claim cannot be verified against known facts' },
              defaultConfiguration: { level: 'warning' },
            },
            {
              id: 'mismatched-claim',
              name: 'MismatchedClaim',
              shortDescription: { text: 'Numeric claim does not match verified value' },
              defaultConfiguration: { level: 'error' },
            },
          ],
        },
      },
      results: results.flatMap(r => r.issues.map(issue => ({
        ruleId: issue.claim.status === 'mismatch' ? 'mismatched-claim' : 'unverifiable-claim',
        level: issue.severity,
        message: { text: issue.message },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: r.file },
            region: {
              startLine: issue.claim.location.line,
              startColumn: issue.claim.location.column ?? 1,
            },
          },
        }],
        fixes: issue.fixable ? [{
          description: { text: issue.suggestion ?? 'Soften claim' },
          artifactChanges: [{
            artifactLocation: { uri: r.file },
            replacements: [{
              deletedRegion: {
                startLine: issue.claim.location.line,
                startColumn: issue.claim.location.column ?? 1,
                endColumn: (issue.claim.location.column ?? 1) + issue.claim.text.length,
              },
              insertedContent: { text: issue.softened ?? '' },
            }],
          }],
        }] : undefined,
      }))),
    }],
  };
  
  return JSON.stringify(sarif, null, 2);
}

/**
 * Main CLI entry point
 */
export async function main(args: string[] = process.argv.slice(2)): Promise<number> {
  const options = parseArgs(args);
  
  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Claims Verifier - Lint documentation for unverifiable numeric claims

Usage:
  claims-verifier [patterns...] [options]

Options:
  --fix, -f       Auto-soften unverifiable claims
  --strict, -s    Fail on warnings (exit code 1)
  --format        Output format: text, json, sarif (default: text)
  --facts <file>  Path to known facts JSON file
  --cwd <dir>     Working directory (default: cwd)
  --help, -h      Show this help

Examples:
  claims-verifier docs/**/*.md README.md
  claims-verifier --fix --format json
  claims-verifier --facts known-facts.json --strict
`);
    return 0;
  }
  
  const cwd = options.cwd ?? process.cwd();
  
  // Load known facts
  const facts = loadFacts(options.factsFile);
  
  // Create linter
  const linterOptions: LinterOptions = {
    knownFacts: facts.length > 0 ? facts : undefined,
    autoSoften: options.fix,
  };
  
  const linter = new ClaimsLinter(linterOptions);
  
  // Find files
  const files = await findFiles(options.include, cwd);
  
  if (files.length === 0) {
    console.log('No files found matching patterns:', options.include.join(', '));
    return 0;
  }
  
  // Lint each file
  const results: LintResult[] = [];
  
  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const relativePath = relative(cwd, file);
      const result = linter.lint(content, relativePath);
      results.push(result);
      
      // Auto-fix if requested
      if (options.fix && result.issues.some(i => i.fixable)) {
        const softener = new AutoSoftener();
        const softened = softener.soften(content, result);
        
        if (softened.claimsSoftened > 0) {
          writeFileSync(file, softened.softened, 'utf-8');
          console.log(`Fixed ${softened.claimsSoftened} claim(s) in ${relativePath}`);
        }
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }
  
  // Output results
  switch (options.format) {
    case 'json':
      console.log(JSON.stringify(results, null, 2));
      break;
    case 'sarif':
      console.log(formatSarif(results));
      break;
    default:
      console.log(formatLintResults(results));
  }
  
  // Calculate exit code
  const hasErrors = results.some(r => r.issues.some(i => i.severity === 'error'));
  const hasWarnings = results.some(r => r.issues.some(i => i.severity === 'warning'));
  
  if (hasErrors) return 1;
  if (options.strict && hasWarnings) return 1;
  return 0;
}

// Run if called directly
if (process.argv[1]?.endsWith('cli.js') || process.argv[1]?.endsWith('cli.ts')) {
  main().then(code => process.exit(code));
}
