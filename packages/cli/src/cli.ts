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
} from './commands/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Version
// ─────────────────────────────────────────────────────────────────────────────

const VERSION = '0.1.0';

// ─────────────────────────────────────────────────────────────────────────────
// Available Commands (for suggestions)
// ─────────────────────────────────────────────────────────────────────────────

const COMMANDS = [
  'parse', 'check', 'gen', 'verify', 'repl', 'init', 'fmt', 'lint',
  'generate', 'build', // aliases
  'gate', // SHIP/NO-SHIP gate
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
  .action(async (files: string[], options) => {
    const opts = program.opts();
    const result = await check(files, {
      verbose: opts.verbose,
      quiet: opts.format === 'quiet',
      watch: options.watch,
      config: opts.config,
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
  .requiredOption('-i, --impl <file>', 'Implementation file to verify')
  .option('-t, --timeout <ms>', 'Test timeout in milliseconds', '30000')
  .option('-s, --min-score <score>', 'Minimum trust score to pass', '70')
  .option('-d, --detailed', 'Show detailed breakdown')
  .action(async (spec: string, options) => {
    const opts = program.opts();
    const result = await verify(spec, {
      impl: options.impl,
      timeout: parseInt(options.timeout),
      minScore: parseInt(options.minScore),
      detailed: options.detailed,
      format: opts.format === 'json' ? 'json' : 'text',
      verbose: opts.verbose,
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
  .command('build <spec>')
  .description('Full ISL build pipeline: parse → check → codegen → testgen → verify → evidence')
  .option('-o, --output <dir>', 'Output directory', './generated')
  .option('-t, --target <target>', 'Code generation target (typescript)', 'typescript')
  .option('--test-framework <framework>', 'Test framework (vitest, jest)', 'vitest')
  .option('--no-verify', 'Skip verification stage')
  .option('--no-html', 'Skip HTML report generation')
  .option('--no-chaos', 'Skip chaos test generation')
  .option('--no-helpers', 'Skip helper file generation')
  .action(async (spec: string, options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';
    
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
      console.log(chalk.gray(`  Spec: ${spec}`));
      console.log(chalk.gray(`  Output: ${options.output}`));
      console.log('');
    }

    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isJson) {
        console.error(chalk.red(`Build error: ${message}`));
      } else {
        console.log(JSON.stringify({ success: false, error: message }, null, 2));
      }
      process.exit(ExitCode.ISL_ERROR);
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
// Unknown Command Handler
// ─────────────────────────────────────────────────────────────────────────────

program.on('command:*', ([cmd]) => {
  console.error(chalk.red(`Unknown command: ${cmd}`));
  
  const suggestion = findClosestMatch(cmd, COMMANDS);
  if (suggestion) {
    console.log(chalk.gray(`Did you mean: isl ${suggestion}?`));
  }
  
  console.log('');
  console.log(chalk.gray('Run `isl --help` to see available commands.'));
  process.exit(ExitCode.USAGE_ERROR);
});

// ─────────────────────────────────────────────────────────────────────────────
// Help Enhancement
// ─────────────────────────────────────────────────────────────────────────────

program.addHelpText('after', `
${chalk.bold('Examples:')}
  ${chalk.gray('# SHIP/NO-SHIP gate (the main workflow)')}
  $ isl gate src/auth.isl --impl src/auth.ts

  ${chalk.gray('# Gate with custom threshold')}
  $ isl gate src/auth.isl --impl src/ --threshold 90

  ${chalk.gray('# Gate in CI mode (minimal output)')}
  $ isl gate src/auth.isl --impl src/ --ci

  ${chalk.gray('# Parse and show AST')}
  $ isl parse src/auth.isl

  ${chalk.gray('# Check all ISL files')}
  $ isl check

  ${chalk.gray('# Generate TypeScript code')}
  $ isl gen ts src/auth.isl

  ${chalk.gray('# Verify implementation')}
  $ isl verify src/auth.isl --impl dist/auth.js

  ${chalk.gray('# Format ISL file')}
  $ isl fmt src/auth.isl

  ${chalk.gray('# Start REPL')}
  $ isl repl

  ${chalk.gray('# Initialize new project')}
  $ isl init my-api --template api

${chalk.bold('Exit Codes:')}
  ${chalk.gray('0')}  SHIP (or success)
  ${chalk.gray('1')}  NO-SHIP (or ISL errors)
  ${chalk.gray('2')}  Usage errors (bad flags, missing file)
  ${chalk.gray('3')}  Internal errors

${chalk.bold('Documentation:')}
  ${chalk.cyan('https://intentos.dev/docs/cli')}
`);

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling
// ─────────────────────────────────────────────────────────────────────────────

program.exitOverride((err) => {
  if (err.code === 'commander.missingArgument') {
    console.error(chalk.red(`Missing required argument`));
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
  throw err;
});

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export { program, VERSION };
export default program;
