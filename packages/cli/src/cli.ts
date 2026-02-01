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
];

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
// Build Command (Combined Pipeline)
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('build [files...]')
  .description('Full pipeline: check + generate')
  .option('-o, --output <dir>', 'Output directory')
  .option('--skip-types', 'Skip type generation')
  .option('--skip-tests', 'Skip test generation')
  .option('--skip-docs', 'Skip documentation generation')
  .action(async (files: string[], options) => {
    const opts = program.opts();
    const isJson = opts.format === 'json';
    
    if (!isJson) {
      console.log('');
      console.log(chalk.bold.cyan('🔧 ISL Build Pipeline'));
      console.log('');
    }

    // Step 1: Check
    if (!isJson) console.log(chalk.cyan('Step 1/2:') + ' Checking ISL files...');
    const checkResult = await check(files, {
      verbose: opts.verbose,
      quiet: true,
    });
    
    if (!checkResult.success) {
      if (!isJson) {
        console.log(chalk.red('  ✗ Check failed'));
        printCheckResult(checkResult);
      } else {
        console.log(JSON.stringify({ success: false, step: 'check', result: checkResult }, null, 2));
      }
      process.exit(ExitCode.ISL_ERROR);
    }
    if (!isJson) {
      console.log(chalk.green('  ✓ All files valid'));
      console.log('');
    }

    // Step 2: Generate
    if (!isJson) console.log(chalk.cyan('Step 2/2:') + ' Generating outputs...');
    const generateResult = await generate(files, {
      types: !options.skipTypes,
      tests: !options.skipTests,
      docs: !options.skipDocs,
      output: options.output,
      verbose: opts.verbose,
    });

    if (!generateResult.success) {
      if (!isJson) {
        console.log(chalk.red('  ✗ Generation failed'));
        printGenerateResult(generateResult);
      } else {
        console.log(JSON.stringify({ success: false, step: 'generate', result: generateResult }, null, 2));
      }
      process.exit(ExitCode.ISL_ERROR);
    }
    
    if (!isJson) {
      console.log(chalk.green('  ✓ Files generated'));
      console.log('');

      // Summary
      console.log(chalk.bold.green('✓ Build complete!'));
      console.log('');
      console.log(chalk.gray(`  Checked: ${checkResult.files.length} file${checkResult.files.length === 1 ? '' : 's'}`));
      console.log(chalk.gray(`  Generated: ${generateResult.files.length} file${generateResult.files.length === 1 ? '' : 's'}`));
      console.log('');
    } else {
      console.log(JSON.stringify({
        success: true,
        check: { files: checkResult.files.length, errors: checkResult.totalErrors },
        generate: { files: generateResult.files.length },
      }, null, 2));
    }
    
    process.exit(ExitCode.SUCCESS);
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
  ${chalk.gray('# Parse and show AST')}
  $ isl parse src/auth.isl

  ${chalk.gray('# Check all ISL files')}
  $ isl check

  ${chalk.gray('# Generate TypeScript code')}
  $ isl gen ts src/auth.isl

  ${chalk.gray('# Generate Rust code')}
  $ isl gen rust src/api.isl

  ${chalk.gray('# Verify implementation')}
  $ isl verify src/auth.isl --impl dist/auth.js

  ${chalk.gray('# Format ISL file')}
  $ isl fmt src/auth.isl

  ${chalk.gray('# Lint ISL file')}
  $ isl lint src/auth.isl

  ${chalk.gray('# Start REPL')}
  $ isl repl

  ${chalk.gray('# Initialize new project')}
  $ isl init my-api --template api

${chalk.bold('Exit Codes:')}
  ${chalk.gray('0')}  Success
  ${chalk.gray('1')}  ISL errors (parse, type check, verification)
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
