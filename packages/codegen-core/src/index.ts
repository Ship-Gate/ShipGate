/**
 * @isl-lang/codegen-core
 *
 * Core utilities for deterministic ISL code generation.
 *
 * This package provides:
 * - Deterministic import sorting
 * - Topological type sorting
 * - Consistent code formatting
 * - Content hashing for change detection
 * - Code printer for building generated code
 *
 * @example
 * ```typescript
 * import {
 *   sortImports,
 *   topologicalSortTypes,
 *   formatCode,
 *   createPrinter,
 * } from '@isl-lang/codegen-core';
 *
 * // Sort imports
 * const sorted = sortImports(imports);
 *
 * // Sort types by dependency order
 * const orderedTypes = topologicalSortTypes(types);
 *
 * // Format code
 * const formatted = await formatCode(code, 'typescript');
 *
 * // Build code with printer
 * const printer = createPrinter();
 * printer.writeLine('export interface User {');
 * printer.indent();
 * printer.writeLine('id: string;');
 * printer.dedent();
 * printer.writeLine('}');
 * console.log(printer.toString());
 * ```
 */

// Types
export type {
  ImportStatement,
  NamedImport,
  ImportGroupConfig,
  TypeDeclaration,
  TopologicalSortConfig,
  Language,
  FormatConfig,
  GeneratedFile,
  HeaderConfig,
  CodePrinter,
} from './types.js';

export { DEFAULT_FORMAT_CONFIGS } from './types.js';

// Sorting utilities
export {
  classifyImport,
  sortImports,
  sortNamedImports,
  deduplicateImports,
  formatImports,
  topologicalSortTypes,
  sortProperties,
  type ImportGroup,
} from './sorter.js';

// Formatting utilities
export {
  formatCode,
  formatCodeSync,
  generateHeader,
  generateSectionComment,
  hashContent,
  createPrinter,
  toPascalCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toScreamingSnakeCase,
} from './formatter.js';
