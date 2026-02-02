/**
 * ISL Linter V2 - Auto-Fix System
 *
 * Provides functionality for applying AST patches to fix lint issues.
 */

import type { Domain, ASTNode } from '@isl-lang/parser';

import type { LintFix, ASTPatch, InsertPatch, ReplacePatch, RemovePatch, ModifyPatch, ApplyFixResult } from './types.js';

// ============================================================================
// Apply Fix
// ============================================================================

/**
 * Apply a fix to an AST, returning a new modified AST
 *
 * @param ast - The original AST to modify
 * @param fix - The fix to apply
 * @returns The result with modified AST or error
 *
 * @example
 * ```typescript
 * import { lint, applyFix } from '@isl-lang/core/isl-lint-v2';
 *
 * const result = lint(domain);
 * const diagnostic = result.diagnostics[0];
 *
 * if (diagnostic.fixes && diagnostic.fixes.length > 0) {
 *   const fixResult = applyFix(domain, diagnostic.fixes[0]);
 *   if (fixResult.success) {
 *     // Use fixResult.ast
 *   }
 * }
 * ```
 */
export function applyFix(ast: Domain, fix: LintFix): ApplyFixResult {
  // Deep clone the AST to avoid mutations
  const clonedAst = deepClone(ast);

  const appliedPatches: ASTPatch[] = [];
  const failedPatches: { patch: ASTPatch; reason: string }[] = [];

  // Apply patches in order
  for (const patch of fix.patches) {
    try {
      applyPatch(clonedAst, patch);
      appliedPatches.push(patch);
    } catch (error) {
      failedPatches.push({
        patch,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // If any patches failed, consider the fix failed
  if (failedPatches.length > 0) {
    return {
      success: false,
      error: `Failed to apply ${failedPatches.length} patch(es): ${failedPatches.map((f) => f.reason).join('; ')}`,
      appliedPatches,
      failedPatches,
    };
  }

  return {
    success: true,
    ast: clonedAst,
    appliedPatches,
    failedPatches: [],
  };
}

/**
 * Apply multiple fixes to an AST in sequence
 */
export function applyFixes(ast: Domain, fixes: LintFix[]): ApplyFixResult {
  let currentAst = deepClone(ast);
  const allAppliedPatches: ASTPatch[] = [];
  const allFailedPatches: { patch: ASTPatch; reason: string }[] = [];

  for (const fix of fixes) {
    const result = applyFix(currentAst, fix);

    allAppliedPatches.push(...result.appliedPatches);
    allFailedPatches.push(...result.failedPatches);

    if (result.success && result.ast) {
      currentAst = result.ast;
    }
  }

  if (allFailedPatches.length > 0) {
    return {
      success: false,
      ast: currentAst,
      error: `Failed to apply ${allFailedPatches.length} patch(es)`,
      appliedPatches: allAppliedPatches,
      failedPatches: allFailedPatches,
    };
  }

  return {
    success: true,
    ast: currentAst,
    appliedPatches: allAppliedPatches,
    failedPatches: [],
  };
}

/**
 * Get all automatically safe fixes from diagnostics
 */
export function getAutoFixableFixes(fixes: LintFix[]): LintFix[] {
  return fixes.filter((fix) => fix.isAutomaticallySafe).sort((a, b) => b.priority - a.priority);
}

// ============================================================================
// Patch Application
// ============================================================================

function applyPatch(ast: Domain, patch: ASTPatch): void {
  switch (patch.type) {
    case 'insert':
      applyInsertPatch(ast, patch);
      break;
    case 'replace':
      applyReplacePatch(ast, patch);
      break;
    case 'remove':
      applyRemovePatch(ast, patch);
      break;
    case 'modify':
      applyModifyPatch(ast, patch);
      break;
    default:
      throw new Error(`Unsupported patch type: ${(patch as ASTPatch).type}`);
  }
}

function applyInsertPatch(ast: Domain, patch: InsertPatch): void {
  const { parent, key, target } = resolveTargetPath(ast, patch.targetPath);

  if (Array.isArray(target)) {
    // Insert into array
    switch (patch.position) {
      case 'first':
        target.unshift(patch.node);
        break;
      case 'last':
        target.push(patch.node);
        break;
      case 'at_index':
        if (patch.index !== undefined) {
          target.splice(patch.index, 0, patch.node);
        } else {
          target.push(patch.node);
        }
        break;
      default:
        target.push(patch.node);
    }
  } else if (parent && key) {
    // Create array at target location
    (parent as Record<string, unknown>)[key] = [patch.node];
  } else {
    throw new Error(`Cannot insert at path: ${patch.targetPath}`);
  }
}

function applyReplacePatch(ast: Domain, patch: ReplacePatch): void {
  const { parent, key, target, index } = resolveTargetPath(ast, patch.targetPath);

  if (parent && key !== undefined) {
    let newNode = patch.newNode;

    // Preserve specified properties from old node
    if (patch.preserveProperties && target) {
      newNode = { ...newNode };
      for (const prop of patch.preserveProperties) {
        if (prop in (target as unknown as Record<string, unknown>)) {
          (newNode as unknown as Record<string, unknown>)[prop] = (target as unknown as Record<string, unknown>)[prop];
        }
      }
    }

    if (index !== undefined && Array.isArray((parent as Record<string, unknown>)[key])) {
      ((parent as Record<string, unknown>)[key] as unknown[])[index] = newNode;
    } else {
      (parent as Record<string, unknown>)[key] = newNode;
    }
  } else {
    throw new Error(`Cannot replace at path: ${patch.targetPath}`);
  }
}

function applyRemovePatch(ast: Domain, patch: RemovePatch): void {
  const { parent, key, target } = resolveTargetPath(ast, patch.targetPath);

  if (Array.isArray(target) && patch.index !== undefined) {
    target.splice(patch.index, 1);
  } else if (parent && key !== undefined) {
    if (Array.isArray((parent as Record<string, unknown>)[key]) && patch.index !== undefined) {
      ((parent as Record<string, unknown>)[key] as unknown[]).splice(patch.index, 1);
    } else {
      delete (parent as Record<string, unknown>)[key];
    }
  } else {
    throw new Error(`Cannot remove at path: ${patch.targetPath}`);
  }
}

function applyModifyPatch(ast: Domain, patch: ModifyPatch): void {
  const { target } = resolveTargetPath(ast, patch.targetPath);

  if (target && typeof target === 'object') {
    for (const [propKey, propValue] of Object.entries(patch.properties)) {
      if (propKey === 'push' && Array.isArray(target)) {
        target.push(propValue);
      } else {
        (target as unknown as Record<string, unknown>)[propKey] = propValue;
      }
    }
  } else {
    throw new Error(`Cannot modify at path: ${patch.targetPath}`);
  }
}

// ============================================================================
// Path Resolution
// ============================================================================

interface ResolveResult {
  parent: unknown;
  key: string | undefined;
  target: unknown;
  index?: number;
}

function resolveTargetPath(ast: Domain, path: string): ResolveResult {
  const segments = parsePath(path);
  let current: unknown = ast;
  let parent: unknown = null;
  let key: string | undefined = undefined;
  let index: number | undefined = undefined;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    parent = current;

    if (segment.type === 'property' && segment.name !== undefined) {
      key = segment.name;
      current = (current as Record<string, unknown>)?.[segment.name];
    } else if (segment.type === 'index' && segment.index !== undefined) {
      index = segment.index;
      current = (current as unknown[])?.[segment.index];
    }
  }

  return { parent, key, target: current, index };
}

interface PathSegment {
  type: 'property' | 'index';
  name?: string;
  index?: number;
}

function parsePath(path: string): PathSegment[] {
  const segments: PathSegment[] = [];
  const regex = /([a-zA-Z_][a-zA-Z0-9_]*)|\[(\d+)\]/g;
  let match;

  while ((match = regex.exec(path)) !== null) {
    if (match[1]) {
      segments.push({ type: 'property', name: match[1] });
    } else if (match[2]) {
      segments.push({ type: 'index', index: parseInt(match[2], 10) });
    }
  }

  return segments;
}

// ============================================================================
// Deep Clone
// ============================================================================

function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  const cloned: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
  }

  return cloned as T;
}

// ============================================================================
// Fix Suggestion Helpers
// ============================================================================

/**
 * Sort fixes by priority (highest first)
 */
export function sortFixesByPriority(fixes: LintFix[]): LintFix[] {
  return [...fixes].sort((a, b) => b.priority - a.priority);
}

/**
 * Filter fixes by category
 */
export function filterFixesByCategory(fixes: LintFix[], category: LintFix['category']): LintFix[] {
  return fixes.filter((fix) => fix.category === category);
}

/**
 * Get the best fix (highest priority, preferring safe fixes)
 */
export function getBestFix(fixes: LintFix[]): LintFix | undefined {
  if (fixes.length === 0) return undefined;

  const sorted = sortFixesByPriority(fixes);
  const safeFixes = sorted.filter((f) => f.isAutomaticallySafe);

  return safeFixes.length > 0 ? safeFixes[0] : sorted[0];
}

// ============================================================================
// Patch Factory Implementation
// ============================================================================

import type { PatchFactory } from './types.js';

export const patchFactory: PatchFactory = {
  insert(targetPath, node, position, description, index) {
    return {
      type: 'insert',
      targetPath,
      node,
      position,
      description,
      index,
    };
  },

  replace(targetPath, newNode, description, preserveProperties) {
    return {
      type: 'replace',
      targetPath,
      newNode,
      description,
      preserveProperties,
    };
  },

  remove(targetPath, description, index) {
    return {
      type: 'remove',
      targetPath,
      description,
      index,
    };
  },

  modify(targetPath, properties, description) {
    return {
      type: 'modify',
      targetPath,
      properties,
      description,
    };
  },
};

/**
 * Create a fix factory function
 */
export function createFixFactory(): (params: {
  id: string;
  title: string;
  description: string;
  patches: ASTPatch[];
  isAutomaticallySafe?: boolean;
  priority?: number;
  category?: LintFix['category'];
}) => LintFix {
  return (params) => ({
    id: params.id,
    title: params.title,
    description: params.description,
    patches: params.patches,
    isAutomaticallySafe: params.isAutomaticallySafe ?? false,
    priority: params.priority ?? 5,
    category: params.category ?? 'add-constraint',
  });
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that a fix is well-formed
 */
export function validateFix(fix: LintFix): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!fix.id) {
    errors.push('Fix must have an id');
  }

  if (!fix.title) {
    errors.push('Fix must have a title');
  }

  if (!fix.patches || fix.patches.length === 0) {
    errors.push('Fix must have at least one patch');
  }

  for (let i = 0; i < (fix.patches?.length ?? 0); i++) {
    const patch = fix.patches[i];
    if (!patch.type) {
      errors.push(`Patch ${i} must have a type`);
    }
    if (!patch.targetPath) {
      errors.push(`Patch ${i} must have a targetPath`);
    }
    if (patch.type === 'insert' && !(patch as InsertPatch).node) {
      errors.push(`Insert patch ${i} must have a node`);
    }
    if (patch.type === 'replace' && !(patch as ReplacePatch).newNode) {
      errors.push(`Replace patch ${i} must have a newNode`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Preview a patch without applying it
 */
export function previewPatch(
  ast: Domain,
  patch: ASTPatch
): {
  path: string;
  currentValue: unknown;
  proposedChange: string;
} {
  const { target } = resolveTargetPath(ast, patch.targetPath);

  let proposedChange: string;
  switch (patch.type) {
    case 'insert':
      proposedChange = `Insert ${(patch as InsertPatch).position} at ${patch.targetPath}`;
      break;
    case 'replace':
      proposedChange = `Replace value at ${patch.targetPath}`;
      break;
    case 'remove':
      proposedChange = `Remove ${patch.targetPath}${(patch as RemovePatch).index !== undefined ? `[${(patch as RemovePatch).index}]` : ''}`;
      break;
    case 'modify':
      proposedChange = `Modify properties at ${patch.targetPath}: ${Object.keys((patch as ModifyPatch).properties).join(', ')}`;
      break;
    default:
      proposedChange = `Unknown change at ${patch.targetPath}`;
  }

  return {
    path: patch.targetPath,
    currentValue: target,
    proposedChange,
  };
}
