/**
 * CLI Command Definitions
 * 
 * Defines all ISL CLI commands using commander.
 * 
 * Commands:
 *   isl parse <file>           # Parse and show AST
 *   isl check <file>           # Type check
 *   isl gen <target> <file>    # Generate code (ts, rust, go, openapi)
 *   isl verify <file>          # Verify spec against target
 *   isl repl                   # Start REPL
 *   isl init                   # Create .isl config and example spec
 *   isl fmt <file>             # Format ISL file
 *   isl lint <file>            # Lint ISL file for best practices
 */

import { Command, InvalidArgumentError } from 'commander';
import chalk from 'chalk';
import { output, type OutputFormat } from './output.js';
import { ExitCode } from './exit-codes.js';
import { findClosestMatch, isCI, isTTY } from './utils.js';
import { loadConfig, loadConfigFromFile } from './config.js';
import {
  // Commands
  check, printCheckResult,
  generate, printGenerateResult,
  verify, printVerifyResult,
  init, printInitResult,
  parse, printParseResult, getParseExitCode,
  gen, printGenResult, getGenExitCode, VALID_TARGETS,
  repl,
  fmt, printFmtResult, getFmtExitCode,
  lint, printLintResult, getLintExitCode,
  gate, printGateResult, getGateExitCode,
  trustScore, printTrustScoreResult, printTrustScoreHistory, getTrustScoreExitCode,
  heal, printHealResult, getHealExitCode,
  verifyProof, printProofVerifyResult, getProofVerifyExitCode,
  createPolicyBundle, printCreateBundleResult, getCreateBundleExitCode,
  verifyPolicyBundle, printVerifyBundleResult, getVerifyBundleExitCode,
  watch,
} from './commands/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Version
// ─────────────────────────────────────────────────────────────────────────────

const VERSION = '1.0.0';

// ─────────────────────────────────────────────────────────────────────────────
// Available Commands (for suggestions)
// ─────────────────────────────────────────────────────────────────────────────

const COMMANDS = [
  'parse', 'check', 'gen', 'verify', 'repl', 'init', 'fmt', 'lint',
  'generate', 'build', // aliases
  'gate', // SHIP/NO-SHIP gate
  'gate:trust-score', 'trust-score', // Trust score engine
  'heal', // Auto-fix violations
  'proof', // Proof verification
  'watch', // Watch mode
  'vibecheck', // integration command
];

// ─────────────────────────────────────────────────────────────────────────────
// Optional Features (defensive loading)
// ─────────────────────────────────────────────────────────────────────────────

interface VibecheckModule {
  runVibecheck(options: {
    spec?: string;
    impl?: string;
    mode?: string;
    verbose?: boolean;
  }): Promise<{
    success: boolean;
    score?: number;
    report?: unknown;
    error?: string;
  }>;
}

let vibecheckModule: VibecheckModule | undefined;
let vibecheckAvailable = false;

/**
 * Try to load the vibecheck module
 */
async function loadVibecheck(): Promise<boolean> {
  if (vibecheckAvailable) return true;
  
  try {
    const module = await import('@isl-lang/vibecheck');
    if (module.runVibecheck) {
      vibecheckModule = module;
      vibecheckAvailable = true;
      return true;
    }
  } catch {
    // Not installed - this is fine
  }
  
  // Try alternative paths
  try {
    const module = await import('vibecheck');
    if (module.runVibecheck) {
      vibecheckModule = module;
      vibecheckAvailable = true;
      return true;
    }
  } catch {
    // Not installed - this is fine
  }
  
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Setup
// ─────────────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('isl')
  .description(chalk.bold('Intent Specification Language CLI') + '\n' + 
    chalk.gray('The programming language for the AI era'))
  .version(VERSION, '-V, --version', 'Show version number')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-q, --quiet', 'Suppress non-error output')
  .option('--no-color', 'Disable colored output')
  .option('-f, --format <format>', 'Output format: pretty, json, quiet', 'pretty')
  .option('-c, --config <path>', 'Path to config file')
  .hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();
    
    // Determine format
    let format: OutputFormat = 'pretty';
    if (opts.format === 'json') format = 'json';
    else if (opts.format === 'quiet' || opts.quiet) format = 'quiet';
    
    // Auto-detect CI environment
    const noColor = !opts.color || isCI() || !isTTY();
    
    output.configure({
      verbose: opts.verbose ?? false,
      quiet: opts.quiet ?? false,
      noColor,
      format,
    });
    
    // Load custom config if specified
    if (opts.config) {
      const { config, error } = await loadConfigFromFile(opts.config);
      if (error) {
        console.error(chalk.red(`Error loading config: ${error}`));
        process.exit(ExitCode.USAGE_ERROR);
      }
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Parse Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('parse <file>')
  .description('Parse an ISL file and display the AST')
  .action(async (file: string) => {
    const opts = program.opts();
    const result = await parse(file, { 
      verbose: opts.verbose,
      format: opts.format,
    });
    
    printParseResult(result, { format: opts.format });
    process.exit(getParseExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Check Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('check [files...]')
  .description('Parse and type check ISL files')
  .option('-w, --watch', 'Watch for changes')
  .option('--debug', 'Print resolved imports debug info')
  .action(async (files: string[], options) => {
    const opts = program.opts();
    const result = await check(files, {
      verbose: opts.verbose,
      quiet: opts.format === 'quiet',
      watch: options.watch,
      config: opts.config,
      debug: options.debug,
    });
    
    if (opts.format === 'json') {
      console.log(JSON.stringify({
        success: result.success,
        files: result.files.map(f => ({
          file: f.file,
          valid: f.valid,
          errors: f.errors,
          warnings: f.warnings,
          stats: f.stats,
          imports: f.imports,
        })),
        totalErrors: result.totalErrors,
        totalWarnings: result.totalWarnings,
        duration: result.duration,
      }, null, 2));
    } else {
      printCheckResult(result);
    }
    
    process.exit(result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Gen Command (Code Generation)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('gen <target> <file>')
  .description(`Generate code from ISL spec\n  Targets: ${VALID_TARGETS.join(', ')}`)
  .option('-o, --output <dir>', 'Output directory')
  .option('--force', 'Overwrite existing files')
  .action(async (target: string, file: string, options) => {
    const opts = program.opts();
    const result = await gen(target, file, {
      output: options.output,
      force: options.force,
      verbose: opts.verbose,
      format: opts.format,
    });
    
    printGenResult(result, { format: opts.format });
    process.exit(getGenExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Generate Command (Legacy - types/tests/docs)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('generate [files...]')
  .description('Generate types, tests, and documentation from ISL files')
  .option('-t, --types', 'Generate TypeScript types')
  .option('-T, --tests', 'Generate test files')
  .option('-d, --docs', 'Generate documentation')
  .option('-o, --output <dir>', 'Output directory')
  .option('-w, --watch', 'Watch for changes')
  .option('--force', 'Overwrite existing files')
  .action(async (files: string[], options) => {
    const opts = program.opts();
    const hasSpecificFlag = options.types || options.tests || options.docs;
    
    const result = await generate(files, {
      types: hasSpecificFlag ? options.types : undefined,
      tests: hasSpecificFlag ? options.tests : undefined,
      docs: hasSpecificFlag ? options.docs : undefined,
      output: options.output,
      config: opts.config,
      watch: options.watch,
      force: options.force,
      verbose: opts.verbose,
    });
    
    if (opts.format === 'json') {
      console.log(JSON.stringify({
        success: result.success,
        files: result.files.map(f => ({ path: f.path, type: f.type })),
        errors: result.errors,
        duration: result.duration,
      }, null, 2));
    } else {
      printGenerateResult(result);
    }
    
    process.exit(result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Verify Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('verify <spec>')
  .description('Verify an implementation against an ISL specification')
  .option('-i, --impl <file>', 'Implementation file to verify')
  .option('--proof <bundleDir>', 'Verify using proof bundle (instead of --impl)')
  .option('-t, --timeout <ms>', 'Test timeout in milliseconds', '30000')
  .option('-s, --min-score <score>', 'Minimum trust score to pass', '70')
  .option('-d, --detailed', 'Show detailed breakdown')
  .option('--smt', 'Enable SMT verification for preconditions/postconditions')
  .option('--smt-timeout <ms>', 'SMT solver timeout in milliseconds', '5000')
  .option('--pbt', 'Enable property-based testing')
  .option('--pbt-tests <num>', 'Number of PBT test iterations', '100')
  .option('--pbt-seed <seed>', 'PBT random seed for reproducibility')
  .option('--pbt-max-shrinks <num>', 'Maximum PBT shrinking iterations', '100')
  .option('--temporal', 'Enable temporal verification (latency SLAs, eventually within)')
  .option('--temporal-min-samples <num>', 'Minimum samples for temporal verification', '10')
  .option('--chaos', 'Enable chaos verification (fault injection)')
  .option('--all', 'Enable all verification modes (SMT + PBT + Temporal + Chaos)')
  .option('-r, --report <path>', 'Write evidence report to file')
  .action(async (spec: string, options) => {
    const opts = program.opts();
    
    // Handle proof bundle verification
    if (options.proof) {
      try {
        const { verifyProof, formatProofVerificationResult } = await import('@isl-lang/proof');
        const result = await verifyProof(options.proof, {
          bundleDir: options.proof,
          verbose: opts.verbose,
          format: opts.format === 'json' ? 'json' : 'pretty',
        });
        
        const output = formatProofVerificationResult(result, {
          format: opts.format === 'json' ? 'json' : 'pretty',
        });
        console.log(output);
        
        process.exit(result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
        return;
      } catch (error) {
        console.error(chalk.red(`Error verifying proof bundle: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(ExitCode.ISL_ERROR);
        return;
      }
    }
    
    // Regular verification (requires --impl)
    if (!options.impl) {
      console.error(chalk.red('Error: --impl is required when not using --proof'));
      process.exit(ExitCode.USAGE_ERROR);
      return;
    }
    
    // --all enables everything
    const enableAll = options.all;

    const result = await verify(spec, {
      impl: options.impl,
      timeout: parseInt(options.timeout),
      minScore: parseInt(options.minScore),
      detailed: options.detailed,
      report: options.report,
      format: opts.format === 'json' ? 'json' : 'text',
      verbose: opts.verbose,
      smt: enableAll || options.smt,
      smtTimeout: options.smtTimeout ? parseInt(options.smtTimeout) : undefined,
      pbt: enableAll || options.pbt,
      pbtTests: options.pbtTests ? parseInt(options.pbtTests) : undefined,
      pbtSeed: options.pbtSeed ? parseInt(options.pbtSeed) : undefined,
      pbtMaxShrinks: options.pbtMaxShrinks ? parseInt(options.pbtMaxShrinks) : undefined,
      temporal: enableAll || options.temporal,
      temporalMinSamples: options.temporalMinSamples ? parseInt(options.temporalMinSamples) : undefined,
    });
    
    printVerifyResult(result, {
      detailed: options.detailed,
      format: opts.format === 'json' ? 'json' : 'text',
    });
    
    process.exit(result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Init Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('init [name]')
  .description('Initialize a new ISL project')
  .option('-t, --template <template>', 'Project template (minimal, full, api)', 'minimal')
  .option('-d, --directory <dir>', 'Target directory')
  .option('--force', 'Overwrite existing directory')
  .option('--no-git', 'Skip git initialization')
  .option('-e, --examples', 'Include example files')
  .action(async (name: string | undefined, options) => {
    const opts = program.opts();
    const projectName = name ?? 'my-isl-project';
    
    const result = await init(projectName, {
      template: options.template as 'minimal' | 'full' | 'api',
      directory: options.directory,
      force: options.force,
      skipGit: !options.git,
      examples: options.examples,
    });
    
    if (opts.format === 'json') {
      console.log(JSON.stringify({
        success: result.success,
        projectPath: result.projectPath,
        files: result.files,
        errors: result.errors,
      }, null, 2));
    } else {
      printInitResult(result);
    }
    
    process.exit(result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
  });

// ─────────────────────────────────────────────────────────────────────────────
// REPL Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('repl')
  .description('Start interactive REPL')
  .action(async () => {
    const opts = program.opts();
    await repl({ verbose: opts.verbose });
  });

// ─────────────────────────────────────────────────────────────────────────────
// Fmt Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('fmt <file>')
  .description('Format an ISL file')
  .option('--check', 'Check formatting without writing')
  .option('--no-write', 'Print formatted output instead of writing')
  .action(async (file: string, options) => {
    const opts = program.opts();
    const result = await fmt(file, {
      write: options.write,
      check: options.check,
      verbose: opts.verbose,
      format: opts.format,
    });
    
    printFmtResult(result, { verbose: opts.verbose, format: opts.format });
    process.exit(getFmtExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Lint Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('lint <file>')
  .description('Lint an ISL file for best practices')
  .option('--strict', 'Treat warnings as errors')
  .action(async (file: string, options) => {
    const opts = program.opts();
    const result = await lint(file, {
      verbose: opts.verbose,
      format: opts.format,
      strict: options.strict,
    });
    
    printLintResult(result, { verbose: opts.verbose, format: opts.format });
    process.exit(getLintExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Build Command (Full Pipeline via Build Runner)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('build <pattern>')
  .description('Full ISL build pipeline: parse → check → codegen → testgen → verify → evidence\n  Supports glob patterns: specs/**/*.isl')
  .option('-o, --output <dir>', 'Output directory', './generated')
  .option('-t, --target <target>', 'Code generation target (typescript)', 'typescript')
  .option('--test-framework <framework>', 'Test framework (vitest, jest)', 'vitest')
  .option('--no-verify', 'Skip verification stage')
  .option('--no-html', 'Skip HTML report generation')
  .option('--no-chaos', 'Skip chaos test generation')
  .option('--no-helpers', 'Skip helper file generation')
  .action(async (pattern: string, options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';
    
    // Resolve pattern to files
    const { glob } = await import('glob');
    const specFiles = await glob(pattern, { ignore: ['node_modules/**', '.git/**'] });
    
    if (specFiles.length === 0) {
      const error = `No ISL files found matching pattern: ${pattern}`;
      if (!isJson) {
        console.error(chalk.red(`Error: ${error}`));
        console.log(chalk.gray('Try: isl build specs/**/*.isl'));
      } else {
        console.log(JSON.stringify({ success: false, error }, null, 2));
      }
      process.exit(ExitCode.USAGE_ERROR);
      return;
    }
    
    // Dynamically import build-runner to avoid startup cost when not used
    let buildRunner: typeof import('@isl-lang/build-runner');
    try {
      buildRunner = await import('@isl-lang/build-runner');
    } catch (error) {
      if (!isJson) {
        console.error(chalk.red('Error: Build runner not available'));
        console.log(chalk.gray('Install with: pnpm add @isl-lang/build-runner'));
      } else {
        console.log(JSON.stringify({ success: false, error: 'Build runner not available' }, null, 2));
      }
      process.exit(ExitCode.ISL_ERROR);
      return;
    }
    
    if (!isJson) {
      console.log('');
      console.log(chalk.bold.cyan('🔧 ISL Build Pipeline'));
      console.log(chalk.gray(`  Pattern: ${pattern}`));
      console.log(chalk.gray(`  Files: ${specFiles.length}`));
      console.log(chalk.gray(`  Output: ${options.output}`));
      console.log('');
    }

    // Build each spec file
    const results = [];
    let allSuccess = true;
    
    for (const spec of specFiles) {
      try {
        if (!isJson && specFiles.length > 1) {
          console.log(chalk.gray(`Building ${spec}...`));
        }
        
        const result = await buildRunner.run({
          specPath: spec,
          outDir: options.output,
          target: options.target as 'typescript',
          testFramework: options.testFramework as 'vitest' | 'jest',
          verify: options.verify,
          htmlReport: options.html,
          includeChaosTests: options.chaos,
          includeHelpers: options.helpers,
        });
        
        results.push({ spec, result });
        if (!result.success) {
          allSuccess = false;
        }
      } catch (error) {
        allSuccess = false;
        const message = error instanceof Error ? error.message : String(error);
        results.push({ spec, result: { success: false, errors: [{ message, stage: 'build' }] } });
      }
    }

    // Aggregate results
    if (specFiles.length === 1) {
      const { result } = results[0]!;

      if (!result.success) {
        if (!isJson) {
          console.log(chalk.red('✗ Build failed'));
          console.log('');
          for (const error of result.errors) {
            const location = error.file ? `${error.file}${error.line ? `:${error.line}` : ''}` : '';
            console.log(chalk.red(`  [${error.stage}] ${error.message}${location ? ` at ${location}` : ''}`));
          }
        } else {
          console.log(JSON.stringify({
            success: false,
            errors: result.errors,
            timing: result.timing,
          }, null, 2));
        }
        process.exit(ExitCode.ISL_ERROR);
        return;
      }

      if (!isJson) {
        console.log(chalk.bold.green('✓ Build complete!'));
        console.log('');
        
        // Show summary
        console.log(chalk.gray(`  Files generated: ${result.files.length}`));
        console.log(chalk.gray(`  Output directory: ${result.outDir}`));
        
        if (result.evidence) {
          const { summary } = result.evidence;
          const verdictColor = summary.verdict === 'verified' ? chalk.green : 
                              summary.verdict === 'risky' ? chalk.yellow : chalk.red;
          console.log('');
          console.log(chalk.bold('  Verification:'));
          console.log(`    Score: ${verdictColor(`${summary.overallScore}/100`)}`);
          console.log(`    Verdict: ${verdictColor(summary.verdict.toUpperCase())}`);
          console.log(`    Behaviors: ${summary.passedBehaviors}/${summary.totalBehaviors} passed`);
          console.log(`    Checks: ${summary.passedChecks}/${summary.totalChecks} passed`);
        }
        
        console.log('');
        console.log(chalk.gray(`  Total time: ${result.timing.total.toFixed(0)}ms`));
        console.log('');
        
        // Show file breakdown
        const counts = result.manifest.counts;
        console.log(chalk.gray('  Output breakdown:'));
        if (counts.types > 0) console.log(chalk.gray(`    Types: ${counts.types} files`));
        if (counts.test > 0) console.log(chalk.gray(`    Tests: ${counts.test} files`));
        if (counts.helper > 0) console.log(chalk.gray(`    Helpers: ${counts.helper} files`));
        if (counts.evidence > 0) console.log(chalk.gray(`    Evidence: ${counts.evidence} files`));
        if (counts.report > 0) console.log(chalk.gray(`    Reports: ${counts.report} files`));
        console.log('');
      } else {
        console.log(JSON.stringify({
          success: true,
          files: result.files.length,
          outDir: result.outDir,
          evidence: result.evidence ? {
            verdict: result.evidence.summary.verdict,
            score: result.evidence.summary.overallScore,
            behaviors: {
              total: result.evidence.summary.totalBehaviors,
              passed: result.evidence.summary.passedBehaviors,
            },
            checks: {
              total: result.evidence.summary.totalChecks,
              passed: result.evidence.summary.passedChecks,
            },
          } : null,
          timing: result.timing,
          manifest: result.manifest.counts,
        }, null, 2));
      }

      process.exit(ExitCode.SUCCESS);
    } else {
      // Multiple files - show summary
      if (!isJson) {
        const successCount = results.filter(r => r.result.success).length;
        console.log('');
        console.log(chalk.bold(allSuccess ? '✓ All builds complete!' : '✗ Some builds failed'));
        console.log(chalk.gray(`  Success: ${successCount}/${specFiles.length}`));
        console.log('');
        
        for (const { spec, result } of results) {
          if (!result.success) {
            console.log(chalk.red(`  ✗ ${spec}`));
            for (const error of result.errors || []) {
              const location = error.file ? `${error.file}${error.line ? `:${error.line}` : ''}` : '';
              console.log(chalk.red(`    [${error.stage}] ${error.message}${location ? ` at ${location}` : ''}`));
            }
          } else {
            console.log(chalk.green(`  ✓ ${spec}`));
          }
        }
        console.log('');
      } else {
        console.log(JSON.stringify({
          success: allSuccess,
          results: results.map(({ spec, result }) => ({
            spec,
            success: result.success,
            files: result.files?.length || 0,
            errors: result.errors || [],
          })),
        }, null, 2));
      }
      
      process.exit(allSuccess ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Vibecheck Command (Integration - defensive loading)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('vibecheck <subcommand> [args...]')
  .description('Vibecheck integration commands (verify, report)')
  .option('-s, --spec <file>', 'ISL specification file')
  .option('-i, --impl <file>', 'Implementation file to verify')
  .option('-m, --mode <mode>', 'Verification mode (quick, full, strict)', 'full')
  .option('--json', 'Output as JSON')
  .action(async (subcommand: string, args: string[], options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json' || options.json;
    
    // Check if vibecheck is available
    const available = await loadVibecheck();
    
    if (!available || !vibecheckModule) {
      if (isJson) {
        console.log(JSON.stringify({
          success: false,
          error: 'Vibecheck module is not installed',
          hint: 'Install with: npm install @isl-lang/vibecheck',
        }, null, 2));
      } else {
        console.error(chalk.red('Error: Vibecheck module is not installed'));
        console.log('');
        console.log(chalk.gray('Vibecheck provides AI-powered verification and evidence collection.'));
        console.log(chalk.gray('Install with: npm install @isl-lang/vibecheck'));
      }
      process.exit(ExitCode.USAGE_ERROR);
      return;
    }
    
    switch (subcommand) {
      case 'verify': {
        const specFile = options.spec || args[0];
        if (!specFile) {
          if (isJson) {
            console.log(JSON.stringify({ success: false, error: 'Missing spec file' }, null, 2));
          } else {
            console.error(chalk.red('Error: Missing spec file'));
            console.log(chalk.gray('Usage: isl vibecheck verify --spec <file> --impl <file>'));
          }
          process.exit(ExitCode.USAGE_ERROR);
          return;
        }
        
        if (!isJson) {
          console.log('');
          console.log(chalk.bold.cyan('🔍 Vibecheck Verify'));
          console.log('');
          console.log(chalk.gray(`Spec: ${specFile}`));
          if (options.impl) console.log(chalk.gray(`Impl: ${options.impl}`));
          console.log('');
        }
        
        try {
          const result = await vibecheckModule.runVibecheck({
            spec: specFile,
            impl: options.impl,
            mode: options.mode,
            verbose: opts.verbose,
          });
          
          if (isJson) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            if (result.success) {
              console.log(chalk.green(`✓ Verification passed`));
              if (result.score !== undefined) {
                console.log(chalk.gray(`  Score: ${result.score}%`));
              }
            } else {
              console.log(chalk.red(`✗ Verification failed`));
              if (result.error) {
                console.log(chalk.gray(`  Error: ${result.error}`));
              }
            }
          }
          
          process.exit(result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (isJson) {
            console.log(JSON.stringify({ success: false, error: message }, null, 2));
          } else {
            console.error(chalk.red(`Vibecheck error: ${message}`));
          }
          process.exit(ExitCode.ISL_ERROR);
        }
        break;
      }
      
      case 'report': {
        if (isJson) {
          console.log(JSON.stringify({
            success: false,
            error: 'Report subcommand not yet implemented',
            hint: 'Use "isl vibecheck verify" to generate a verification report',
          }, null, 2));
        } else {
          console.log(chalk.yellow('Report subcommand coming soon...'));
          console.log(chalk.gray('For now, use: isl vibecheck verify --spec <file>'));
        }
        process.exit(ExitCode.SUCCESS);
        break;
      }
      
      default: {
        if (isJson) {
          console.log(JSON.stringify({
            success: false,
            error: `Unknown vibecheck subcommand: ${subcommand}`,
            availableCommands: ['verify', 'report'],
          }, null, 2));
        } else {
          console.error(chalk.red(`Unknown vibecheck subcommand: ${subcommand}`));
          console.log('');
          console.log(chalk.gray('Available subcommands:'));
          console.log(chalk.gray('  verify   Run verification against an ISL spec'));
          console.log(chalk.gray('  report   Generate verification report'));
        }
        process.exit(ExitCode.USAGE_ERROR);
      }
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Policy Bundle Commands
// ─────────────────────────────────────────────────────────────────────────────

const policyCommand = program
  .command('policy')
  .description('Policy pack and bundle management');

const bundleCommand = policyCommand
  .command('bundle')
  .description('Policy bundle operations');

bundleCommand
  .command('create')
  .description('Create a policy bundle from current pack registry')
  .option('-o, --output <file>', 'Output bundle file path (default: stdout)')
  .option('-d, --description <text>', 'Bundle description')
  .option('--min-severity <level>', 'Minimum severity to include (error, warning, info)', 'error')
  .option('-c, --config <file>', 'Pack configuration file (JSON)')
  .action(async (options) => {
    const opts = program.opts();
    const result = await createPolicyBundle({
      output: options.output,
      description: options.description,
      minSeverity: options.minSeverity as 'error' | 'warning' | 'info',
      config: options.config,
      verbose: opts.verbose,
    });
    
    printCreateBundleResult(result, { verbose: opts.verbose });
    process.exit(getCreateBundleExitCode(result));
  });

bundleCommand
  .command('verify <bundle>')
  .description('Verify a policy bundle against current packs')
  .option('--no-compatibility', 'Skip compatibility checks')
  .action(async (bundle: string, options) => {
    const opts = program.opts();
    const result = await verifyPolicyBundle({
      bundle,
      checkCompatibility: options.compatibility !== false,
      verbose: opts.verbose,
    });
    
    printVerifyBundleResult(result, { verbose: opts.verbose });
    process.exit(getVerifyBundleExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Gate Command (SHIP/NO-SHIP)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('gate <spec>')
  .description('SHIP/NO-SHIP gate for AI-generated code. Verifies implementation against spec and returns a decision with evidence bundle.')
  .requiredOption('-i, --impl <file>', 'Implementation file or directory to verify')
  .option('-t, --threshold <score>', 'Minimum trust score to SHIP (default: 95)', '95')
  .option('-o, --output <dir>', 'Output directory for evidence bundle')
  .option('--ci', 'CI mode: minimal output, just the decision')
  .action(async (spec: string, options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';
    const isCi = options.ci || isCI();
    
    if (!isCi && !isJson) {
      console.log('');
      console.log(chalk.bold.cyan('🚦 ISL Gate'));
      console.log(chalk.gray(`   Spec: ${spec}`));
      console.log(chalk.gray(`   Impl: ${options.impl}`));
      console.log(chalk.gray(`   Threshold: ${options.threshold}%`));
      console.log('');
    }

    const result = await gate(spec, {
      impl: options.impl,
      threshold: parseInt(options.threshold),
      output: options.output ?? process.cwd(),
      verbose: opts.verbose,
      format: opts.format,
      ci: isCi,
    });

    printGateResult(result, {
      format: isJson ? 'json' : 'pretty',
      verbose: opts.verbose,
      ci: isCi,
    });

    process.exit(getGateExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Gate Trust-Score Subcommand
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('gate:trust-score <spec>')
  .alias('trust-score')
  .description('Compute a defensible 0-100 trust score from ISL verification results with per-category breakdown, history tracking, and gate enforcement.')
  .requiredOption('-i, --impl <file>', 'Implementation file or directory to verify')
  .option('-t, --threshold <score>', 'Minimum trust score to SHIP (default: 80)', '80')
  .option('-w, --weights <weights>', 'Custom weights (e.g. "preconditions=30,postconditions=25,invariants=20,temporal=10,chaos=5,coverage=10")')
  .option('--unknown-penalty <penalty>', 'Penalty for unknown/uncovered categories 0.0-1.0 (default: 0.5)', '0.5')
  .option('--history', 'Show trust score history instead of running evaluation')
  .option('--history-path <path>', 'Custom history file path (default: .isl-gate/trust-history.json)')
  .option('--commit-hash <hash>', 'Git commit hash to tag this evaluation')
  .option('--no-persist', 'Do not persist results to history')
  .option('--json', 'Output as JSON')
  .option('--ci', 'CI mode: minimal output')
  .action(async (spec: string, options) => {
    const opts = program.opts();
    const isJson = options.json || opts.format === 'json';
    const isCi = options.ci || isCI();

    // History mode
    if (options.history) {
      await printTrustScoreHistory(options.historyPath);
      process.exit(0);
    }

    if (!isCi && !isJson) {
      console.log('');
      console.log(chalk.bold.cyan('  Trust Score Engine'));
      console.log(chalk.gray(`  Spec:      ${spec}`));
      console.log(chalk.gray(`  Impl:      ${options.impl}`));
      console.log(chalk.gray(`  Threshold: ${options.threshold}`));
      if (options.weights) {
        console.log(chalk.gray(`  Weights:   ${options.weights}`));
      }
      console.log(chalk.gray(`  Unknown:   ${options.unknownPenalty} penalty`));
      console.log('');
    }

    const result = await trustScore(spec, {
      impl: options.impl,
      threshold: parseInt(options.threshold),
      weights: options.weights,
      unknownPenalty: parseFloat(options.unknownPenalty),
      history: options.history,
      json: isJson,
      ci: isCi,
      verbose: opts.verbose,
      historyPath: options.historyPath,
      commitHash: options.commitHash,
      noPersist: options.persist === false,
    });

    printTrustScoreResult(result, {
      json: isJson,
      verbose: opts.verbose,
      ci: isCi,
    });

    process.exit(getTrustScoreExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Heal Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('heal <pattern>')
  .description('Automatically fix violations in code to pass the gate')
  .option('-s, --spec <file>', 'ISL spec file (auto-discovers if not provided)')
  .option('--max-iterations <n>', 'Maximum healing iterations (default: 8)', '8')
  .option('--stop-on-repeat <n>', 'Stop after N identical fingerprints (default: 2)', '2')
  .action(async (pattern: string, options) => {
    const opts = program.opts();
    const result = await heal(pattern, {
      spec: options.spec,
      maxIterations: parseInt(options.maxIterations),
      stopOnRepeat: parseInt(options.stopOnRepeat),
      format: opts.format,
      verbose: opts.verbose,
    });
    
    printHealResult(result, { format: opts.format });
    process.exit(getHealExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Proof Verify Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('proof verify <bundle-path>')
  .description('Verify a proof bundle is valid and check its integrity')
  .option('--sign-secret <secret>', 'Secret for signature verification')
  .option('--skip-file-check', 'Skip file completeness check')
  .option('--skip-signature-check', 'Skip signature verification')
  .action(async (bundlePath: string, options) => {
    const opts = program.opts();
    const result = await verifyProof(bundlePath, {
      signSecret: options.signSecret,
      skipFileCheck: options.skipFileCheck,
      skipSignatureCheck: options.skipSignatureCheck,
      format: opts.format,
      verbose: opts.verbose,
    });
    
    printProofVerifyResult(result, { format: opts.format });
    process.exit(getProofVerifyExitCode(result));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Watch Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('watch [files...]')
  .description('Watch ISL files and rerun parse/check + optionally gate on changes')
  .option('--gate', 'Run gate after check')
  .option('--heal', 'Run heal after check')
  .option('--changed-only', 'Only process changed files (not all files)')
  .option('-i, --impl <file>', 'Implementation path for gate (required if --gate)')
  .option('-t, --threshold <score>', 'Gate threshold (default: 95)', '95')
  .action(async (files: string[], options) => {
    const opts = program.opts();
    
    if (options.gate && !options.impl) {
      console.error(chalk.red('Error: --impl is required when using --gate'));
      process.exit(ExitCode.USAGE_ERROR);
      return;
    }

    const result = await watch(files, {
      gate: options.gate,
      heal: options.heal,
      changedOnly: options.changedOnly,
      impl: options.impl,
      threshold: parseInt(options.threshold),
      verbose: opts.verbose,
      quiet: opts.quiet || opts.format === 'quiet',
      debounceMs: 300,
    });

    if (!result.started) {
      console.error(chalk.red(`Failed to start watch: ${result.error ?? 'Unknown error'}`));
      process.exit(ExitCode.ISL_ERROR);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Unknown Command Handler
// ─────────────────────────────────────────────────────────────────────────────

program.on('command:*', ([cmd]) => {
  const suggestion = findClosestMatch(cmd, COMMANDS);
  
  console.error(chalk.red(`Unknown command: ${cmd}`));
  
  if (suggestion) {
    console.error(chalk.gray(`Did you mean: isl ${suggestion}?`));
  }
  
  console.error('');
  console.error(chalk.gray('Run `isl --help` to see available commands.'));
  process.exit(ExitCode.USAGE_ERROR);
});

// ─────────────────────────────────────────────────────────────────────────────
// Help Enhancement
// ─────────────────────────────────────────────────────────────────────────────

program.addHelpText('after', `
${chalk.bold('Examples:')}
  ${chalk.gray('# Initialize a new ISL project')}
  $ isl init

  ${chalk.gray('# Build ISL spec (parse → check → codegen → verify)')}
  $ isl build specs/**/*.isl

  ${chalk.gray('# Heal code to fix violations automatically')}
  $ isl heal src/**/*.ts

  ${chalk.gray('# Verify implementation against spec')}
  $ isl verify src/auth.isl --impl src/auth.ts

  ${chalk.gray('# Verify proof bundle')}
  $ isl proof verify ./proof-bundles/auth-bundle

  ${chalk.gray('# SHIP/NO-SHIP gate (the main workflow)')}
  $ isl gate src/auth.isl --impl src/auth.ts

  ${chalk.gray('# Parse and show AST')}
  $ isl parse src/auth.isl

  ${chalk.gray('# Check all ISL files')}
  $ isl check

  ${chalk.gray('# Generate TypeScript code')}
  $ isl gen ts src/auth.isl

  ${chalk.gray('# Format ISL file')}
  $ isl fmt src/auth.isl

  ${chalk.gray('# Start REPL')}
  $ isl repl

  ${chalk.gray('# Watch ISL files for changes')}
  $ isl watch

  ${chalk.gray('# Watch with gate on changes')}
  $ isl watch --gate --impl src/

  ${chalk.gray('# Watch only changed files')}
  $ isl watch --changed-only

${chalk.bold('JSON Output:')}
  All commands support --json or --format json for machine-readable output:
  $ isl build specs/**/*.isl --json
  $ isl heal src/**/*.ts --json
  $ isl verify src/auth.isl --impl src/auth.ts --json

${chalk.bold('Exit Codes:')}
  ${chalk.gray('0')}  Success (SHIP)
  ${chalk.gray('1')}  ISL errors (NO-SHIP, parse/type/verification failures)
  ${chalk.gray('2')}  Usage errors (bad flags, missing file)
  ${chalk.gray('3')}  Internal errors

${chalk.bold('Documentation:')}
  ${chalk.cyan('https://intentos.dev/docs/cli')}
`);

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling
// ─────────────────────────────────────────────────────────────────────────────

program.exitOverride((err: any) => {
  // Help and version display should exit with code 0
  if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
    process.exit(ExitCode.SUCCESS);
  }
  
  // Handle missing required arguments
  const errMessage = err.message || err.toString() || '';
  if (err.code === 'commander.missingArgument' || 
      errMessage.includes('missing required argument')) {
    // Error message already printed by Commander, just set exit code
    process.exit(ExitCode.USAGE_ERROR);
  }
  
  if (err.code === 'commander.unknownOption') {
    console.error(chalk.red(`Unknown option`));
    process.exit(ExitCode.USAGE_ERROR);
  }
  
  if (err.code === 'commander.invalidArgument') {
    console.error(chalk.red(`Invalid argument`));
    process.exit(ExitCode.USAGE_ERROR);
  }
  
  // For any other Commander errors, check message for usage errors
  if (errMessage.includes('missing required') ||
      errMessage.includes('unknown command') ||
      errMessage.includes('unknown option')) {
    process.exit(ExitCode.USAGE_ERROR);
  }
  
  throw err;
});

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export { program, VERSION };
export default program;
