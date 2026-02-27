#!/usr/bin/env node
/**
 * Generator SDK CLI
 *
 * Command-line tool for scaffolding new ISL generators.
 */

import { Command } from 'commander';
import { scaffold, type ScaffoldOptions } from './scaffold.js';

const program = new Command();

program
  .name('isl-generator')
  .description('CLI for creating ISL code generators')
  .version('1.0.0');

program
  .command('create <name>')
  .description('Create a new ISL generator project')
  .option('-o, --output <dir>', 'Output directory', '.')
  .option('-l, --language <lang>', 'Target language for generated code', 'typescript')
  .option('-d, --description <desc>', 'Generator description')
  .option('--no-examples', 'Skip example templates')
  .option('--npm', 'Use npm as package manager')
  .option('--yarn', 'Use yarn as package manager')
  .option('--pnpm', 'Use pnpm as package manager')
  .action(async (name: string, options) => {
    let packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm';
    if (options.yarn) packageManager = 'yarn';
    if (options.pnpm) packageManager = 'pnpm';

    const scaffoldOptions: ScaffoldOptions = {
      name,
      outputDir: options.output,
      targetLanguage: options.language,
      description: options.description,
      includeExamples: options.examples !== false,
      packageManager,
    };

    try {
      const result = await scaffold(scaffoldOptions);
      console.log(`\n✅ Generator "${name}" created successfully!`);
      console.log(`\n📁 Project location: ${result.outputDir}`);
      console.log(`\n📄 Files created:`);
      for (const file of result.files) {
        console.log(`   - ${file}`);
      }
      console.log(`\n🚀 Next steps:`);
      console.log(`   cd ${result.outputDir}`);
      console.log(`   ${packageManager} install`);
      console.log(`   ${packageManager} run build`);
      console.log('');
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('list-templates')
  .description('List available generator templates')
  .action(() => {
    console.log('\nAvailable templates:');
    console.log('  - typescript: TypeScript code generator');
    console.log('  - python: Python code generator');
    console.log('  - go: Go code generator');
    console.log('  - rust: Rust code generator');
    console.log('  - docs: Documentation generator');
    console.log('');
  });

program.parse();
