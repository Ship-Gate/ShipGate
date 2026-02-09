/**
 * Verify Evolution Command
 * 
 * Verifies API contract evolution between versions and checks for breaking changes.
 * 
 * Usage:
 *   shipgate verify evolution <old-spec> <new-spec>
 *   shipgate verify evolution --from <version> --to <version>
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import chalk from 'chalk';
import { parse as parseISL, type Domain } from '@isl-lang/parser';
import { diffDomains, determineVersionBump } from '@isl-lang/api-versioning';
import { SchemaMigrator } from '@isl-lang/schema-evolution';
import type { ISLSchema } from '@isl-lang/schema-evolution';

export interface EvolutionVerifyOptions {
  /** Old spec file path */
  oldSpec?: string;
  /** New spec file path */
  newSpec?: string;
  /** Old version string */
  fromVersion?: string;
  /** New version string */
  toVersion?: string;
  /** Output format */
  format?: 'text' | 'json' | 'ci';
  /** Verbose output */
  verbose?: boolean;
  /** Fail on breaking changes */
  failOnBreaking?: boolean;
}

export interface EvolutionVerifyResult {
  success: boolean;
  breakingChanges: number;
  nonBreakingChanges: number;
  suggestedVersion?: string;
  versionBump?: 'major' | 'minor' | 'patch' | 'none';
  compatibility: {
    backwardCompatible: boolean;
    forwardCompatible: boolean;
  };
  changes: Array<{
    type: string;
    path: string;
    breaking: boolean;
    description: string;
  }>;
  migrationSuggestions: string[];
  duration: number;
}

/**
 * Verify evolution between two ISL specs
 */
export async function verifyEvolution(
  oldSpecPath: string,
  newSpecPath: string,
  options: EvolutionVerifyOptions = {}
): Promise<EvolutionVerifyResult> {
  const startTime = Date.now();
  
  try {
    // Read and parse both specs
    const oldSource = await readFile(oldSpecPath, 'utf-8');
    const newSource = await readFile(newSpecPath, 'utf-8');
    
    const { domain: oldDomain, errors: oldErrors } = parseISL(oldSource, oldSpecPath);
    const { domain: newDomain, errors: newErrors } = parseISL(newSource, newSpecPath);
    
    if (oldErrors.length > 0 || !oldDomain) {
      throw new Error(`Failed to parse old spec: ${oldErrors.map(e => e.message).join(', ')}`);
    }
    
    if (newErrors.length > 0 || !newDomain) {
      throw new Error(`Failed to parse new spec: ${newErrors.map(e => e.message).join(', ')}`);
    }
    
    // Extract versions from domains or use provided versions
    const fromVersion = options.fromVersion || oldDomain.version || '1.0.0';
    const toVersion = options.toVersion || newDomain.version || '1.0.0';
    
    // Use api-versioning to diff domains
    const diff = diffDomains(
      {
        name: oldDomain.name.name,
        version: fromVersion,
        entities: oldDomain.entities.map(e => ({
          name: e.name.name,
          fields: e.fields.map(f => ({
            name: f.name.name,
            type: f.type.type,
            optional: f.optional !== undefined,
            constraints: [],
          })),
        })),
        behaviors: oldDomain.behaviors.map(b => ({
          name: b.name.name,
          input: b.input.fields.map(f => ({
            name: f.name.name,
            type: f.type.type,
            optional: f.optional !== undefined,
          })),
          output: b.output ? {
            type: b.output.type.type,
            fields: [],
          } : undefined,
          errors: b.errors.map(e => ({
            name: e.name.name,
            message: e.message,
          })),
          preconditions: b.preconditions.map(p => p.toString()),
          postconditions: b.postconditions.map(p => p.toString()),
        })),
        types: [],
      },
      {
        name: newDomain.name.name,
        version: toVersion,
        entities: newDomain.entities.map(e => ({
          name: e.name.name,
          fields: e.fields.map(f => ({
            name: f.name.name,
            type: f.type.type,
            optional: f.optional !== undefined,
            constraints: [],
          })),
        })),
        behaviors: newDomain.behaviors.map(b => ({
          name: b.name.name,
          input: b.input.fields.map(f => ({
            name: f.name.name,
            type: f.type.type,
            optional: f.optional !== undefined,
          })),
          output: b.output ? {
            type: b.output.type.type,
            fields: [],
          } : undefined,
          errors: b.errors.map(e => ({
            name: e.name.name,
            message: e.message,
          })),
          preconditions: b.preconditions.map(p => p.toString()),
          postconditions: b.postconditions.map(p => p.toString()),
        })),
        types: [],
      }
    );
    
    // Determine version bump
    const versionBump = determineVersionBump(
      { name: oldDomain.name.name, version: fromVersion },
      { name: newDomain.name.name, version: toVersion },
      oldDomain,
      newDomain
    );
    
    // Use schema-evolution for compatibility analysis
    const migrator = new SchemaMigrator();
    const oldSchema: ISLSchema = {
      domains: [{
        name: oldDomain.name.name,
        entities: oldDomain.entities.map(e => ({
          name: e.name.name,
          fields: e.fields.map(f => ({
            name: f.name.name,
            type: f.type.type,
            required: f.optional === undefined,
            defaultValue: undefined,
            constraints: [],
            annotations: [],
          })),
          invariants: [],
        })),
        behaviors: [],
        enums: [],
      }],
      types: [],
    };
    
    const newSchema: ISLSchema = {
      domains: [{
        name: newDomain.name.name,
        entities: newDomain.entities.map(e => ({
          name: e.name.name,
          fields: e.fields.map(f => ({
            name: f.name.name,
            type: f.type.type,
            required: f.optional === undefined,
            defaultValue: undefined,
            constraints: [],
            annotations: [],
          })),
          invariants: [],
        })),
        behaviors: [],
        enums: [],
      }],
      types: [],
    };
    
    const compatibility = migrator.checkCompatibility(oldSchema, newSchema);
    
    // Collect all changes
    const allChanges = [
      ...diff.breaking.map(c => ({
        type: c.type,
        path: c.path,
        breaking: true,
        description: c.description,
      })),
      ...diff.nonBreaking.map(c => ({
        type: c.type,
        path: c.path,
        breaking: false,
        description: c.description,
      })),
    ];
    
    // Generate migration suggestions
    const migrationSuggestions: string[] = [];
    if (diff.breaking.length > 0) {
      migrationSuggestions.push(`Found ${diff.breaking.length} breaking change(s) - consider major version bump`);
      diff.breaking.forEach(c => {
        if (c.migration) {
          migrationSuggestions.push(`  - ${c.path}: ${c.migration}`);
        }
      });
    }
    
    const success = !options.failOnBreaking || diff.breaking.length === 0;
    
    return {
      success,
      breakingChanges: diff.breaking.length,
      nonBreakingChanges: diff.nonBreaking.length,
      suggestedVersion: versionBump.toVersion,
      versionBump: versionBump.type,
      compatibility: {
        backwardCompatible: compatibility.backwardCompatible,
        forwardCompatible: compatibility.forwardCompatible,
      },
      changes: allChanges,
      migrationSuggestions,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    throw new Error(`Evolution verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Print evolution verification result
 */
export function printEvolutionResult(
  result: EvolutionVerifyResult,
  options: { format?: 'text' | 'json' | 'ci'; verbose?: boolean } = {}
): void {
  const format = options.format || 'text';
  
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  if (format === 'ci') {
    // CI-friendly output
    console.log(JSON.stringify(result, null, 2));
    
    if (!result.success) {
      process.stderr.write(`::error::Evolution check failed: ${result.breakingChanges} breaking change(s)\n`);
    } else if (result.breakingChanges > 0) {
      process.stderr.write(`::warning::Found ${result.breakingChanges} breaking change(s)\n`);
    }
    return;
  }
  
  // Pretty text output
  console.log('');
  console.log(chalk.bold.cyan('API Evolution Verification'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log('');
  
  // Summary
  const statusColor = result.success ? chalk.green : chalk.red;
  const statusIcon = result.success ? '✓' : '✗';
  console.log(`${statusColor(statusIcon)} ${result.success ? 'Compatible' : 'Breaking Changes Detected'}`);
  console.log('');
  
  // Version bump
  if (result.versionBump && result.versionBump !== 'none') {
    const bumpColor = result.versionBump === 'major' ? chalk.red :
                      result.versionBump === 'minor' ? chalk.yellow :
                      chalk.green;
    console.log(chalk.bold('Suggested Version Bump: ') + bumpColor(result.versionBump.toUpperCase()));
    console.log(chalk.gray(`  From: ${result.changes[0]?.path || 'unknown'}`));
    console.log(chalk.gray(`  To: ${result.suggestedVersion || 'unknown'}`));
    console.log('');
  }
  
  // Compatibility
  console.log(chalk.bold('Compatibility:'));
  console.log(`  Backward Compatible: ${result.compatibility.backwardCompatible ? chalk.green('Yes') : chalk.red('No')}`);
  console.log(`  Forward Compatible:  ${result.compatibility.forwardCompatible ? chalk.green('Yes') : chalk.red('No')}`);
  console.log('');
  
  // Changes summary
  console.log(chalk.bold('Changes Summary:'));
  console.log(`  Breaking Changes:    ${chalk.red(result.breakingChanges.toString())}`);
  console.log(`  Non-Breaking Changes: ${chalk.green(result.nonBreakingChanges.toString())}`);
  console.log('');
  
  // Breaking changes details
  if (result.breakingChanges > 0) {
    console.log(chalk.bold.red('Breaking Changes:'));
    result.changes
      .filter(c => c.breaking)
      .forEach((change, idx) => {
        console.log(`  ${idx + 1}. ${chalk.red(change.type)}: ${change.path}`);
        console.log(`     ${chalk.gray(change.description)}`);
      });
    console.log('');
  }
  
  // Migration suggestions
  if (result.migrationSuggestions.length > 0) {
    console.log(chalk.bold.cyan('Migration Suggestions:'));
    result.migrationSuggestions.forEach(suggestion => {
      console.log(`  • ${suggestion}`);
    });
    console.log('');
  }
  
  // Duration
  console.log(chalk.gray(`Completed in ${result.duration}ms`));
  console.log('');
}

/**
 * Get exit code for evolution result
 */
export function getEvolutionExitCode(result: EvolutionVerifyResult): number {
  return result.success ? 0 : 1;
}
