/**
 * Patch Engine Types
 *
 * Type definitions for safe, idempotent patch application.
 *
 * @module @isl-lang/patch-engine
 */

// ============================================================================
// Core Span Type
// ============================================================================

/**
 * Source span in a file (1-indexed)
 */
export interface Span {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

// ============================================================================
// Patch Types
// ============================================================================

/**
 * Base patch interface - all patches must have these properties
 */
export interface BasePatch {
  /** Target file path (relative to project root) */
  file: string;
  /** Human-readable description */
  description: string;
  /** Unique identifier for idempotency checking */
  idempotencyKey?: string;
}

/**
 * Insert an import statement at the top of a file
 *
 * Idempotency: Checks if import already exists (exact or equivalent)
 */
export interface InsertImportPatch extends BasePatch {
  type: 'InsertImport';
  /** The full import statement (e.g., "import { foo } from 'bar'") */
  importStatement: string;
  /** Import kind for detection */
  importKind?: 'named' | 'default' | 'namespace' | 'side-effect';
  /** Module specifier for duplicate detection */
  moduleSpecifier?: string;
  /** Imported names for duplicate detection */
  importedNames?: string[];
}

/**
 * Add a helper function to a file
 *
 * Idempotency: Checks if function with same name already exists
 */
export interface AddHelperFunctionPatch extends BasePatch {
  type: 'AddHelperFunction';
  /** Function name for idempotency checking */
  functionName: string;
  /** Full function code */
  functionCode: string;
  /** Where to insert: 'top' (after imports), 'bottom' (before exports), or specific line */
  position: 'top' | 'bottom' | number;
  /** Whether the function should be exported */
  exported?: boolean;
}

/**
 * Wrap an existing handler/function with additional logic
 *
 * Idempotency: Checks if wrapper pattern already exists
 */
export interface WrapHandlerPatch extends BasePatch {
  type: 'WrapHandler';
  /** Target function/handler to wrap */
  targetFunction: string;
  /** Pattern to match the function (regex or exact) */
  targetPattern?: string | RegExp;
  /** Code to insert before the handler body */
  wrapPrefix: string;
  /** Code to insert after the handler body (optional) */
  wrapSuffix?: string;
  /** Marker for idempotency checking */
  wrapMarker?: string;
  /** Span of the target function (if known) */
  targetSpan?: Span;
}

/**
 * Replace a function call or expression
 *
 * Idempotency: Checks if replacement already exists
 */
export interface ReplaceCallPatch extends BasePatch {
  type: 'ReplaceCall';
  /** Original code to find */
  original: string;
  /** Replacement code */
  replacement: string;
  /** Whether original is a regex pattern */
  isRegex?: boolean;
  /** Scope: 'first', 'all', or specific line */
  scope?: 'first' | 'all' | number;
}

/**
 * Create a new file (tests/helpers only by default)
 *
 * Idempotency: Checks if file already exists with same content
 */
export interface CreateFilePatch extends BasePatch {
  type: 'CreateFile';
  /** File contents */
  contents: string;
  /** File category for safety checks */
  category: 'test' | 'helper' | 'config';
  /** Overwrite if exists (default: false) */
  overwrite?: boolean;
}

/**
 * Union of all patch types
 */
export type Patch =
  | InsertImportPatch
  | AddHelperFunctionPatch
  | WrapHandlerPatch
  | ReplaceCallPatch
  | CreateFilePatch;

/**
 * Patch type discriminator
 */
export type PatchType = Patch['type'];

// ============================================================================
// Patch Application Result Types
// ============================================================================

/**
 * Result of applying a single patch
 */
export interface SinglePatchResult {
  /** The patch that was applied */
  patch: Patch;
  /** Whether the patch was applied successfully */
  success: boolean;
  /** Whether the patch was skipped (already applied) */
  skipped: boolean;
  /** Error message if failed */
  error?: string;
  /** Lines changed (positive = added, negative = removed) */
  linesChanged: number;
}

/**
 * Result of applying multiple patches
 */
export interface PatchResult {
  /** Overall success (all patches applied or skipped) */
  success: boolean;
  /** Updated file contents map */
  files: Map<string, string>;
  /** Results for each patch */
  patchResults: SinglePatchResult[];
  /** Applied patches (not skipped) */
  appliedPatches: Patch[];
  /** Skipped patches (already applied / idempotent) */
  skippedPatches: Patch[];
  /** Failed patches */
  failedPatches: Array<{ patch: Patch; reason: string }>;
  /** Unified diff for all changes */
  diff: string;
  /** Per-file diffs */
  fileDiffs: Map<string, string>;
  /** Timestamp */
  timestamp: string;
}

// ============================================================================
// Engine Configuration Types
// ============================================================================

/**
 * Allowed file categories for CreateFile patches
 */
export type AllowedFileCategory = 'test' | 'helper' | 'config' | 'all';

/**
 * Patch engine options
 */
export interface PatchEngineOptions {
  /** Project root directory */
  projectRoot: string;
  /** Allowed file categories for new files (default: ['test', 'helper']) */
  allowedNewFileCategories?: AllowedFileCategory[];
  /** Files explicitly allowed to be modified */
  allowedFiles?: string[];
  /** Patterns for files that can be modified (glob) */
  allowedFilePatterns?: string[];
  /** Enable strict mode (fail on any error) */
  strictMode?: boolean;
  /** Custom indentation (default: auto-detect or '  ') */
  indentation?: string;
  /** Dry run mode (don't write files) */
  dryRun?: boolean;
  /** Verbose logging */
  verbose?: boolean;
}

/**
 * File context for patch application
 */
export interface FileContext {
  /** File path */
  path: string;
  /** Original content */
  originalContent: string;
  /** Current content (after patches) */
  currentContent: string;
  /** Lines (split for manipulation) */
  lines: string[];
  /** Detected indentation */
  indentation: string;
  /** Whether file has been modified */
  modified: boolean;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Patch validation result
 */
export interface PatchValidationResult {
  /** Whether the patch is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Pre-flight check result
 */
export interface PreflightResult {
  /** Whether all checks pass */
  ok: boolean;
  /** Files that will be modified */
  filesToModify: string[];
  /** Files that will be created */
  filesToCreate: string[];
  /** Patches that will be skipped (idempotent) */
  willSkip: Patch[];
  /** Validation errors */
  errors: Array<{ patch: Patch; error: string }>;
  /** Warnings */
  warnings: Array<{ patch: Patch; warning: string }>;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isInsertImportPatch(patch: Patch): patch is InsertImportPatch {
  return patch.type === 'InsertImport';
}

export function isAddHelperFunctionPatch(patch: Patch): patch is AddHelperFunctionPatch {
  return patch.type === 'AddHelperFunction';
}

export function isWrapHandlerPatch(patch: Patch): patch is WrapHandlerPatch {
  return patch.type === 'WrapHandler';
}

export function isReplaceCallPatch(patch: Patch): patch is ReplaceCallPatch {
  return patch.type === 'ReplaceCall';
}

export function isCreateFilePatch(patch: Patch): patch is CreateFilePatch {
  return patch.type === 'CreateFile';
}
