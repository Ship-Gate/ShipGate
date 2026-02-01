/**
 * CLI Command Definitions
 * 
 * Defines all ISL CLI commands using commander.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { output } from './output.js';
import {
  check, printCheckResult,
  generate, printGenerateResult,
  verify, printVerifyResult,
  init, printInitResult,
} from './commands/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// CLI Setup
// ─────────────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('isl')
  .description(chalk.bold('Intent Specification Language CLI') + '\n' + 
    chalk.gray('The programming language for the AI era'))
  .version('0.1.0')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-q, --quiet', 'Suppress non-error output')
  .option('--no-color', 'Disable colored output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    output.configure({
      verbose: opts.verbose ?? false,
      quiet: opts.quiet ?? false,
      noColor: !opts.color,
    });
  });

// ─────────────────────────────────────────────────────────────────────────────
// Check Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('check [files...]')
  .description('Parse and type check ISL files')
  .option('-w, --watch', 'Watch for changes')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (files: string[], options) => {
    const result = await check(files, {
      verbose: program.opts().verbose,
      quiet: program.opts().quiet,
      watch: options.watch,
      config: options.config,
    });
    
    printCheckResult(result);
    process.exit(result.success ? 0 : 1);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Generate Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('generate [files...]')
  .description('Generate types, tests, and documentation from ISL files')
  .option('-t, --types', 'Generate TypeScript types')
  .option('-T, --tests', 'Generate test files')
  .option('-d, --docs', 'Generate documentation')
  .option('-o, --output <dir>', 'Output directory')
  .option('-c, --config <path>', 'Path to config file')
  .option('-w, --watch', 'Watch for changes')
  .option('-f, --force', 'Overwrite existing files')
  .action(async (files: string[], options) => {
    // If no specific flag is set, use config defaults (all true)
    const hasSpecificFlag = options.types || options.tests || options.docs;
    
    const result = await generate(files, {
      types: hasSpecificFlag ? options.types : undefined,
      tests: hasSpecificFlag ? options.tests : undefined,
      docs: hasSpecificFlag ? options.docs : undefined,
      output: options.output,
      config: options.config,
      watch: options.watch,
      force: options.force,
      verbose: program.opts().verbose,
    });
    
    printGenerateResult(result);
    process.exit(result.success ? 0 : 1);
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
  .option('-f, --format <format>', 'Output format (text, json)', 'text')
  .action(async (spec: string, options) => {
    const result = await verify(spec, {
      impl: options.impl,
      timeout: parseInt(options.timeout),
      minScore: parseInt(options.minScore),
      detailed: options.detailed,
      format: options.format,
      verbose: program.opts().verbose,
    });
    
    printVerifyResult(result, {
      detailed: options.detailed,
      format: options.format,
    });
    process.exit(result.success ? 0 : 1);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Init Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('init <name>')
  .description('Initialize a new ISL project')
  .option('-t, --template <template>', 'Project template (minimal, full, api)', 'minimal')
  .option('-d, --directory <dir>', 'Target directory')
  .option('-f, --force', 'Overwrite existing directory')
  .option('--no-git', 'Skip git initialization')
  .option('-e, --examples', 'Include example files')
  .action(async (name: string, options) => {
    const result = await init(name, {
      template: options.template as 'minimal' | 'full' | 'api',
      directory: options.directory,
      force: options.force,
      skipGit: !options.git,
      examples: options.examples,
    });
    
    printInitResult(result);
    process.exit(result.success ? 0 : 1);
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
    console.log('');
    console.log(chalk.bold.cyan('🔧 ISL Build Pipeline'));
    console.log('');

    // Step 1: Check
    console.log(chalk.cyan('Step 1/2:') + ' Checking ISL files...');
    const checkResult = await check(files, {
      verbose: program.opts().verbose,
      quiet: true,
    });
    
    if (!checkResult.success) {
      console.log(chalk.red('  ✗ Check failed'));
      printCheckResult(checkResult);
      process.exit(1);
    }
    console.log(chalk.green('  ✓ All files valid'));
    console.log('');

    // Step 2: Generate
    console.log(chalk.cyan('Step 2/2:') + ' Generating outputs...');
    const generateResult = await generate(files, {
      types: !options.skipTypes,
      tests: !options.skipTests,
      docs: !options.skipDocs,
      output: options.output,
      verbose: program.opts().verbose,
    });

    if (!generateResult.success) {
      console.log(chalk.red('  ✗ Generation failed'));
      printGenerateResult(generateResult);
      process.exit(1);
    }
    console.log(chalk.green('  ✓ Files generated'));
    console.log('');

    // Summary
    console.log(chalk.bold.green('✓ Build complete!'));
    console.log('');
    console.log(chalk.gray(`  Checked: ${checkResult.files.length} file${checkResult.files.length === 1 ? '' : 's'}`));
    console.log(chalk.gray(`  Generated: ${generateResult.files.length} file${generateResult.files.length === 1 ? '' : 's'}`));
    console.log('');
  });

// ─────────────────────────────────────────────────────────────────────────────
// REPL Command
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('repl')
  .description('Start interactive REPL for ISL')
  .option('--no-color', 'Disable colored output')
  .action(async (options) => {
    try {
      // Dynamic import to avoid loading REPL code unless needed
      const { startREPL } = await import('@isl-lang/repl');
      startREPL({
        colors: options.color !== false,
        verbose: program.opts().verbose,
      });
    } catch (error) {
      console.error(chalk.red('Failed to start REPL:'), error instanceof Error ? error.message : error);
      console.error(chalk.gray('Make sure @isl-lang/repl package is installed'));
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Help Enhancement
// ─────────────────────────────────────────────────────────────────────────────

program.addHelpText('after', `
${chalk.bold('Examples:')}
  ${chalk.gray('# Check all ISL files in the project')}
  $ isl check

  ${chalk.gray('# Check specific files')}
  $ isl check src/auth.isl src/users.isl

  ${chalk.gray('# Generate TypeScript types only')}
  $ isl generate --types

  ${chalk.gray('# Generate everything to custom directory')}
  $ isl generate --types --tests --docs -o ./output

  ${chalk.gray('# Verify implementation against spec')}
  $ isl verify src/auth.isl --impl dist/auth.js

  ${chalk.gray('# Initialize new project with API template')}
  $ isl init my-api --template api

  ${chalk.gray('# Full build pipeline')}
  $ isl build

  ${chalk.gray('# Start interactive REPL')}
  $ isl repl

${chalk.bold('Documentation:')}
  ${chalk.cyan('https://intentos.dev/docs/cli')}
`);

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export { program };
export default program;
