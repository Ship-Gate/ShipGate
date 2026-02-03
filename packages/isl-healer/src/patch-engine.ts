/**
 * ISL Patch Engine
 *
 * Safe, idempotent patch application with unified diff generation.
 *
 * Constraints:
 * - Only touch files explicitly planned or allowed
 * - New files only for tests or shared helpers (configurable)
 * - Produces unified diff per iteration for proof bundle
 * - Running twice doesn't duplicate changes (idempotent)
 *
 * @module @isl-lang/healer
 */

import * as diff from 'diff';
import type { Span } from './types';

// ============================================================================
// Patch Types
// ============================================================================

/**
 * Base patch with common properties
 */
interface BasePatch {
  /** Target file path (relative to project root) */
  file: string;
  /** Human-readable description */
  description: string;
  /** Unique ID for idempotency tracking */
  id?: string;
}

/**
 * InsertImport - Add an import statement if not already present
 */
export interface InsertImportPatch extends BasePatch {
  type: 'InsertImport';
  /** Import specifier (e.g., "{ rateLimit }" or "* as utils") */
  specifier: string;
  /** Module path (e.g., "@/lib/rate-limit" or "zod") */
  from: string;
  /** Import type: 'named', 'default', 'namespace', 'type' */
  importType: 'named' | 'default' | 'namespace' | 'type';
}

/**
 * AddHelperFunction - Insert a helper function if not already defined
 */
export interface AddHelperFunctionPatch extends BasePatch {
  type: 'AddHelperFunction';
  /** Function name (used for idempotency check) */
  functionName: string;
  /** Full function code to insert */
  code: string;
  /** Where to insert: 'top' (after imports), 'bottom' (before exports), 'before:<symbol>' */
  position: 'top' | 'bottom' | `before:${string}` | `after:${string}`;
}

/**
 * WrapHandler - Wrap existing code block with prefix/suffix
 */
export interface WrapHandlerPatch extends BasePatch {
  type: 'WrapHandler';
  /** Target span to wrap */
  span: Span;
  /** Code to insert before the span */
  prefix: string;
  /** Code to insert after the span */
  suffix: string;
  /** Marker to check if already wrapped (for idempotency) */
  idempotencyMarker: string;
}

/**
 * ReplaceCall - Replace a function call or expression
 */
export interface ReplaceCallPatch extends BasePatch {
  type: 'ReplaceCall';
  /** Original code to find and replace */
  original: string;
  /** Replacement code */
  replacement: string;
  /** Whether to use regex matching */
  regex?: boolean;
  /** Replace all occurrences or just first */
  replaceAll?: boolean;
}

/**
 * CreateFile - Create a new file (tests only by default)
 */
export interface CreateFilePatch extends BasePatch {
  type: 'CreateFile';
  /** File content */
  content: string;
  /** File category: 'test', 'helper', 'config', 'other' */
  category: 'test' | 'helper' | 'config' | 'other';
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

// ============================================================================
// Engine Configuration
// ============================================================================

/**
 * Files that the engine is allowed to modify
 */
export interface AllowedFiles {
  /** Explicit file paths that can be modified */
  explicit: Set<string>;
  /** Glob patterns for allowed files */
  patterns: string[];
}

/**
 * Patch engine configuration
 */
export interface PatchEngineConfig {
  /** Project root directory */
  projectRoot: string;
  /** Files allowed to be modified */
  allowedFiles: AllowedFiles;
  /** Allow creating new test files */
  allowNewTestFiles: boolean;
  /** Allow creating new helper files */
  allowNewHelperFiles: boolean;
  /** Custom file categories allowed for CreateFile */
  allowedCategories: Set<CreateFilePatch['category']>;
  /** Dry run mode (don't write files) */
  dryRun: boolean;
  /** Verbose logging */
  verbose: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: PatchEngineConfig = {
  projectRoot: process.cwd(),
  allowedFiles: {
    explicit: new Set(),
    patterns: [],
  },
  allowNewTestFiles: true,
  allowNewHelperFiles: true,
  allowedCategories: new Set(['test', 'helper']),
  dryRun: false,
  verbose: false,
};

// ============================================================================
// Patch Application Result
// ============================================================================

/**
 * Result of applying a single patch
 */
export interface PatchApplicationResult {
  /** Patch that was applied */
  patch: Patch;
  /** Whether the patch was applied successfully */
  success: boolean;
  /** Whether the patch was skipped (already applied - idempotent) */
  skipped: boolean;
  /** Error message if failed */
  error?: string;
  /** Lines changed (positive = added, negative = removed) */
  linesChanged: number;
}

/**
 * Result of applying all patches
 */
export interface ApplyPatchesResult {
  /** Overall success (all patches applied or skipped) */
  success: boolean;
  /** Individual patch results */
  results: PatchApplicationResult[];
  /** Unified diff of all changes */
  unifiedDiff: string;
  /** Files that were modified */
  modifiedFiles: string[];
  /** Files that were created */
  createdFiles: string[];
  /** Total lines added */
  linesAdded: number;
  /** Total lines removed */
  linesRemoved: number;
  /** Patches that were skipped (idempotent) */
  skippedCount: number;
  /** Patches that failed */
  failedCount: number;
}

// ============================================================================
// Patch Engine Class
// ============================================================================

/**
 * Safe, idempotent patch engine for ISL healer
 */
export class PatchEngine {
  private config: PatchEngineConfig;
  private codeMap: Map<string, string>;
  private originalCodeMap: Map<string, string>;
  private appliedPatchIds: Set<string>;

  constructor(
    codeMap: Map<string, string>,
    config: Partial<PatchEngineConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.codeMap = new Map(codeMap);
    this.originalCodeMap = new Map(codeMap);
    this.appliedPatchIds = new Set();
  }

  /**
   * Apply multiple patches and return unified diff
   */
  applyPatches(patches: Patch[]): ApplyPatchesResult {
    const results: PatchApplicationResult[] = [];
    const modifiedFiles = new Set<string>();
    const createdFiles = new Set<string>();

    // Apply patches in order
    for (const patch of patches) {
      const result = this.applyPatch(patch);
      results.push(result);

      if (result.success && !result.skipped) {
        if (patch.type === 'CreateFile') {
          createdFiles.add(patch.file);
        } else {
          modifiedFiles.add(patch.file);
        }
      }
    }

    // Generate unified diff
    const unifiedDiff = this.generateUnifiedDiff();

    // Calculate statistics
    const { added, removed } = this.countLineChanges();
    const skippedCount = results.filter((r) => r.skipped).length;
    const failedCount = results.filter((r) => !r.success && !r.skipped).length;

    return {
      success: failedCount === 0,
      results,
      unifiedDiff,
      modifiedFiles: Array.from(modifiedFiles),
      createdFiles: Array.from(createdFiles),
      linesAdded: added,
      linesRemoved: removed,
      skippedCount,
      failedCount,
    };
  }

  /**
   * Apply a single patch
   */
  applyPatch(patch: Patch): PatchApplicationResult {
    // Generate patch ID for idempotency tracking
    const patchId = patch.id ?? this.generatePatchId(patch);

    // Check if already applied
    if (this.appliedPatchIds.has(patchId)) {
      return {
        patch,
        success: true,
        skipped: true,
        linesChanged: 0,
      };
    }

    // Validate file access
    const accessError = this.validateFileAccess(patch);
    if (accessError) {
      return {
        patch,
        success: false,
        skipped: false,
        error: accessError,
        linesChanged: 0,
      };
    }

    // Apply based on type
    let result: PatchApplicationResult;

    switch (patch.type) {
      case 'InsertImport':
        result = this.applyInsertImport(patch);
        break;
      case 'AddHelperFunction':
        result = this.applyAddHelperFunction(patch);
        break;
      case 'WrapHandler':
        result = this.applyWrapHandler(patch);
        break;
      case 'ReplaceCall':
        result = this.applyReplaceCall(patch);
        break;
      case 'CreateFile':
        result = this.applyCreateFile(patch);
        break;
      default:
        result = {
          patch,
          success: false,
          skipped: false,
          error: `Unknown patch type: ${(patch as Patch).type}`,
          linesChanged: 0,
        };
    }

    // Track applied patch ID
    if (result.success && !result.skipped) {
      this.appliedPatchIds.add(patchId);
    }

    return result;
  }

  /**
   * Get the current code map (after patches)
   */
  getCodeMap(): Map<string, string> {
    return new Map(this.codeMap);
  }

  /**
   * Get unified diff of all changes
   */
  generateUnifiedDiff(): string {
    const diffs: string[] = [];

    // Changed files
    for (const [file, newContent] of this.codeMap) {
      const originalContent = this.originalCodeMap.get(file) ?? '';
      if (newContent !== originalContent) {
        const fileDiff = diff.createPatch(
          file,
          originalContent,
          newContent,
          'original',
          'patched'
        );
        diffs.push(fileDiff);
      }
    }

    // New files
    for (const [file, content] of this.codeMap) {
      if (!this.originalCodeMap.has(file)) {
        const fileDiff = diff.createPatch(file, '', content, '', 'new');
        diffs.push(fileDiff);
      }
    }

    return diffs.join('\n');
  }

  // ============================================================================
  // Private: Patch Application Methods
  // ============================================================================

  private applyInsertImport(patch: InsertImportPatch): PatchApplicationResult {
    const code = this.codeMap.get(patch.file);
    if (code === undefined) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `File not found: ${patch.file}`,
        linesChanged: 0,
      };
    }

    // Check if import already exists (idempotency)
    const importStatement = this.buildImportStatement(patch);
    const importPattern = this.buildImportPattern(patch);

    if (importPattern.test(code)) {
      return {
        patch,
        success: true,
        skipped: true,
        linesChanged: 0,
      };
    }

    // Find the best insertion point (after existing imports)
    const lines = code.split('\n');
    let insertIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      // Track last import line
      if (
        /^\s*import\s/.test(line) ||
        /^\s*\/\/.*import/i.test(line) ||
        /^\s*$/.test(line) && insertIndex > 0
      ) {
        // Continue past imports and blank lines following imports
        if (/^\s*import\s/.test(line)) {
          insertIndex = i + 1;
        }
      } else if (insertIndex > 0 && !/^\s*$/.test(line)) {
        // Non-import, non-blank line after imports
        break;
      }
    }

    // Insert the import
    lines.splice(insertIndex, 0, importStatement);
    this.codeMap.set(patch.file, lines.join('\n'));

    return {
      patch,
      success: true,
      skipped: false,
      linesChanged: 1,
    };
  }

  private applyAddHelperFunction(
    patch: AddHelperFunctionPatch
  ): PatchApplicationResult {
    const code = this.codeMap.get(patch.file);
    if (code === undefined) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `File not found: ${patch.file}`,
        linesChanged: 0,
      };
    }

    // Check if function already exists (idempotency)
    const functionPattern = new RegExp(
      `(function\\s+${patch.functionName}\\s*\\(|const\\s+${patch.functionName}\\s*=|let\\s+${patch.functionName}\\s*=)`,
      'm'
    );

    if (functionPattern.test(code)) {
      return {
        patch,
        success: true,
        skipped: true,
        linesChanged: 0,
      };
    }

    const lines = code.split('\n');
    let insertIndex: number;

    if (patch.position === 'top') {
      // After imports
      insertIndex = this.findAfterImports(lines);
    } else if (patch.position === 'bottom') {
      // Before exports or at end
      insertIndex = this.findBeforeExports(lines);
    } else if (patch.position.startsWith('before:')) {
      const symbol = patch.position.slice(7);
      insertIndex = this.findSymbolLine(lines, symbol);
      if (insertIndex === -1) insertIndex = this.findBeforeExports(lines);
    } else if (patch.position.startsWith('after:')) {
      const symbol = patch.position.slice(6);
      const symbolLine = this.findSymbolLine(lines, symbol);
      insertIndex =
        symbolLine === -1
          ? this.findBeforeExports(lines)
          : this.findEndOfBlock(lines, symbolLine);
    } else {
      insertIndex = this.findBeforeExports(lines);
    }

    // Insert the function with blank line separation
    const codeLines = patch.code.split('\n');
    lines.splice(insertIndex, 0, '', ...codeLines, '');
    this.codeMap.set(patch.file, lines.join('\n'));

    return {
      patch,
      success: true,
      skipped: false,
      linesChanged: codeLines.length + 2,
    };
  }

  private applyWrapHandler(patch: WrapHandlerPatch): PatchApplicationResult {
    const code = this.codeMap.get(patch.file);
    if (code === undefined) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `File not found: ${patch.file}`,
        linesChanged: 0,
      };
    }

    // Check idempotency marker
    if (code.includes(patch.idempotencyMarker)) {
      return {
        patch,
        success: true,
        skipped: true,
        linesChanged: 0,
      };
    }

    const lines = code.split('\n');
    const startLine = patch.span.startLine - 1; // Convert to 0-indexed
    const endLine = patch.span.endLine - 1;

    if (startLine < 0 || endLine >= lines.length) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `Span out of range: ${patch.span.startLine}-${patch.span.endLine}`,
        linesChanged: 0,
      };
    }

    // Get indentation from the start line
    const indent = lines[startLine]!.match(/^(\s*)/)?.[1] ?? '';

    // Insert prefix before start and suffix after end
    const prefixLines = patch.prefix
      .split('\n')
      .map((l) => (l.trim() ? indent + l : l));
    const suffixLines = patch.suffix
      .split('\n')
      .map((l) => (l.trim() ? indent + l : l));

    // Apply: insert suffix after endLine, then prefix before startLine
    // (Do suffix first to preserve line numbers for prefix insertion)
    lines.splice(endLine + 1, 0, ...suffixLines);
    lines.splice(startLine, 0, ...prefixLines);

    this.codeMap.set(patch.file, lines.join('\n'));

    return {
      patch,
      success: true,
      skipped: false,
      linesChanged: prefixLines.length + suffixLines.length,
    };
  }

  private applyReplaceCall(patch: ReplaceCallPatch): PatchApplicationResult {
    const code = this.codeMap.get(patch.file);
    if (code === undefined) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `File not found: ${patch.file}`,
        linesChanged: 0,
      };
    }

    // Check if replacement is already present (idempotency)
    if (code.includes(patch.replacement) && !code.includes(patch.original)) {
      return {
        patch,
        success: true,
        skipped: true,
        linesChanged: 0,
      };
    }

    let newCode: string;
    let matchCount = 0;

    if (patch.regex) {
      const regex = new RegExp(
        patch.original,
        patch.replaceAll ? 'gm' : 'm'
      );
      matchCount = (code.match(regex) ?? []).length;
      newCode = code.replace(regex, patch.replacement);
    } else {
      if (patch.replaceAll) {
        const parts = code.split(patch.original);
        matchCount = parts.length - 1;
        newCode = parts.join(patch.replacement);
      } else {
        matchCount = code.includes(patch.original) ? 1 : 0;
        newCode = code.replace(patch.original, patch.replacement);
      }
    }

    if (matchCount === 0) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `Pattern not found: ${patch.original.slice(0, 50)}...`,
        linesChanged: 0,
      };
    }

    this.codeMap.set(patch.file, newCode);

    // Estimate line changes
    const oldLines = code.split('\n').length;
    const newLines = newCode.split('\n').length;

    return {
      patch,
      success: true,
      skipped: false,
      linesChanged: Math.abs(newLines - oldLines),
    };
  }

  private applyCreateFile(patch: CreateFilePatch): PatchApplicationResult {
    // Check category permissions
    if (!this.config.allowedCategories.has(patch.category)) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `File category '${patch.category}' not allowed`,
        linesChanged: 0,
      };
    }

    // Check if file already exists (idempotency)
    if (this.codeMap.has(patch.file)) {
      const existingContent = this.codeMap.get(patch.file)!;
      // If content is identical, skip
      if (existingContent === patch.content) {
        return {
          patch,
          success: true,
          skipped: true,
          linesChanged: 0,
        };
      }
      // If file exists with different content, fail
      return {
        patch,
        success: false,
        skipped: false,
        error: `File already exists with different content: ${patch.file}`,
        linesChanged: 0,
      };
    }

    // Category-specific checks
    if (patch.category === 'test' && !this.config.allowNewTestFiles) {
      return {
        patch,
        success: false,
        skipped: false,
        error: 'Creating test files is not allowed',
        linesChanged: 0,
      };
    }

    if (patch.category === 'helper' && !this.config.allowNewHelperFiles) {
      return {
        patch,
        success: false,
        skipped: false,
        error: 'Creating helper files is not allowed',
        linesChanged: 0,
      };
    }

    // Create the file
    this.codeMap.set(patch.file, patch.content);

    return {
      patch,
      success: true,
      skipped: false,
      linesChanged: patch.content.split('\n').length,
    };
  }

  // ============================================================================
  // Private: Validation
  // ============================================================================

  private validateFileAccess(patch: Patch): string | null {
    // CreateFile has its own permission checks
    if (patch.type === 'CreateFile') {
      return null;
    }

    const file = patch.file;

    // Check explicit allow list
    if (this.config.allowedFiles.explicit.size > 0) {
      if (!this.config.allowedFiles.explicit.has(file)) {
        return `File not in allowed list: ${file}`;
      }
    }

    // Check if file exists in code map
    if (!this.codeMap.has(file)) {
      return `File not found in code map: ${file}`;
    }

    return null;
  }

  // ============================================================================
  // Private: Helpers
  // ============================================================================

  private generatePatchId(patch: Patch): string {
    const base = `${patch.type}:${patch.file}`;

    switch (patch.type) {
      case 'InsertImport':
        return `${base}:import:${patch.from}:${patch.specifier}`;
      case 'AddHelperFunction':
        return `${base}:func:${patch.functionName}`;
      case 'WrapHandler':
        return `${base}:wrap:${patch.span.startLine}-${patch.span.endLine}`;
      case 'ReplaceCall':
        return `${base}:replace:${this.hashString(patch.original)}`;
      case 'CreateFile':
        return `${base}:create`;
      default:
        return base;
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  private buildImportStatement(patch: InsertImportPatch): string {
    switch (patch.importType) {
      case 'named':
        return `import ${patch.specifier} from '${patch.from}';`;
      case 'default':
        return `import ${patch.specifier} from '${patch.from}';`;
      case 'namespace':
        return `import ${patch.specifier} from '${patch.from}';`;
      case 'type':
        return `import type ${patch.specifier} from '${patch.from}';`;
      default:
        return `import ${patch.specifier} from '${patch.from}';`;
    }
  }

  private buildImportPattern(patch: InsertImportPatch): RegExp {
    const escapedFrom = patch.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedSpecifier = patch.specifier.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

    // Match various import styles
    return new RegExp(
      `import\\s+(type\\s+)?.*${escapedSpecifier}.*from\\s+['"]${escapedFrom}['"]`,
      'm'
    );
  }

  private findAfterImports(lines: string[]): number {
    let lastImportLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (/^\s*import\s/.test(line)) {
        lastImportLine = i + 1;
      } else if (
        lastImportLine > 0 &&
        !/^\s*$/.test(line) &&
        !/^\s*\/\//.test(line)
      ) {
        break;
      }
    }

    return lastImportLine;
  }

  private findBeforeExports(lines: string[]): number {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]!;
      if (/^\s*export\s+(default\s+)?/.test(line)) {
        return i;
      }
    }
    return lines.length;
  }

  private findSymbolLine(lines: string[], symbol: string): number {
    const pattern = new RegExp(
      `(function\\s+${symbol}|const\\s+${symbol}|let\\s+${symbol}|class\\s+${symbol}|export\\s+(default\\s+)?(function|const|let|class)\\s+${symbol})`
    );

    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i]!)) {
        return i;
      }
    }
    return -1;
  }

  private findEndOfBlock(lines: string[], startLine: number): number {
    let braceCount = 0;
    let started = false;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i]!;

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          started = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      if (started && braceCount === 0) {
        return i + 1;
      }
    }

    return lines.length;
  }

  private countLineChanges(): { added: number; removed: number } {
    let added = 0;
    let removed = 0;

    for (const [file, newContent] of this.codeMap) {
      const originalContent = this.originalCodeMap.get(file) ?? '';
      const changes = diff.diffLines(originalContent, newContent);

      for (const change of changes) {
        if (change.added) {
          added += change.count ?? 0;
        } else if (change.removed) {
          removed += change.count ?? 0;
        }
      }
    }

    return { added, removed };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a patch engine with sensible defaults
 */
export function createPatchEngine(
  codeMap: Map<string, string>,
  options?: Partial<PatchEngineConfig>
): PatchEngine {
  return new PatchEngine(codeMap, options);
}

/**
 * Convenience: Apply patches and return result
 */
export function applyPatches(
  codeMap: Map<string, string>,
  patches: Patch[],
  options?: Partial<PatchEngineConfig>
): ApplyPatchesResult {
  const engine = createPatchEngine(codeMap, options);
  return engine.applyPatches(patches);
}

// ============================================================================
// Patch Builder Helpers
// ============================================================================

/**
 * Create an InsertImport patch
 */
export function insertImport(
  file: string,
  specifier: string,
  from: string,
  options: {
    importType?: InsertImportPatch['importType'];
    description?: string;
  } = {}
): InsertImportPatch {
  return {
    type: 'InsertImport',
    file,
    specifier,
    from,
    importType: options.importType ?? 'named',
    description: options.description ?? `Import ${specifier} from ${from}`,
  };
}

/**
 * Create an AddHelperFunction patch
 */
export function addHelperFunction(
  file: string,
  functionName: string,
  code: string,
  options: {
    position?: AddHelperFunctionPatch['position'];
    description?: string;
  } = {}
): AddHelperFunctionPatch {
  return {
    type: 'AddHelperFunction',
    file,
    functionName,
    code,
    position: options.position ?? 'top',
    description: options.description ?? `Add helper function ${functionName}`,
  };
}

/**
 * Create a WrapHandler patch
 */
export function wrapHandler(
  file: string,
  span: Span,
  prefix: string,
  suffix: string,
  options: {
    idempotencyMarker?: string;
    description?: string;
  } = {}
): WrapHandlerPatch {
  return {
    type: 'WrapHandler',
    file,
    span,
    prefix,
    suffix,
    idempotencyMarker:
      options.idempotencyMarker ?? `/* wrapped:${span.startLine}-${span.endLine} */`,
    description: options.description ?? `Wrap handler at lines ${span.startLine}-${span.endLine}`,
  };
}

/**
 * Create a ReplaceCall patch
 */
export function replaceCall(
  file: string,
  original: string,
  replacement: string,
  options: {
    regex?: boolean;
    replaceAll?: boolean;
    description?: string;
  } = {}
): ReplaceCallPatch {
  return {
    type: 'ReplaceCall',
    file,
    original,
    replacement,
    regex: options.regex,
    replaceAll: options.replaceAll,
    description:
      options.description ??
      `Replace ${original.slice(0, 30)}... with ${replacement.slice(0, 30)}...`,
  };
}

/**
 * Create a CreateFile patch
 */
export function createFile(
  file: string,
  content: string,
  options: {
    category?: CreateFilePatch['category'];
    description?: string;
  } = {}
): CreateFilePatch {
  return {
    type: 'CreateFile',
    file,
    content,
    category: options.category ?? 'test',
    description: options.description ?? `Create file ${file}`,
  };
}
