// ============================================================================
// ISL Import Resolver - Error Handling
// ============================================================================

import type * as AST from '@isl-lang/parser';
import {
  ResolverError,
  ResolverWarning,
  ResolverErrorCode,
  ResolverWarningCode,
  DependencyCycle,
  MergeConflict,
} from './types.js';

/**
 * Create an error for when imports are disabled (MVP mode)
 */
export function importsDisabledError(
  importPath: string,
  location?: AST.SourceLocation
): ResolverError {
  return {
    code: ResolverErrorCode.IMPORTS_DISABLED,
    message: `Import resolution is disabled (single-file mode). ` +
      `Cannot import "${importPath}". ` +
      `To enable multi-file imports, set 'enableImports: true' in resolver options. ` +
      `Note: Multi-file mode requires all imported modules to be available.`,
    location,
    details: { importPath },
  };
}

/**
 * Create an error for module not found
 */
export function moduleNotFoundError(
  importPath: string,
  resolvedPath: string,
  searchedPaths: string[],
  location?: AST.SourceLocation
): ResolverError {
  const searchInfo = searchedPaths.length > 0
    ? `\nSearched paths:\n${searchedPaths.map(p => `  - ${p}`).join('\n')}`
    : '';
  
  return {
    code: ResolverErrorCode.MODULE_NOT_FOUND,
    message: `Module not found: "${importPath}"` +
      `\nResolved to: "${resolvedPath}"${searchInfo}`,
    path: resolvedPath,
    location,
    details: { importPath, resolvedPath, searchedPaths },
  };
}

/**
 * Create an error for parse failure
 */
export function parseError(
  path: string,
  parseErrors: Array<{ message: string; location?: AST.SourceLocation }>
): ResolverError {
  const errorList = parseErrors
    .map(e => `  - ${e.message}${e.location ? ` at line ${e.location.line}` : ''}`)
    .join('\n');
  
  return {
    code: ResolverErrorCode.PARSE_ERROR,
    message: `Failed to parse module "${path}":\n${errorList}`,
    path,
    details: { parseErrors },
  };
}

/**
 * Create an error for file read failure
 */
export function readError(
  path: string,
  reason: string
): ResolverError {
  return {
    code: ResolverErrorCode.READ_ERROR,
    message: `Failed to read module "${path}": ${reason}`,
    path,
    details: { reason },
  };
}

/**
 * Create an error for circular dependency
 */
export function circularDependencyError(
  cycle: DependencyCycle
): ResolverError {
  const cyclePath = [...cycle.path, cycle.path[0]].join('\n  → ');
  
  return {
    code: ResolverErrorCode.CIRCULAR_DEPENDENCY,
    message: `Circular dependency detected:\n  → ${cyclePath}\n\n` +
      `Circular imports are not allowed. ` +
      `Consider restructuring your modules to break the cycle.`,
    details: { cycle: cycle.path },
  };
}

/**
 * Create an error for max depth exceeded
 */
export function maxDepthExceededError(
  maxDepth: number,
  currentPath: string[]
): ResolverError {
  return {
    code: ResolverErrorCode.MAX_DEPTH_EXCEEDED,
    message: `Maximum import depth (${maxDepth}) exceeded. ` +
      `This may indicate a circular dependency or extremely deep import chain.\n` +
      `Current path: ${currentPath.join(' → ')}`,
    details: { maxDepth, currentPath },
  };
}

/**
 * Create an error for duplicate symbol
 */
export function duplicateSymbolError(
  conflict: MergeConflict
): ResolverError {
  const kindMap: Record<string, ResolverErrorCode> = {
    type: ResolverErrorCode.DUPLICATE_TYPE,
    entity: ResolverErrorCode.DUPLICATE_ENTITY,
    behavior: ResolverErrorCode.DUPLICATE_BEHAVIOR,
    invariant: ResolverErrorCode.DUPLICATE_INVARIANT,
    policy: ResolverErrorCode.DUPLICATE_POLICY,
    view: ResolverErrorCode.DUPLICATE_VIEW,
  };

  return {
    code: kindMap[conflict.kind] || ResolverErrorCode.DUPLICATE_TYPE,
    message: `Duplicate ${conflict.kind} "${conflict.name}" found:\n` +
      `  First defined in: ${conflict.firstDefinition.path} (line ${conflict.firstDefinition.location.line})\n` +
      `  Also defined in: ${conflict.secondDefinition.path} (line ${conflict.secondDefinition.location.line})\n\n` +
      `Each ${conflict.kind} must have a unique name across all modules.`,
    location: conflict.secondDefinition.location,
    path: conflict.secondDefinition.path,
    details: { conflict },
  };
}

/**
 * Create an error for symbol not found in import
 */
export function symbolNotFoundError(
  symbolName: string,
  modulePath: string,
  availableSymbols: string[],
  location?: AST.SourceLocation
): ResolverError {
  const suggestions = availableSymbols.length > 0
    ? `\nAvailable exports: ${availableSymbols.join(', ')}`
    : '\nThis module has no exports.';
  
  return {
    code: ResolverErrorCode.SYMBOL_NOT_FOUND,
    message: `Symbol "${symbolName}" not found in module "${modulePath}".${suggestions}`,
    path: modulePath,
    location,
    details: { symbolName, modulePath, availableSymbols },
  };
}

/**
 * Create an error for ambiguous import
 */
export function ambiguousImportError(
  symbolName: string,
  sources: Array<{ path: string; location: AST.SourceLocation }>,
  location?: AST.SourceLocation
): ResolverError {
  const sourceList = sources
    .map(s => `  - ${s.path} (line ${s.location.line})`)
    .join('\n');
  
  return {
    code: ResolverErrorCode.AMBIGUOUS_IMPORT,
    message: `Ambiguous import: "${symbolName}" is exported by multiple modules:\n${sourceList}\n\n` +
      `Use an alias to disambiguate: "{ ${symbolName} as Alias } from ..."`,
    location,
    details: { symbolName, sources },
  };
}

/**
 * Create an error for invalid import path
 */
export function invalidImportPathError(
  importPath: string,
  reason: string,
  location?: AST.SourceLocation
): ResolverError {
  return {
    code: ResolverErrorCode.INVALID_IMPORT_PATH,
    message: `Invalid import path "${importPath}": ${reason}`,
    location,
    details: { importPath, reason },
  };
}

/**
 * Create a warning for unused import
 */
export function unusedImportWarning(
  symbolName: string,
  modulePath: string,
  location?: AST.SourceLocation
): ResolverWarning {
  return {
    code: ResolverWarningCode.UNUSED_IMPORT,
    message: `Unused import: "${symbolName}" from "${modulePath}"`,
    path: modulePath,
    location,
  };
}

/**
 * Create a warning for shadowed import
 */
export function shadowedImportWarning(
  symbolName: string,
  importPath: string,
  shadowedBy: { path: string; location: AST.SourceLocation },
  location?: AST.SourceLocation
): ResolverWarning {
  return {
    code: ResolverWarningCode.SHADOWED_IMPORT,
    message: `Import "${symbolName}" from "${importPath}" is shadowed by ` +
      `local definition at ${shadowedBy.path}:${shadowedBy.location.line}`,
    path: importPath,
    location,
  };
}

/**
 * Format resolver errors for display
 */
export function formatErrors(errors: ResolverError[]): string {
  if (errors.length === 0) return '';
  
  const lines: string[] = [
    `Found ${errors.length} error${errors.length > 1 ? 's' : ''}:`,
    '',
  ];
  
  for (const error of errors) {
    lines.push(`[${error.code}] ${error.message}`);
    if (error.path) {
      lines.push(`  File: ${error.path}`);
    }
    if (error.location) {
      lines.push(`  Location: line ${error.location.line}, column ${error.location.column}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Format resolver warnings for display
 */
export function formatWarnings(warnings: ResolverWarning[]): string {
  if (warnings.length === 0) return '';
  
  const lines: string[] = [
    `Found ${warnings.length} warning${warnings.length > 1 ? 's' : ''}:`,
    '',
  ];
  
  for (const warning of warnings) {
    lines.push(`[${warning.code}] ${warning.message}`);
    if (warning.path) {
      lines.push(`  File: ${warning.path}`);
    }
    if (warning.location) {
      lines.push(`  Location: line ${warning.location.line}, column ${warning.location.column}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}
