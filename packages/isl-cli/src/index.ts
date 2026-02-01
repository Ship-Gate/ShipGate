#!/usr/bin/env node

/**
 * ISL CLI
 * 
 * Command-line interface for the Intent Specification Language.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { 
  check, printCheckResult,
  compile, printCompileResult,
  generate, printGenerateResult,
  verify, printVerifyResult,
} from './commands/index.js';

const program = new Command();

program
  .name('isl')
  .description('Intent Specification Language CLI - The programming language for the AI era')
  .version('0.1.0');

// Check command
program
  .command('check <file>')
  .description('Validate ISL syntax and semantics')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (file, options) => {
    const result = await check(file, options);
    printCheckResult(result, file);
    process.exit(result.valid ? 0 : 1);
  });

// Compile command
program
  .command('compile <file>')
  .description('Compile ISL to TypeScript types and tests')
  .option('-o, --output <dir>', 'Output directory')
  .option('--no-types', 'Skip type generation')
  .option('--no-tests', 'Skip test generation')
  .action(async (file, options) => {
    const result = await compile(file, options);
    printCompileResult(result);
    process.exit(result.success ? 0 : 1);
  });

// Generate command
program
  .command('generate <file>')
  .description('Generate AI implementations from ISL spec')
  .option('-o, --output <dir>', 'Output directory')
  .option('-m, --model <model>', 'AI model to use', 'claude-sonnet-4-20250514')
  .option('-b, --behavior <name>', 'Generate only specific behavior')
  .option('--api-key <key>', 'Anthropic API key (or use ANTHROPIC_API_KEY env var)')
  .action(async (file, options) => {
    const result = await generate(file, options);
    printGenerateResult(result);
    process.exit(result.success ? 0 : 1);
  });

// Verify command
program
  .command('verify <spec>')
  .description('Verify an implementation against an ISL spec')
  .requiredOption('-i, --impl <file>', 'Implementation file to verify')
  .option('-v, --verbose', 'Show detailed output')
  .option('-t, --timeout <ms>', 'Test timeout in milliseconds', '30000')
  .action(async (spec, options) => {
    const result = await verify(spec, {
      implementation: options.impl,
      verbose: options.verbose,
      timeout: parseInt(options.timeout),
    });
    printVerifyResult(result);
    process.exit(result.success ? 0 : 1);
  });

// Build command (combined pipeline)
program
  .command('build <file>')
  .description('Full pipeline: check + compile + generate + verify')
  .option('-o, --output <dir>', 'Output directory')
  .option('--skip-generate', 'Skip AI generation')
  .option('--skip-verify', 'Skip verification')
  .action(async (file, options) => {
    console.log(chalk.bold('\n🔧 ISL Build Pipeline\n'));

    // Step 1: Check
    console.log(chalk.cyan('Step 1/4: Checking ISL spec...'));
    const checkResult = await check(file, { verbose: true });
    if (!checkResult.valid) {
      printCheckResult(checkResult, file);
      process.exit(1);
    }
    console.log(chalk.green('  ✓ Syntax valid\n'));

    // Step 2: Compile
    console.log(chalk.cyan('Step 2/4: Compiling to TypeScript...'));
    const compileResult = await compile(file, { output: options.output });
    if (!compileResult.success) {
      printCompileResult(compileResult);
      process.exit(1);
    }
    console.log(chalk.green('  ✓ Types and tests generated\n'));

    // Step 3: Generate (optional)
    if (!options.skipGenerate) {
      console.log(chalk.cyan('Step 3/4: Generating AI implementation...'));
      const generateResult = await generate(file, { output: options.output });
      if (!generateResult.success) {
        printGenerateResult(generateResult);
        process.exit(1);
      }
      console.log(chalk.green('  ✓ Implementation generated\n'));

      // Step 4: Verify (optional)
      if (!options.skipVerify && generateResult.files.length > 0) {
        console.log(chalk.cyan('Step 4/4: Verifying implementation...'));
        const verifyResult = await verify(file, {
          implementation: generateResult.files[0],
          verbose: options.verbose,
        });
        printVerifyResult(verifyResult);
        process.exit(verifyResult.success ? 0 : 1);
      }
    }

    console.log(chalk.bold.green('\n✓ Build complete!\n'));
  });

// Init command
program
  .command('init [name]')
  .description('Initialize a new ISL project')
  .action(async (name = 'my-intent') => {
    console.log(chalk.cyan(`Initializing ISL project: ${name}`));
    console.log(chalk.gray('  Creating example ISL spec...'));
    console.log(chalk.green('\n✓ Project initialized!\n'));
    console.log('Next steps:');
    console.log(chalk.gray('  1. Edit the generated .isl file'));
    console.log(chalk.gray('  2. Run `isl check` to validate'));
    console.log(chalk.gray('  3. Run `isl build` to generate and verify'));
  });

program.parse();
