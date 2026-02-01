#!/usr/bin/env node
/**
 * Error Catalog CLI
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import { generateErrorCatalog } from './index.js';
import type { CatalogConfig } from './types.js';

const program = new Command();

program
  .name('error-catalog')
  .description('Generate error catalog from ISL definitions')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate error catalog')
  .requiredOption('-i, --input <glob>', 'Input glob pattern for ISL files')
  .option('-o, --output <dir>', 'Output directory', './error-catalog')
  .option('--markdown', 'Generate markdown documentation', true)
  .option('--json', 'Generate JSON catalog', true)
  .option('--typescript', 'Generate TypeScript classes', false)
  .option('--openapi', 'Generate OpenAPI schemas', false)
  .option('--website', 'Generate static website', false)
  .option('--split', 'Split markdown by domain', false)
  .option('--group-by <type>', 'Group errors by: domain, httpStatus, severity, tag', 'domain')
  .option('--sort-by <type>', 'Sort errors by: code, id, httpStatus, severity', 'code')
  .action(async (options) => {
    console.log(chalk.blue('🔧 Generating error catalog...'));

    try {
      const config: CatalogConfig = {
        inputGlob: options.input,
        groupBy: options.groupBy,
        sortBy: options.sortBy,
        outputs: {},
      };

      if (options.markdown) {
        config.outputs.markdown = {
          outputDir: path.join(options.output, 'docs'),
          splitByGroup: options.split,
          includeToc: true,
          includeExamples: true,
        };
      }

      if (options.json) {
        config.outputs.json = {
          outputFile: path.join(options.output, 'errors.json'),
          pretty: true,
        };
      }

      if (options.typescript) {
        config.outputs.typescript = {
          outputFile: path.join(options.output, 'errors.ts'),
          generateClasses: true,
          generateTypeGuards: true,
          generateFactories: true,
        };
      }

      if (options.openapi) {
        config.outputs.openapi = {
          outputFile: path.join(options.output, 'openapi-errors.yaml'),
          version: '3.1',
          includeSchemas: true,
          includeResponses: true,
        };
      }

      if (options.website) {
        config.outputs.website = {
          outputDir: path.join(options.output, 'website'),
          title: 'Error Reference',
          includeSearch: true,
          theme: 'auto',
        };
      }

      const outputs = await generateErrorCatalog(config);

      // Write outputs
      for (const output of outputs) {
        await fs.mkdir(path.dirname(output.path), { recursive: true });
        await fs.writeFile(output.path, output.content);
        console.log(chalk.green(`  ✓ ${output.path}`));
      }

      console.log(chalk.green(`\n✅ Generated ${outputs.length} files`));
    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error}`));
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate error definitions')
  .requiredOption('-i, --input <glob>', 'Input glob pattern for ISL files')
  .action(async (options) => {
    console.log(chalk.blue('🔍 Validating error definitions...'));

    try {
      const { ErrorExtractor } = await import('./extractor.js');
      const { ErrorCatalog } = await import('./catalog.js');

      const extractor = new ErrorExtractor();
      const result = await extractor.extractFromGlob(options.input);

      console.log(chalk.cyan(`\nProcessed ${result.sourceFiles.length} files`));
      console.log(chalk.cyan(`Found ${result.errors.length} errors`));

      if (result.warnings.length > 0) {
        console.log(chalk.yellow(`\n⚠️  ${result.warnings.length} warnings:`));
        for (const warning of result.warnings) {
          console.log(chalk.yellow(`  - ${warning.file}: ${warning.message}`));
        }
      }

      const catalog = new ErrorCatalog(result.errors);
      const validation = catalog.validate();

      if (!validation.valid) {
        console.log(chalk.red(`\n❌ Validation failed:`));
        for (const issue of validation.issues) {
          const icon = issue.type === 'error' ? '❌' : '⚠️';
          const color = issue.type === 'error' ? chalk.red : chalk.yellow;
          console.log(color(`  ${icon} ${issue.message}`));
        }
        process.exit(1);
      }

      console.log(chalk.green('\n✅ All validations passed'));
    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error}`));
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show error catalog statistics')
  .requiredOption('-i, --input <glob>', 'Input glob pattern for ISL files')
  .action(async (options) => {
    try {
      const { ErrorExtractor } = await import('./extractor.js');
      const { ErrorCatalog } = await import('./catalog.js');

      const extractor = new ErrorExtractor();
      const result = await extractor.extractFromGlob(options.input);
      const catalog = new ErrorCatalog(result.errors);
      const stats = catalog.getStats();

      console.log(chalk.blue('\n📊 Error Catalog Statistics\n'));
      console.log(`  Total Errors:    ${chalk.cyan(stats.totalErrors)}`);
      console.log(`  Retriable:       ${chalk.cyan(stats.retriableCount)}`);
      console.log(`  Deprecated:      ${chalk.cyan(stats.deprecatedCount)}`);

      console.log(chalk.blue('\n  By Domain:'));
      for (const [domain, count] of Object.entries(stats.byDomain)) {
        console.log(`    ${domain}: ${chalk.cyan(count)}`);
      }

      console.log(chalk.blue('\n  By HTTP Status:'));
      for (const [status, count] of Object.entries(stats.byHttpStatus)) {
        console.log(`    ${status}: ${chalk.cyan(count)}`);
      }

      console.log(chalk.blue('\n  By Severity:'));
      for (const [severity, count] of Object.entries(stats.bySeverity)) {
        console.log(`    ${severity}: ${chalk.cyan(count)}`);
      }
    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error}`));
      process.exit(1);
    }
  });

program.parse();
