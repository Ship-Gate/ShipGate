/**
 * Check Command
 * 
 * Parse and type check ISL files with semantic analysis.
 * Usage: isl check <files...>
 */

import { readFile } from 'fs/promises';
import { glob } from 'glob';
import { resolve, relative, dirname } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parse as parseISL } from '@isl-lang/parser';
import { output, type DiagnosticError } from '../output.js';
import { loadConfig, type ISLConfig } from '../config.js';
import { withSpan, ISL_ATTR } from '@isl-lang/observability';
import {
  PassRunner,
  builtinPasses,
  buildTypeEnvironment,
  type AnalysisResult,
} from '@isl-lang/semantic-analysis';
import {
  buildModuleGraph,
  getStdlibRegistry,
  formatErrors as formatResolverErrors,
  type ModuleGraph,
  type UseStatementSpec,
} from '@isl-lang/import-resolver';

// Built-in types that don't need to be defined
const BUILTIN_TYPES = new Set([
  'String', 'Int', 'Float', 'Decimal', 'Boolean', 'Bool',
  'UUID', 'Timestamp', 'DateTime', 'Date', 'Time', 'Duration',
  'Bytes', 'JSON', 'Any', 'Void', 'Never',
  // Common aliases
  'Integer', 'Number', 'Double',
]);

// Standard library type definitions - now loaded dynamically from registry
const getStdlibTypes = (): Record<string, string[]> => {
  const registry = getStdlibRegistry();
  const types: Record<string, string[]> = {};
  
  // Get aliases and map to exports
  const aliases = registry.getAliases();
  for (const [alias, canonical] of Object.entries(aliases)) {
    const exports = registry.getModuleExports(canonical);
    if (exports.length > 0) {
      types[alias] = exports;
    }
  }
  
  // Also add canonical names
  for (const moduleName of registry.getAvailableModules()) {
    const exports = registry.getModuleExports(moduleName);
    if (exports.length > 0) {
      types[moduleName] = exports;
    }
  }
  
  return types;
};

// Lazy-loaded stdlib types
let _stdlibTypes: Record<string, string[]> | null = null;
const STDLIB_TYPES = (): Record<string, string[]> => {
  if (!_stdlibTypes) {
    _stdlibTypes = getStdlibTypes();
  }
  return _stdlibTypes;
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CheckOptions {
  /** Show verbose output */
  verbose?: boolean;
  /** Watch mode */
  watch?: boolean;
  /** Config file path */
  config?: string;
  /** Quiet mode - only show errors */
  quiet?: boolean;
  /** Debug mode - show resolved imports */
  debug?: boolean;
  /** Enable semantic analysis passes */
  semantic?: boolean;
  /** Specific semantic passes to run (comma-separated) */
  semanticPasses?: string[];
  /** Semantic passes to skip (comma-separated) */
  skipPasses?: string[];
  /** Include hint-level diagnostics */
  includeHints?: boolean;
  /** Enable import resolution (resolves use statements and imports) */
  resolveImports?: boolean;
}

export interface ResolvedImportInfo {
  from: string;
  names: string[];
  isStdlib: boolean;
  resolvedPath?: string;
  error?: string;
}

export interface FileCheckResult {
  file: string;
  valid: boolean;
  errors: DiagnosticError[];
  warnings: DiagnosticError[];
  hints: DiagnosticError[];
  stats?: {
    entities: number;
    behaviors: number;
    invariants: number;
  };
  imports?: ResolvedImportInfo[];
  semanticResult?: AnalysisResult;
}

export interface CheckResult {
  success: boolean;
  files: FileCheckResult[];
  totalErrors: number;
  totalWarnings: number;
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Check Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check a single ISL file
 */
async function checkFile(
  filePath: string, 
  verbose: boolean, 
  debug: boolean = false,
  semanticOptions?: {
    enabled: boolean;
    passes?: string[];
    skip?: string[];
    includeHints?: boolean;
  }
): Promise<FileCheckResult> {
  const errors: DiagnosticError[] = [];
  const warnings: DiagnosticError[] = [];
  const hints: DiagnosticError[] = [];
  const imports: ResolvedImportInfo[] = [];

  try {
    const source = await readFile(filePath, 'utf-8');
    const { domain: ast, errors: parseErrors } = parseISL(source, filePath);

    // Convert parse errors to diagnostics
    for (const error of parseErrors) {
      const line = 'span' in error ? error.span.start.line : error.line;
      const column = 'span' in error ? error.span.start.column : error.column;
      
      errors.push({
        file: filePath,
        line,
        column,
        message: error.message,
        severity: 'error',
      });
    }

    // If parsing succeeded, run type checks and collect stats
    let stats: FileCheckResult['stats'];
    let semanticResult: AnalysisResult | undefined;
    
    if (ast) {
      stats = {
        entities: ast.entities.length,
        behaviors: ast.behaviors.length,
        invariants: ast.invariants?.length ?? 0,
      };

      // Collect all defined types in this domain
      const definedTypes = new Set<string>();
      
      // Add types from imports
      for (const importDecl of ast.imports ?? []) {
        const moduleName = importDecl.from?.value;
        const isStdlib = moduleName?.startsWith('stdlib-') || moduleName?.startsWith('@isl/') || false;
        const importNames = importDecl.names?.map(n => n.name) ?? [];
        
        // Collect import info for debug output
        const importInfo: ResolvedImportInfo = {
          from: moduleName ?? '',
          names: importNames,
          isStdlib,
        };
        
        const stdlibTypes = STDLIB_TYPES();
        if (moduleName && stdlibTypes[moduleName]) {
          importInfo.resolvedPath = `stdlib:${moduleName}`;
          
          // If specific names imported, add those
          if (importDecl.names?.length) {
            for (const name of importDecl.names) {
              if (stdlibTypes[moduleName].includes(name.name)) {
                definedTypes.add(name.name);
              } else {
                warnings.push({
                  file: filePath,
                  message: `Type '${name.name}' is not exported from '${moduleName}'`,
                  severity: 'warning',
                  help: [`Available types: ${stdlibTypes[moduleName].join(', ')}`],
                });
              }
            }
          } else {
            // Wildcard import - add all types from module
            for (const typeName of stdlibTypes[moduleName]) {
              definedTypes.add(typeName);
            }
          }
        } else if (moduleName && !isStdlib) {
          // Local import - resolve relative path
          const baseDir = filePath.replace(/[^/\\]+$/, '');
          importInfo.resolvedPath = resolve(baseDir, moduleName);
          if (!importInfo.resolvedPath.endsWith('.isl')) {
            importInfo.resolvedPath += '.isl';
          }
        } else if (moduleName) {
          importInfo.error = `Unknown module '${moduleName}'`;
          warnings.push({
            file: filePath,
            message: `Unknown module '${moduleName}'`,
            severity: 'warning',
            help: [`Available modules: ${Object.keys(STDLIB_TYPES()).join(', ')}`],
          });
        }
        
        imports.push(importInfo);
      }
      
      // Add entities as types
      for (const entity of ast.entities) {
        definedTypes.add(entity.name.name);
      }
      
      // Add type declarations
      for (const typeDef of ast.types ?? []) {
        definedTypes.add(typeDef.name.name);
      }

      // Helper to check if a type is valid
      const isValidType = (typeName: string): boolean => {
        return BUILTIN_TYPES.has(typeName) || definedTypes.has(typeName);
      };

      // Helper to get type name from type node (handles various AST shapes)
      const getTypeName = (typeNode: unknown): string | null => {
        // Direct string type - e.g., field.type = "String" or "UUID"
        if (typeof typeNode === 'string') {
          return typeNode;
        }
        
        if (!typeNode || typeof typeNode !== 'object') return null;
        const node = typeNode as Record<string, unknown>;
        
        // PrimitiveType - e.g., { kind: "PrimitiveType", name: "UUID" }
        if (node.kind === 'PrimitiveType' && typeof node.name === 'string') {
          return node.name;
        }
        
        // ReferenceType - e.g., { kind: "ReferenceType", name: { kind: "QualifiedName", parts: [...] } }
        if (node.kind === 'ReferenceType' && node.name) {
          return getTypeName(node.name);
        }
        
        // QualifiedName with parts - e.g., { kind: "QualifiedName", parts: [{ kind: "Identifier", name: "Type" }] }
        if (node.kind === 'QualifiedName' && Array.isArray(node.parts)) {
          const parts = node.parts as Array<{ name?: string; kind?: string }>;
          if (parts.length > 0) {
            const firstPart = parts[0];
            if (firstPart.name) {
              return firstPart.name;
            }
          }
        }
        
        // Identifier kind
        if (node.kind === 'Identifier' && typeof node.name === 'string') {
          return node.name;
        }
        
        // Direct name property (string)
        if (typeof node.name === 'string') {
          return node.name;
        }
        
        // Nested name.name (for wrapped identifiers)
        if (node.name && typeof node.name === 'object') {
          return getTypeName(node.name);
        }
        
        return null;
      };

      // Check entity fields for undefined types
      for (const entity of ast.entities) {
        for (const field of entity.fields ?? []) {
          const typeName = getTypeName(field.type);
          if (typeName && !isValidType(typeName)) {
            errors.push({
              file: filePath,
              line: field.location?.start?.line,
              column: field.location?.start?.column,
              message: `Type '${typeName}' is not defined`,
              severity: 'error',
              code: 'E0100',
              help: [`Did you mean to define entity '${typeName}'?`],
            });
          }
        }
      }

      // Check behavior inputs/outputs for undefined types
      for (const behavior of ast.behaviors) {
        // Check input fields (behavior.input.fields)
        const inputBlock = behavior.input as { fields?: Array<{ type?: unknown; location?: { start?: { line?: number; column?: number } } }> } | undefined;
        for (const field of inputBlock?.fields ?? []) {
          const typeName = getTypeName(field.type);
          if (typeName && !isValidType(typeName)) {
            errors.push({
              file: filePath,
              line: field.location?.start?.line,
              column: field.location?.start?.column,
              message: `Type '${typeName}' is not defined`,
              severity: 'error',
              code: 'E0100',
              help: [`Define '${typeName}' as an entity or type, or use a built-in type`],
            });
          }
        }

        // Check output type (behavior.output.success)
        const outputBlock = behavior.output as { success?: unknown } | undefined;
        if (outputBlock?.success) {
          const typeName = getTypeName(outputBlock.success);
          if (typeName && !isValidType(typeName)) {
            errors.push({
              file: filePath,
              message: `Output type '${typeName}' is not defined in behavior '${behavior.name.name}'`,
              severity: 'error',
              code: 'E0100',
            });
          }
        }
      }

      // Check for empty behaviors (postconditions are top-level, not under body)
      for (const behavior of ast.behaviors) {
        const postconds = behavior.postconditions as { conditions?: unknown[] } | undefined;
        const scenarios = behavior.scenarios as unknown[] | undefined;
        if (!postconds?.conditions?.length && !scenarios?.length) {
          warnings.push({
            file: filePath,
            message: `Behavior '${behavior.name.name}' has no postconditions or scenarios`,
            severity: 'warning',
          });
        }
      }

      // Check for entities without fields
      for (const entity of ast.entities) {
        if (!entity.fields?.length) {
          warnings.push({
            file: filePath,
            message: `Entity '${entity.name.name}' has no fields`,
            severity: 'warning',
          });
        }
      }

      // Run semantic analysis passes if enabled
      if (semanticOptions?.enabled) {
        const runner = new PassRunner({
          enablePasses: semanticOptions.passes || [],
          disablePasses: semanticOptions.skip || [],
          includeHints: semanticOptions.includeHints ?? false,
        });
        
        runner.registerAll(builtinPasses);
        
        try {
          const typeEnv = buildTypeEnvironment(ast);
          semanticResult = runner.run(ast, source, filePath, typeEnv);
          
          // Convert semantic diagnostics to DiagnosticError format
          for (const diag of semanticResult.diagnostics) {
            const diagnosticError: DiagnosticError = {
              file: filePath,
              line: diag.location?.line,
              column: diag.location?.column,
              endLine: diag.location?.endLine,
              endColumn: diag.location?.endColumn,
              message: diag.message,
              severity: diag.severity as 'error' | 'warning' | 'info',
              code: diag.code,
              notes: diag.notes,
              help: diag.help,
            };
            
            if (diag.severity === 'error') {
              errors.push(diagnosticError);
            } else if (diag.severity === 'warning') {
              warnings.push(diagnosticError);
            } else if (diag.severity === 'hint' && semanticOptions.includeHints) {
              hints.push(diagnosticError);
            }
          }
        } catch (err) {
          // If semantic analysis fails, add as warning
          warnings.push({
            file: filePath,
            message: `Semantic analysis failed: ${err instanceof Error ? err.message : String(err)}`,
            severity: 'warning',
          });
        }
      }
    }

    return {
      file: filePath,
      valid: errors.length === 0,
      errors,
      warnings,
      hints,
      stats,
      imports: debug ? imports : undefined,
      semanticResult,
    };
  } catch (err) {
    errors.push({
      file: filePath,
      message: err instanceof Error ? err.message : String(err),
      severity: 'error',
    });

    return {
      file: filePath,
      valid: false,
      errors,
      warnings,
      hints,
      imports: debug ? imports : undefined,
    };
  }
}

/**
 * Resolve file patterns to actual file paths
 */
async function resolveFiles(patterns: string[], config?: ISLConfig): Promise<string[]> {
  const files = new Set<string>();
  
  for (const pattern of patterns) {
    // If it's a direct file path
    if (pattern.endsWith('.isl')) {
      files.add(resolve(pattern));
    } else {
      // Glob pattern
      const matches = await glob(pattern, {
        cwd: process.cwd(),
        ignore: config?.exclude ?? ['node_modules/**', 'dist/**'],
      });
      for (const match of matches) {
        if (match.endsWith('.isl')) {
          files.add(resolve(match));
        }
      }
    }
  }

  return Array.from(files);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Check Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check ISL files for syntax and semantic errors
 */
export async function check(filePatterns: string[], options: CheckOptions = {}): Promise<CheckResult> {
  return await withSpan('cli.check', {
    attributes: {
      [ISL_ATTR.COMMAND]: 'check',
      [ISL_ATTR.FILE_COUNT]: filePatterns.length,
    },
  }, async (checkSpan) => {
    const startTime = Date.now();
    const spinner = !options.quiet ? ora('Checking ISL files...').start() : null;

  // Load config
  const { config } = await loadConfig();

  // Configure output
  output.configure({
    verbose: options.verbose ?? false,
    quiet: options.quiet ?? false,
  });

  // Resolve files
  const files = await resolveFiles(
    filePatterns.length > 0 ? filePatterns : config?.include ?? ['**/*.isl'],
    config ?? undefined
  );

  if (files.length === 0) {
    spinner?.warn('No ISL files found');
    return {
      success: true,
      files: [],
      totalErrors: 0,
      totalWarnings: 0,
      duration: Date.now() - startTime,
    };
  }

  if (spinner) spinner.text = `Checking ${files.length} file${files.length === 1 ? '' : 's'}...`;

  // Resolve imports first if enabled
  const resolveImports = options.resolveImports ?? true; // Enabled by default
  const moduleGraphs: Map<string, ModuleGraph> = new Map();
  
  if (resolveImports) {
    if (spinner) spinner.text = 'Resolving imports...';
    
    for (const file of files) {
      try {
        const graph = await buildModuleGraph(file, {
          basePath: dirname(file),
          enableImports: true,
          debug: options.debug ?? false,
          enableCaching: true,
        });
        moduleGraphs.set(file, graph);
        
        // Log import resolution errors if verbose
        if (options.verbose && graph.errors.length > 0) {
          for (const err of graph.errors) {
            output.debug(`[Import Resolution] ${err.message}`);
          }
        }
      } catch (err) {
        // Import resolution failed - continue with single-file mode
        if (options.verbose) {
          output.debug(`[Import Resolution] Failed for ${file}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    
    if (spinner && options.verbose) {
      spinner.text = `Resolved imports for ${moduleGraphs.size}/${files.length} files...`;
    }
  }

  // Check all files
  const results: FileCheckResult[] = [];
  const semanticOptions = {
    enabled: options.semantic ?? false, // Semantic analysis disabled by default (has bugs to fix)
    passes: options.semanticPasses,
    skip: options.skipPasses,
    includeHints: options.includeHints ?? false,
  };
  
  for (const file of files) {
    const moduleGraph = moduleGraphs.get(file);
    const result = await checkFile(file, options.verbose ?? false, options.debug ?? false, semanticOptions);
    
    // Add import resolution errors to result
    if (moduleGraph && moduleGraph.errors.length > 0) {
      for (const err of moduleGraph.errors) {
        result.errors.push({
          file,
          message: err.message,
          severity: 'error',
          code: err.code,
        });
      }
      result.valid = result.errors.length === 0;
    }
    
    results.push(result);
  }

    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
    const duration = Date.now() - startTime;

    // Set span attributes
    checkSpan.setAttribute('isl.check.error_count', totalErrors);
    checkSpan.setAttribute('isl.check.warning_count', totalWarnings);
    checkSpan.setAttribute(ISL_ATTR.FILE_COUNT, files.length);
    checkSpan.setAttribute(ISL_ATTR.DURATION_MS, duration);
    if (totalErrors > 0) {
      checkSpan.setError(`${totalErrors} errors found`);
    }

    if (totalErrors > 0) {
      spinner?.fail(`Check failed with ${totalErrors} error${totalErrors === 1 ? '' : 's'}`);
    } else {
      spinner?.succeed(`Checked ${files.length} file${files.length === 1 ? '' : 's'} (${duration}ms)`);
    }

    return {
      success: totalErrors === 0,
      files: results,
      totalErrors,
      totalWarnings,
      duration,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print check results to console
 */
export function printCheckResult(result: CheckResult, showHints = false): void {
  console.log('');

  // Print file-by-file results
  for (const file of result.files) {
    const relPath = relative(process.cwd(), file.file);
    
    if (file.valid) {
      console.log(chalk.green('✓') + ` ${relPath}`);
      
      if (file.stats) {
        output.debug(`  Entities: ${file.stats.entities}, Behaviors: ${file.stats.behaviors}`);
      }
    } else {
      console.log(chalk.red('✗') + ` ${relPath}`);
    }

    // Print resolved imports if debug mode
    if (file.imports && file.imports.length > 0) {
      console.log(chalk.cyan('  Resolved imports:'));
      for (const imp of file.imports) {
        const status = imp.error ? chalk.red('✗') : chalk.green('✓');
        const type = imp.isStdlib ? chalk.blue('[stdlib]') : chalk.gray('[local]');
        const names = imp.names.length > 0 ? ` { ${imp.names.join(', ')} }` : '';
        console.log(`    ${status} ${type} ${imp.from}${names}`);
        if (imp.resolvedPath) {
          console.log(chalk.gray(`       → ${imp.resolvedPath}`));
        }
        if (imp.error) {
          console.log(chalk.red(`       Error: ${imp.error}`));
        }
      }
    }

    // Print errors
    for (const err of file.errors) {
      output.diagnostic(err);
    }

    // Print warnings
    for (const warn of file.warnings) {
      output.diagnostic(warn);
    }

    // Print hints if enabled
    if (showHints && file.hints) {
      for (const hint of file.hints) {
        output.diagnostic({ ...hint, severity: 'info' });
      }
    }

    // Print semantic analysis timing info if available
    if (file.semanticResult && output.isJson()) {
      output.debug(`  Semantic passes: ${file.semanticResult.stats.passesRun}/${file.semanticResult.stats.totalPasses}`);
      output.debug(`  Semantic duration: ${file.semanticResult.stats.totalDurationMs}ms`);
    }
  }

  // Calculate totals including hints
  const totalHints = result.files.reduce((sum, f) => sum + (f.hints?.length ?? 0), 0);

  // Print summary
  console.log('');
  if (result.success) {
    let message = chalk.green(`✓ All ${result.files.length} file${result.files.length === 1 ? '' : 's'} passed`);
    const extras: string[] = [];
    
    if (result.totalWarnings > 0) {
      extras.push(chalk.yellow(`${result.totalWarnings} warning${result.totalWarnings === 1 ? '' : 's'}`));
    }
    if (showHints && totalHints > 0) {
      extras.push(chalk.cyan(`${totalHints} hint${totalHints === 1 ? '' : 's'}`));
    }
    
    if (extras.length > 0) {
      message += ` (${extras.join(', ')})`;
    }
    console.log(message);
  } else {
    let message = chalk.red(`✗ ${result.totalErrors} error${result.totalErrors === 1 ? '' : 's'}`);
    
    if (result.totalWarnings > 0) {
      message += chalk.yellow(` ${result.totalWarnings} warning${result.totalWarnings === 1 ? '' : 's'}`);
    }
    if (showHints && totalHints > 0) {
      message += chalk.cyan(` ${totalHints} hint${totalHints === 1 ? '' : 's'}`);
    }
    console.log(message);
  }

  console.log(chalk.gray(`  Completed in ${result.duration}ms`));
}

export default check;
