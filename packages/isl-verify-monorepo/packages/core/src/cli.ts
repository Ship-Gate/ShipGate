#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { LicenseStorage, LicenseValidator } from '@shipgate/shared';
import { Tier1StaticProver } from './provers';
import type { VerifyOptions } from './types';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const program = new Command();

program
  .name('isl-verify')
  .description('ISL Verify - Formal verification toolkit')
  .version('1.0.0');

program
  .command('verify')
  .description('Run verification on source files')
  .argument('[pattern]', 'File pattern to verify', '**/*.{ts,js}')
  .option('--tier <tier>', 'Verification tier (tier1, tier2, tier3)', 'tier1')
  .option('--json', 'Output results as JSON')
  .option('--fix', 'Apply auto-fixes where possible')
  .action(async (pattern: string, options: VerifyOptions) => {
    try {
      const tier = options.tier || 'tier1';
      
      // Check license for tier2/tier3
      if (tier !== 'tier1') {
        const validation = LicenseStorage.validate();
        if (!validation.valid) {
          console.error(chalk.red(`\n✗ License required for ${tier.toUpperCase()}`));
          console.error(chalk.yellow(`\nActivate your license:`));
          console.error(chalk.gray(`  isl-verify activate <license-key>\n`));
          process.exit(1);
        }
      }

      const files = await glob(pattern, { absolute: true, posix: true });
      
      if (files.length === 0) {
        console.error(chalk.yellow(`No files found matching pattern: ${pattern}`));
        process.exit(1);
      }

      console.log(chalk.blue(`\n🔍 Verifying ${files.length} files (${tier})...\n`));

      const prover = new Tier1StaticProver();
      let totalFindings = 0;

      for (const file of files) {
        const source = fs.readFileSync(file, 'utf-8');
        const result = await prover.verify({ file, source, tier: tier as any });

        const failed = result.properties.filter(p => p.status === 'fail');
        totalFindings += failed.length;

        if (failed.length > 0) {
          console.log(chalk.gray(file));
          failed.forEach(prop => {
            console.log(chalk.red(`  ✗ ${prop.property}: ${prop.message}`));
          });
          console.log();
        }
      }

      if (totalFindings === 0) {
        console.log(chalk.green(`✓ All checks passed!\n`));
        process.exit(0);
      } else {
        console.log(chalk.red(`✗ ${totalFindings} issue(s) found\n`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program
  .command('activate')
  .description('Activate ISL Verify license')
  .argument('<license-key>', 'Your license key')
  .action((licenseKey: string) => {
    try {
      const validation = LicenseValidator.validate(licenseKey);
      
      if (!validation.valid) {
        console.error(chalk.red(`\n✗ Invalid license key: ${validation.message}\n`));
        process.exit(1);
      }

      LicenseStorage.store(licenseKey);
      
      console.log(chalk.green(`\n✓ License activated successfully!`));
      console.log(chalk.gray(`\nTier: ${validation.tier}`));
      console.log(chalk.gray(`Expires: ${validation.expiresAt}`));
      console.log(chalk.gray(`Days remaining: ${validation.daysUntilExpiry}\n`));
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program
  .command('license')
  .description('Show license information')
  .action(() => {
    const validation = LicenseStorage.validate();
    
    if (!validation.valid) {
      console.log(chalk.yellow(`\n⚠ No valid license found`));
      console.log(chalk.gray(`\nYou are using the free tier (Tier 1 only)`));
      console.log(chalk.gray(`\nUpgrade to Team or Enterprise:`));
      console.log(chalk.gray(`  https://isl-verify.com/pricing\n`));
      process.exit(0);
    }

    console.log(chalk.green(`\n✓ License active`));
    console.log(chalk.gray(`\nTier: ${validation.tier}`));
    console.log(chalk.gray(`Expires: ${validation.expiresAt}`));
    console.log(chalk.gray(`Days remaining: ${validation.daysUntilExpiry}\n`));
    
    process.exit(0);
  });

program
  .command('deactivate')
  .description('Remove stored license')
  .action(() => {
    LicenseStorage.remove();
    console.log(chalk.green(`\n✓ License removed\n`));
    process.exit(0);
  });

program.parse();
