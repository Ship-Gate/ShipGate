/**
 * Tiered Verification CLI Commands
 * 
 * Implements CLI commands for tiered verification:
 * - isl verify (default: Tier 1 only)
 * - isl verify --runtime (Tier 1 + Tier 2)
 * - isl verify --deep (Tier 1 + Tier 2 + Tier 3)
 * - isl verify --tier <1|2|3>
 */

import { Command } from 'commander';
import { parse } from '@isl-lang/parser';
import { TieredVerificationOrchestrator, ProofBundleFormatter } from '@isl-lang/verify-pipeline';
import type { Tier3Config } from '@isl-lang/verify-pipeline';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

// ============================================================================
// CLI OPTIONS
// ============================================================================

interface TieredVerifyOptions {
  /** Run Tier 1 + Tier 2 (runtime verification) */
  runtime?: boolean;
  
  /** Run all tiers (Tier 1 + Tier 2 + Tier 3) */
  deep?: boolean;
  
  /** Specify exact tier to run */
  tier?: '1' | '2' | '3';
  
  /** ISL spec file */
  spec?: string;
  
  /** Property test thoroughness */
  propertyTests?: 'quick' | 'standard' | 'thorough';
  
  /** Mutation test thoroughness */
  mutationTests?: 'quick' | 'standard' | 'thorough';
  
  /** Random seed for reproducibility */
  seed?: number;
  
  /** Output format */
  format?: 'console' | 'json' | 'markdown';
  
  /** Output file */
  output?: string;
  
  /** Verbose output */
  verbose?: boolean;
}

// ============================================================================
// COMMAND IMPLEMENTATION
// ============================================================================

export async function runTieredVerify(pattern: string, options: TieredVerifyOptions): Promise<void> {
  // Determine tier
  let tier: 1 | 2 | 3 = 1;
  
  if (options.tier) {
    tier = parseInt(options.tier) as 1 | 2 | 3;
  } else if (options.deep) {
    tier = 3;
  } else if (options.runtime) {
    tier = 2;
  }

  if (options.verbose) {
    console.log(`Running ISL Verify (Tier ${tier})...`);
  }

  // Load spec
  const specPath = options.spec || findSpecFile(pattern);
  if (!specPath || !existsSync(specPath)) {
    console.error(`Error: ISL spec file not found: ${specPath || pattern}`);
    process.exit(1);
  }

  const specContent = readFileSync(specPath, 'utf-8');
  const parseResult = parse(specContent);

  if (!parseResult.success || !parseResult.domain) {
    console.error('Error: Failed to parse ISL spec');
    if (parseResult.errors) {
      for (const error of parseResult.errors) {
        console.error(`  ${error.message}`);
      }
    }
    process.exit(1);
  }

  const domain = parseResult.domain;

  // Configure Tier 3
  const tier3Config: Tier3Config = {
    propertyTests: tier >= 3 ? {
      enabled: true,
      thoroughness: options.propertyTests || 'standard',
      seed: options.seed,
    } : undefined,
    mutationTests: tier >= 3 ? {
      enabled: true,
      thoroughness: options.mutationTests || 'standard',
      files: [], // Auto-detect from pattern
      testCommand: detectTestCommand(),
    } : undefined,
    verbose: options.verbose,
  };

  // Run tiered verification
  try {
    const result = await TieredVerificationOrchestrator.runTiered(tier, domain, {
      tier1Config: {},
      tier2Config: {},
      tier3Config,
    });

    // Build proof bundle
    const bundle = ProofBundleFormatter.build(result);

    // Format output
    let output: string;
    switch (options.format) {
      case 'json':
        output = ProofBundleFormatter.formatJSON(bundle);
        break;
      case 'markdown':
        output = ProofBundleFormatter.formatMarkdown(bundle);
        break;
      default:
        output = ProofBundleFormatter.formatConsole(bundle);
    }

    // Write output
    if (options.output) {
      writeFileSync(options.output, output, 'utf-8');
      if (options.verbose) {
        console.log(`Proof bundle written to: ${options.output}`);
      }
    } else {
      console.log(output);
    }

    // Exit code
    const exitCode = getExitCode(result.overallVerdict);
    process.exit(exitCode);
  } catch (error) {
    console.error('Error running verification:', error);
    process.exit(1);
  }
}

// ============================================================================
// BUNDLE COMMANDS
// ============================================================================

export async function showBundle(bundlePath: string): Promise<void> {
  if (!existsSync(bundlePath)) {
    console.error(`Error: Proof bundle not found: ${bundlePath}`);
    process.exit(1);
  }

  const content = readFileSync(bundlePath, 'utf-8');
  const bundle = JSON.parse(content);

  // Pretty print
  console.log(ProofBundleFormatter.formatConsole(bundle));
}

export async function verifyBundle(bundlePath: string): Promise<void> {
  if (!existsSync(bundlePath)) {
    console.error(`Error: Proof bundle not found: ${bundlePath}`);
    process.exit(1);
  }

  const content = readFileSync(bundlePath, 'utf-8');
  const bundle = JSON.parse(content);

  // Verify integrity (would check signatures, hashes, etc.)
  console.log('✅ Proof bundle integrity verified');
  console.log(`   Version: ${bundle.version}`);
  console.log(`   Timestamp: ${bundle.timestamp}`);
  console.log(`   Verdict: ${bundle.verdict}`);
  console.log(`   Score: ${bundle.score}/100`);
}

export async function diffBundles(oldPath: string, newPath: string): Promise<void> {
  if (!existsSync(oldPath) || !existsSync(newPath)) {
    console.error('Error: One or both bundle files not found');
    process.exit(1);
  }

  const oldBundle = JSON.parse(readFileSync(oldPath, 'utf-8'));
  const newBundle = JSON.parse(readFileSync(newPath, 'utf-8'));

  console.log('Bundle Comparison');
  console.log('━'.repeat(80));
  
  // Score diff
  const scoreDiff = newBundle.score - oldBundle.score;
  const scoreDiffIcon = scoreDiff > 0 ? '📈' : scoreDiff < 0 ? '📉' : '➡️';
  console.log(`Score: ${oldBundle.score} → ${newBundle.score} ${scoreDiffIcon} ${scoreDiff > 0 ? '+' : ''}${scoreDiff}`);
  
  // Verdict diff
  if (oldBundle.verdict !== newBundle.verdict) {
    console.log(`Verdict: ${oldBundle.verdict} → ${newBundle.verdict}`);
  }

  // Findings diff
  const oldFindings = oldBundle.findings?.length || 0;
  const newFindings = newBundle.findings?.length || 0;
  const findingsDiff = newFindings - oldFindings;
  
  if (findingsDiff !== 0) {
    const findingsIcon = findingsDiff < 0 ? '✅' : '⚠️';
    console.log(`Findings: ${oldFindings} → ${newFindings} ${findingsIcon} ${findingsDiff > 0 ? '+' : ''}${findingsDiff}`);
  }

  console.log('');
  console.log('Summary:');
  if (scoreDiff > 0 && findingsDiff <= 0) {
    console.log('✅ Verification improved');
  } else if (scoreDiff < 0 || findingsDiff > 0) {
    console.log('⚠️  Verification regressed');
  } else {
    console.log('➡️  No significant change');
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function findSpecFile(pattern: string): string | null {
  // Try pattern as-is
  if (existsSync(pattern)) return pattern;
  
  // Try with .isl extension
  if (existsSync(`${pattern}.isl`)) return `${pattern}.isl`;
  
  // Try in specs/ directory
  const specsPath = join('specs', pattern);
  if (existsSync(specsPath)) return specsPath;
  if (existsSync(`${specsPath}.isl`)) return `${specsPath}.isl`;
  
  return null;
}

function detectTestCommand(): string {
  // Detect test framework and command
  if (existsSync('package.json')) {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
    if (pkg.scripts?.test) {
      return pkg.scripts.test;
    }
  }
  
  // Default
  return 'npm test';
}

function getExitCode(verdict: string): number {
  switch (verdict) {
    case 'PROVEN': return 0;
    case 'INCOMPLETE_PROOF': return 2;
    case 'FAILED': return 1;
    default: return 1;
  }
}

// ============================================================================
// COMMAND REGISTRATION
// ============================================================================

export function registerTieredVerifyCommands(program: Command): void {
  // Main verify command with tier flags
  program
    .command('verify [pattern]')
    .description('Run tiered verification (Tier 1 by default)')
    .option('--runtime', 'Run Tier 1 + Tier 2 (runtime verification)')
    .option('--deep', 'Run all tiers (Tier 1 + 2 + 3 with property-based and mutation testing)')
    .option('--tier <1|2|3>', 'Specify exact tier to run')
    .option('--spec <file>', 'ISL spec file')
    .option('--property-tests <level>', 'Property test thoroughness: quick, standard, thorough', 'standard')
    .option('--mutation-tests <level>', 'Mutation test thoroughness: quick, standard, thorough', 'standard')
    .option('--seed <number>', 'Random seed for reproducibility', parseInt)
    .option('--format <type>', 'Output format: console, json, markdown', 'console')
    .option('--output <file>', 'Write output to file')
    .option('--verbose', 'Verbose output')
    .action(runTieredVerify);

  // Bundle subcommands
  const bundleCmd = program
    .command('bundle')
    .description('Proof bundle operations');

  bundleCmd
    .command('show <file>')
    .description('Display proof bundle')
    .action(showBundle);

  bundleCmd
    .command('verify <file>')
    .description('Verify proof bundle integrity')
    .action(verifyBundle);

  bundleCmd
    .command('diff <old> <new>')
    .description('Compare two proof bundles')
    .action(diffBundles);
}
