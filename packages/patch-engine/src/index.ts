/**
 * @isl-lang/patch-engine
 *
 * Safe, idempotent patch application engine for code transformations.
 *
 * Features:
 * - Idempotency: Running patches twice doesn't duplicate changes
 * - Safety: Only touches explicitly allowed files
 * - Auditability: Returns unified diff for proof bundles
 *
 * Patch Types:
 * - InsertImport: Add import statements (idempotent by import check)
 * - AddHelperFunction: Add helper functions (idempotent by function name)
 * - WrapHandler: Wrap functions with prefix/suffix (idempotent by marker)
 * - ReplaceCall: Replace function calls (idempotent by replacement check)
 * - CreateFile: Create new files (tests/helpers only by default)
 *
 * @module @isl-lang/patch-engine
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Core types
  Span,
  BasePatch,
  Patch,
  PatchType,

  // Specific patch types
  InsertImportPatch,
  AddHelperFunctionPatch,
  WrapHandlerPatch,
  ReplaceCallPatch,
  CreateFilePatch,

  // Result types
  SinglePatchResult,
  PatchResult,

  // Configuration types
  PatchEngineOptions,
  FileContext,
  AllowedFileCategory,

  // Validation types
  PatchValidationResult,
  PreflightResult,
} from './types.js';

// ============================================================================
// Type Guards
// ============================================================================

export {
  isInsertImportPatch,
  isAddHelperFunctionPatch,
  isWrapHandlerPatch,
  isReplaceCallPatch,
  isCreateFilePatch,
} from './types.js';

// ============================================================================
// Engine Exports
// ============================================================================

export { PatchEngine, applyPatches, preflightPatches } from './engine.js';

// ============================================================================
// Patch Builders (Convenience Functions)
// ============================================================================

import type {
  InsertImportPatch,
  AddHelperFunctionPatch,
  WrapHandlerPatch,
  ReplaceCallPatch,
  CreateFilePatch,
} from './types.js';

/**
 * Create an InsertImport patch
 */
export function insertImport(
  file: string,
  importStatement: string,
  options?: {
    description?: string;
    moduleSpecifier?: string;
    importedNames?: string[];
    importKind?: 'named' | 'default' | 'namespace' | 'side-effect';
  }
): InsertImportPatch {
  return {
    type: 'InsertImport',
    file,
    importStatement,
    description: options?.description ?? `Import from ${importStatement.match(/from\s+['"]([^'"]+)['"]/)?.[1] ?? 'module'}`,
    moduleSpecifier: options?.moduleSpecifier,
    importedNames: options?.importedNames,
    importKind: options?.importKind,
  };
}

/**
 * Create an AddHelperFunction patch
 */
export function addHelperFunction(
  file: string,
  functionName: string,
  functionCode: string,
  options?: {
    description?: string;
    position?: 'top' | 'bottom' | number;
    exported?: boolean;
  }
): AddHelperFunctionPatch {
  return {
    type: 'AddHelperFunction',
    file,
    functionName,
    functionCode,
    position: options?.position ?? 'top',
    description: options?.description ?? `Add helper function '${functionName}'`,
    exported: options?.exported,
  };
}

/**
 * Create a WrapHandler patch
 */
export function wrapHandler(
  file: string,
  targetFunction: string,
  wrapPrefix: string,
  options?: {
    description?: string;
    wrapSuffix?: string;
    wrapMarker?: string;
    targetPattern?: string | RegExp;
  }
): WrapHandlerPatch {
  return {
    type: 'WrapHandler',
    file,
    targetFunction,
    wrapPrefix,
    wrapSuffix: options?.wrapSuffix,
    wrapMarker: options?.wrapMarker,
    targetPattern: options?.targetPattern,
    description: options?.description ?? `Wrap handler '${targetFunction}'`,
  };
}

/**
 * Create a ReplaceCall patch
 */
export function replaceCall(
  file: string,
  original: string,
  replacement: string,
  options?: {
    description?: string;
    isRegex?: boolean;
    scope?: 'first' | 'all' | number;
  }
): ReplaceCallPatch {
  return {
    type: 'ReplaceCall',
    file,
    original,
    replacement,
    description: options?.description ?? `Replace '${original.slice(0, 30)}...'`,
    isRegex: options?.isRegex,
    scope: options?.scope ?? 'first',
  };
}

/**
 * Create a CreateFile patch
 */
export function createFile(
  file: string,
  contents: string,
  category: 'test' | 'helper' | 'config',
  options?: {
    description?: string;
    overwrite?: boolean;
  }
): CreateFilePatch {
  return {
    type: 'CreateFile',
    file,
    contents,
    category,
    description: options?.description ?? `Create ${category} file '${file}'`,
    overwrite: options?.overwrite ?? false,
  };
}
