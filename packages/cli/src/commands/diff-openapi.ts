/**
 * Diff OpenAPI Command
 * 
 * Compare two OpenAPI specifications and show API drift.
 * Usage: shipgate diff openapi <old> <new>
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import * as YAML from 'yaml';
import type { OpenAPISpec, OpenAPISchema, OpenAPIOperation } from '@isl-lang/codegen-openapi';
import { ExitCode } from '../exit-codes.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DiffOpenAPIOptions {
  /** Output format */
  format?: 'pretty' | 'json' | 'quiet';
  /** Verbose output */
  verbose?: boolean;
  /** Show only breaking changes */
  breakingOnly?: boolean;
  /** Ignore version changes */
  ignoreVersion?: boolean;
}

export interface DiffOpenAPIResult {
  success: boolean;
  oldFile: string;
  newFile: string;
  breaking: DiffChange[];
  nonBreaking: DiffChange[];
  added: DiffChange[];
  removed: DiffChange[];
  modified: DiffChange[];
  errors: string[];
  duration: number;
}

export interface DiffChange {
  type: 'breaking' | 'non-breaking' | 'added' | 'removed' | 'modified';
  category: 'path' | 'operation' | 'parameter' | 'schema' | 'response' | 'security';
  path: string;
  description: string;
  oldValue?: unknown;
  newValue?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Diff Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Diff two OpenAPI specifications
 */
export async function diffOpenAPI(
  oldFile: string,
  newFile: string,
  options: DiffOpenAPIOptions = {}
): Promise<DiffOpenAPIResult> {
  const startTime = Date.now();
  const spinner = options.format !== 'json' ? ora('Loading OpenAPI specs...').start() : null;
  const errors: string[] = [];

  try {
    // Load both specs
    spinner && (spinner.text = 'Loading old specification...');
    const oldPath = resolve(oldFile);
    const oldContent = await readFile(oldPath, 'utf-8');
    const oldSpec = parseOpenAPIContent(oldContent, oldPath);

    spinner && (spinner.text = 'Loading new specification...');
    const newPath = resolve(newFile);
    const newContent = await readFile(newPath, 'utf-8');
    const newSpec = parseOpenAPIContent(newContent, newPath);

    if (!oldSpec || !newSpec) {
      spinner?.fail('Failed to parse OpenAPI specs');
      return {
        success: false,
        oldFile: oldPath,
        newFile: newPath,
        breaking: [],
        nonBreaking: [],
        added: [],
        removed: [],
        modified: [],
        errors: ['Failed to parse one or both OpenAPI specs'],
        duration: Date.now() - startTime,
      };
    }

    // Compute diff
    spinner && (spinner.text = 'Computing differences...');
    const changes = computeDiff(oldSpec, newSpec, options);

    const duration = Date.now() - startTime;
    spinner?.succeed(`Found ${changes.length} changes (${duration}ms)`);

    // Categorize changes
    const breaking = changes.filter(c => c.type === 'breaking');
    const nonBreaking = changes.filter(c => c.type === 'non-breaking');
    const added = changes.filter(c => c.type === 'added');
    const removed = changes.filter(c => c.type === 'removed');
    const modified = changes.filter(c => c.type === 'modified');

    return {
      success: true,
      oldFile: oldPath,
      newFile: newPath,
      breaking,
      nonBreaking,
      added,
      removed,
      modified,
      errors,
      duration,
    };
  } catch (err) {
    spinner?.fail('Diff failed');
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(errorMsg);

    return {
      success: false,
      oldFile: oldFile,
      newFile: newFile,
      breaking: [],
      nonBreaking: [],
      added: [],
      removed: [],
      modified: [],
      errors,
      duration: Date.now() - startTime,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse OpenAPI content (JSON or YAML)
 */
function parseOpenAPIContent(content: string, filePath: string): OpenAPISpec | null {
  try {
    return JSON.parse(content) as OpenAPISpec;
  } catch {
    try {
      return YAML.parse(content) as OpenAPISpec;
    } catch (err) {
      console.error(chalk.red(`Failed to parse ${filePath}: ${err instanceof Error ? err.message : String(err)}`));
      return null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff Computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute diff between two OpenAPI specs
 */
function computeDiff(
  oldSpec: OpenAPISpec,
  newSpec: OpenAPISpec,
  options: DiffOpenAPIOptions
): DiffChange[] {
  const changes: DiffChange[] = [];

  // Diff paths
  const oldPaths = oldSpec.paths || {};
  const newPaths = newSpec.paths || {};
  
  const allPaths = new Set([...Object.keys(oldPaths), ...Object.keys(newPaths)]);

  for (const path of allPaths) {
    const oldPathItem = oldPaths[path];
    const newPathItem = newPaths[path];

    if (!oldPathItem && newPathItem) {
      // Path added
      changes.push({
        type: 'added',
        category: 'path',
        path,
        description: `Path added: ${path}`,
        newValue: newPathItem,
      });
      continue;
    }

    if (oldPathItem && !newPathItem) {
      // Path removed (breaking)
      changes.push({
        type: 'breaking',
        category: 'path',
        path,
        description: `Path removed: ${path}`,
        oldValue: oldPathItem,
      });
      continue;
    }

    if (oldPathItem && newPathItem) {
      // Diff operations in path
      const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
      for (const method of methods) {
        const oldOp = oldPathItem[method];
        const newOp = newPathItem[method];

        if (!oldOp && newOp) {
          changes.push({
            type: 'added',
            category: 'operation',
            path: `${method.toUpperCase()} ${path}`,
            description: `Operation added: ${method.toUpperCase()} ${path}`,
            newValue: newOp,
          });
        } else if (oldOp && !newOp) {
          changes.push({
            type: 'breaking',
            category: 'operation',
            path: `${method.toUpperCase()} ${path}`,
            description: `Operation removed: ${method.toUpperCase()} ${path}`,
            oldValue: oldOp,
          });
        } else if (oldOp && newOp) {
          // Diff operation details
          changes.push(...diffOperation(oldOp, newOp, path, method));
        }
      }
    }
  }

  // Diff schemas
  const oldSchemas = oldSpec.components?.schemas || {};
  const newSchemas = newSpec.components?.schemas || {};
  const allSchemas = new Set([...Object.keys(oldSchemas), ...Object.keys(newSchemas)]);

  for (const schemaName of allSchemas) {
    const oldSchema = oldSchemas[schemaName];
    const newSchema = newSchemas[schemaName];

    if (!oldSchema && newSchema) {
      changes.push({
        type: 'added',
        category: 'schema',
        path: `#/components/schemas/${schemaName}`,
        description: `Schema added: ${schemaName}`,
        newValue: newSchema,
      });
    } else if (oldSchema && !newSchema) {
      changes.push({
        type: 'breaking',
        category: 'schema',
        path: `#/components/schemas/${schemaName}`,
        description: `Schema removed: ${schemaName}`,
        oldValue: oldSchema,
      });
    } else if (oldSchema && newSchema) {
      const schemaChanges = diffSchema(oldSchema, newSchema, schemaName);
      changes.push(...schemaChanges);
    }
  }

  // Filter by options
  if (options.breakingOnly) {
    return changes.filter(c => c.type === 'breaking');
  }

  return changes;
}

/**
 * Diff operation details
 */
function diffOperation(
  oldOp: OpenAPIOperation,
  newOp: OpenAPIOperation,
  path: string,
  method: string
): DiffChange[] {
  const changes: DiffChange[] = [];
  const opPath = `${method.toUpperCase()} ${path}`;

  // Diff parameters
  const oldParams = oldOp.parameters || [];
  const newParams = newOp.parameters || [];
  const paramMap = new Map(oldParams.map(p => [p.name, p]));
  
  for (const newParam of newParams) {
    const oldParam = paramMap.get(newParam.name);
    if (!oldParam) {
      // Parameter added
      if (newParam.required) {
        changes.push({
          type: 'breaking',
          category: 'parameter',
          path: `${opPath} - ${newParam.name}`,
          description: `Required parameter added: ${newParam.name}`,
          newValue: newParam,
        });
      } else {
        changes.push({
          type: 'non-breaking',
          category: 'parameter',
          path: `${opPath} - ${newParam.name}`,
          description: `Optional parameter added: ${newParam.name}`,
          newValue: newParam,
        });
      }
    } else {
      // Parameter modified
      if (oldParam.required && !newParam.required) {
        changes.push({
          type: 'non-breaking',
          category: 'parameter',
          path: `${opPath} - ${newParam.name}`,
          description: `Parameter made optional: ${newParam.name}`,
          oldValue: oldParam,
          newValue: newParam,
        });
      } else if (!oldParam.required && newParam.required) {
        changes.push({
          type: 'breaking',
          category: 'parameter',
          path: `${opPath} - ${newParam.name}`,
          description: `Parameter made required: ${newParam.name}`,
          oldValue: oldParam,
          newValue: newParam,
        });
      }
    }
  }

  // Check for removed parameters
  const newParamMap = new Map(newParams.map(p => [p.name, p]));
  for (const oldParam of oldParams) {
    if (!newParamMap.has(oldParam.name)) {
      changes.push({
        type: 'breaking',
        category: 'parameter',
        path: `${opPath} - ${oldParam.name}`,
        description: `Parameter removed: ${oldParam.name}`,
        oldValue: oldParam,
      });
    }
  }

  // Diff request body
  if (oldOp.requestBody && !newOp.requestBody) {
    changes.push({
      type: 'breaking',
      category: 'operation',
      path: opPath,
      description: 'Request body removed',
      oldValue: oldOp.requestBody,
    });
  } else if (!oldOp.requestBody && newOp.requestBody) {
    changes.push({
      type: 'breaking',
      category: 'operation',
      path: opPath,
      description: 'Request body added',
      newValue: newOp.requestBody,
    });
  }

  // Diff responses
  const oldResponses = oldOp.responses || {};
  const newResponses = newOp.responses || {};
  const allStatusCodes = new Set([...Object.keys(oldResponses), ...Object.keys(newResponses)]);

  for (const statusCode of allStatusCodes) {
    const oldResponse = oldResponses[statusCode];
    const newResponse = newResponses[statusCode];

    if (!oldResponse && newResponse) {
      changes.push({
        type: 'added',
        category: 'response',
        path: `${opPath} - ${statusCode}`,
        description: `Response added: ${statusCode}`,
        newValue: newResponse,
      });
    } else if (oldResponse && !newResponse) {
      if (statusCode === '200' || statusCode === '201') {
        changes.push({
          type: 'breaking',
          category: 'response',
          path: `${opPath} - ${statusCode}`,
          description: `Success response removed: ${statusCode}`,
          oldValue: oldResponse,
        });
      } else {
        changes.push({
          type: 'non-breaking',
          category: 'response',
          path: `${opPath} - ${statusCode}`,
          description: `Error response removed: ${statusCode}`,
          oldValue: oldResponse,
        });
      }
    }
  }

  return changes;
}

/**
 * Diff schema
 */
function diffSchema(
  oldSchema: OpenAPISchema,
  newSchema: OpenAPISchema,
  schemaName: string
): DiffChange[] {
  const changes: DiffChange[] = [];
  const schemaPath = `#/components/schemas/${schemaName}`;

  // Type change (breaking)
  if (oldSchema.type !== newSchema.type) {
    changes.push({
      type: 'breaking',
      category: 'schema',
      path: schemaPath,
      description: `Schema type changed from ${oldSchema.type} to ${newSchema.type}`,
      oldValue: oldSchema.type,
      newValue: newSchema.type,
    });
  }

  // Properties diff
  const oldProps = oldSchema.properties || {};
  const newProps = newSchema.properties || {};
  const allProps = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

  for (const propName of allProps) {
    const oldProp = oldProps[propName];
    const newProp = newProps[propName];

    if (!oldProp && newProp) {
      const required = (newSchema.required || []).includes(propName);
      changes.push({
        type: required ? 'breaking' : 'non-breaking',
        category: 'schema',
        path: `${schemaPath}.${propName}`,
        description: `${required ? 'Required' : 'Optional'} property added: ${propName}`,
        newValue: newProp,
      });
    } else if (oldProp && !newProp) {
      changes.push({
        type: 'breaking',
        category: 'schema',
        path: `${schemaPath}.${propName}`,
        description: `Property removed: ${propName}`,
        oldValue: oldProp,
      });
    } else if (oldProp && newProp) {
      // Property type changed
      if (oldProp.type !== newProp.type) {
        changes.push({
          type: 'breaking',
          category: 'schema',
          path: `${schemaPath}.${propName}`,
          description: `Property type changed: ${propName}`,
          oldValue: oldProp.type,
          newValue: newProp.type,
        });
      }

      // Required status changed
      const oldRequired = (oldSchema.required || []).includes(propName);
      const newRequired = (newSchema.required || []).includes(propName);
      if (oldRequired && !newRequired) {
        changes.push({
          type: 'non-breaking',
          category: 'schema',
          path: `${schemaPath}.${propName}`,
          description: `Property made optional: ${propName}`,
        });
      } else if (!oldRequired && newRequired) {
        changes.push({
          type: 'breaking',
          category: 'schema',
          path: `${schemaPath}.${propName}`,
          description: `Property made required: ${propName}`,
        });
      }
    }
  }

  return changes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print diff result to console
 */
export function printDiffOpenAPIResult(
  result: DiffOpenAPIResult,
  options?: DiffOpenAPIOptions
): void {
  if (options?.format === 'json') {
    console.log(JSON.stringify({
      success: result.success,
      oldFile: result.oldFile,
      newFile: result.newFile,
      breaking: result.breaking,
      nonBreaking: result.nonBreaking,
      added: result.added,
      removed: result.removed,
      modified: result.modified,
      errors: result.errors,
      duration: result.duration,
    }, null, 2));
    return;
  }

  if (options?.format === 'quiet') {
    if (result.breaking.length > 0) {
      for (const change of result.breaking) {
        console.error(`BREAKING: ${change.description}`);
      }
    }
    return;
  }

  console.log('');

  if (!result.success) {
    console.log(chalk.red('✗ Diff failed'));
    console.log('');
    for (const error of result.errors) {
      console.log(chalk.red(`  ${error}`));
    }
    return;
  }

  const totalChanges = result.breaking.length + result.nonBreaking.length + 
                       result.added.length + result.removed.length + result.modified.length;

  if (totalChanges === 0) {
    console.log(chalk.green('✓ No differences found'));
    console.log(chalk.gray(`  Completed in ${result.duration}ms`));
    return;
  }

  console.log(chalk.bold(`Found ${totalChanges} changes:`));
  console.log('');

  // Breaking changes
  if (result.breaking.length > 0) {
    console.log(chalk.red.bold(`  BREAKING (${result.breaking.length}):`));
    for (const change of result.breaking) {
      console.log(chalk.red(`    ✗ ${change.description}`));
      if (options?.verbose) {
        console.log(chalk.gray(`      Path: ${change.path}`));
      }
    }
    console.log('');
  }

  // Non-breaking changes
  if (result.nonBreaking.length > 0) {
    console.log(chalk.yellow.bold(`  Non-Breaking (${result.nonBreaking.length}):`));
    for (const change of result.nonBreaking) {
      console.log(chalk.yellow(`    ~ ${change.description}`));
      if (options?.verbose) {
        console.log(chalk.gray(`      Path: ${change.path}`));
      }
    }
    console.log('');
  }

  // Added
  if (result.added.length > 0) {
    console.log(chalk.green.bold(`  Added (${result.added.length}):`));
    for (const change of result.added) {
      console.log(chalk.green(`    + ${change.description}`));
      if (options?.verbose) {
        console.log(chalk.gray(`      Path: ${change.path}`));
      }
    }
    console.log('');
  }

  // Removed
  if (result.removed.length > 0) {
    console.log(chalk.red.bold(`  Removed (${result.removed.length}):`));
    for (const change of result.removed) {
      console.log(chalk.red(`    - ${change.description}`));
      if (options?.verbose) {
        console.log(chalk.gray(`      Path: ${change.path}`));
      }
    }
    console.log('');
  }

  console.log(chalk.gray(`  Completed in ${result.duration}ms`));
}

/**
 * Get exit code for diff result
 */
export function getDiffOpenAPIExitCode(result: DiffOpenAPIResult): number {
  if (!result.success) return ExitCode.ISL_ERROR;
  if (result.breaking.length > 0) return ExitCode.ISL_ERROR; // Breaking changes = error
  return ExitCode.SUCCESS;
}
