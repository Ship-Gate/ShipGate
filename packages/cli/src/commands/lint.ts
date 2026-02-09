/**
 * Lint Command
 * 
 * Lint ISL files for best practices and common issues.
 * Includes semantic analysis passes for deeper code inspection.
 * Usage: isl lint <file>
 */

import { readFile, access } from 'fs/promises';
import { resolve, relative } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parse as parseISL } from '@isl-lang/parser';
import type { Domain as DomainDeclaration, Behavior, Entity, Import as ImportDeclaration } from '@isl-lang/parser';
import { output, type DiagnosticError } from '../output.js';
import { ExitCode } from '../exit-codes.js';
import { findSimilarFiles, formatCount } from '../utils.js';
import {
  PassRunner,
  builtinPasses,
  buildTypeEnvironment,
  type AnalysisResult,
} from '@isl-lang/semantic-analysis';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LintOptions {
  /** Verbose output */
  verbose?: boolean;
  /** Output format */
  format?: 'pretty' | 'json' | 'quiet';
  /** Treat warnings as errors */
  strict?: boolean;
  /** Enable semantic analysis passes (default: true) */
  semantic?: boolean;
  /** Specific semantic passes to run */
  semanticPasses?: string[];
  /** Semantic passes to skip */
  skipPasses?: string[];
  /** Include hint-level diagnostics */
  includeHints?: boolean;
}

export interface LintIssue {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  suggestion?: string;
  fix?: LintFix;
}

export interface LintFix {
  description: string;
  edits: LintEdit[];
}

export interface LintEdit {
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  newText: string;
}

export interface LintResult {
  success: boolean;
  file: string;
  issues: LintIssue[];
  stats: {
    errors: number;
    warnings: number;
    info: number;
    semanticErrors: number;
    semanticWarnings: number;
    semanticHints: number;
  };
  duration: number;
  semanticResult?: AnalysisResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lint Rules Framework
// ─────────────────────────────────────────────────────────────────────────────

type LintRule = {
  id: string;
  name: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
  check: (domain: DomainDeclaration, filePath: string, source: string) => LintIssue[];
};

const LINT_RULES: LintRule[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // Rule 1: Unused Symbols
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'unused-symbols',
    name: 'Unused Symbols',
    description: 'Detects entities, types, enums, and behaviors that are declared but never referenced',
    severity: 'warning',
    check: (domain, filePath, source) => {
      const issues: LintIssue[] = [];
      const referenced = collectReferencedSymbols(domain);
      
      // Check unused entities
      for (const entity of domain.entities || []) {
        if (!referenced.entities.has(entity.name.name)) {
          issues.push({
            rule: 'unused-symbols',
            severity: 'warning',
            message: `Entity '${entity.name.name}' is declared but never referenced`,
            file: filePath,
            line: entity.name.location?.line,
            column: entity.name.location?.column,
            suggestion: 'Remove unused entity or add references to it',
          });
        }
      }
      
      // Check unused types
      for (const type of domain.types || []) {
        if (!referenced.types.has(type.name.name)) {
          issues.push({
            rule: 'unused-symbols',
            severity: 'warning',
            message: `Type '${type.name.name}' is declared but never used`,
            file: filePath,
            line: type.name.location?.line,
            column: type.name.location?.column,
            suggestion: 'Remove unused type or use it in entity fields or behavior inputs/outputs',
          });
        }
      }
      
      // Check unused enums (enums are in types with EnumType definition)
      for (const type of domain.types || []) {
        if (type.definition.kind === 'EnumType' && !referenced.enums.has(type.name.name)) {
          issues.push({
            rule: 'unused-symbols',
            severity: 'warning',
            message: `Enum '${type.name.name}' is declared but never used`,
            file: filePath,
            line: type.name.location?.line,
            column: type.name.location?.column,
            suggestion: 'Remove unused enum or use it in entity fields',
          });
        }
      }
      
      // Check unused behaviors
      for (const behavior of domain.behaviors || []) {
        if (!referenced.behaviors.has(behavior.name.name)) {
          issues.push({
            rule: 'unused-symbols',
            severity: 'info',
            message: `Behavior '${behavior.name.name}' is declared but never referenced`,
            file: filePath,
            line: behavior.name.location?.line,
            column: behavior.name.location?.column,
            suggestion: 'Consider removing if truly unused, or ensure it is called',
          });
        }
      }
      
      return issues;
    },
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Rule 2: Duplicate Behaviors
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'duplicate-behaviors',
    name: 'Duplicate Behaviors',
    description: 'Detects behaviors with duplicate names in the same domain',
    severity: 'error',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      const behaviorNames = new Map<string, BehaviorDeclaration[]>();
      
      for (const behavior of domain.behaviors || []) {
        const name = behavior.name.name;
        if (!behaviorNames.has(name)) {
          behaviorNames.set(name, []);
        }
        behaviorNames.get(name)!.push(behavior);
      }
      
      for (const [name, behaviors] of behaviorNames.entries()) {
        if (behaviors.length > 1) {
          for (let i = 1; i < behaviors.length; i++) {
            issues.push({
              rule: 'duplicate-behaviors',
              severity: 'error',
              message: `Duplicate behavior '${name}' (first declared at line ${behaviors[0]!.span?.start?.line})`,
              file: filePath,
              line: behaviors[i]!.span?.start?.line,
              column: behaviors[i]!.span?.start?.column,
              suggestion: `Rename or remove duplicate behavior '${name}'`,
            });
          }
        }
      }
      
      return issues;
    },
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Rule 3: Overly-Broad Invariants
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'overly-broad-invariants',
    name: 'Overly-Broad Invariants',
    description: 'Detects invariants that are too generic (e.g., "true", "x == x")',
    severity: 'warning',
    check: (domain, filePath, source) => {
      const issues: LintIssue[] = [];
      
      // Check domain-level invariants
      for (const invBlock of domain.invariants || []) {
        for (const pred of invBlock.predicates || []) {
          const expr = extractExpressionText(pred, source);
          if (isOverlyBroad(expr)) {
            issues.push({
              rule: 'overly-broad-invariants',
              severity: 'warning',
              message: `Invariant is overly broad: "${expr}"`,
              file: filePath,
              line: invBlock.location?.line,
              column: invBlock.location?.column,
              suggestion: 'Make invariants more specific and meaningful',
            });
          }
        }
      }
      
      // Check behavior-level invariants
      for (const behavior of domain.behaviors || []) {
        if (behavior.invariants && Array.isArray(behavior.invariants)) {
          for (const inv of behavior.invariants) {
            const expr = extractExpressionText(inv, source);
            if (isOverlyBroad(expr)) {
              issues.push({
                rule: 'overly-broad-invariants',
                severity: 'warning',
                message: `Invariant on behavior '${behavior.name.name}' is overly broad: "${expr}"`,
                file: filePath,
                line: behavior.location?.line,
                column: behavior.location?.column,
                suggestion: 'Make invariants more specific and meaningful',
              });
            }
          }
        }
      }
      
      return issues;
    },
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Rule 4: Ambiguous Imports
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'ambiguous-imports',
    name: 'Ambiguous Imports',
    description: 'Detects imports that could resolve to multiple symbols',
    severity: 'warning',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      const importedNames = new Map<string, string[]>(); // name -> [sources]
      
      // Collect all imported names
      for (const importDecl of domain.imports || []) {
        for (const name of importDecl.names || []) {
          const symbolName = name.name;
          if (!importedNames.has(symbolName)) {
            importedNames.set(symbolName, []);
          }
          importedNames.get(symbolName)!.push(importDecl.from.value);
        }
      }
      
      // Check for ambiguous imports (same name from different sources)
      for (const [name, sources] of importedNames.entries()) {
        const uniqueSources = [...new Set(sources)];
        if (uniqueSources.length > 1) {
          issues.push({
            rule: 'ambiguous-imports',
            severity: 'warning',
            message: `Symbol '${name}' is imported from multiple sources: ${uniqueSources.join(', ')}`,
            file: filePath,
            suggestion: `Use aliases to disambiguate: import { ${name} as ${name}From${uniqueSources[0]!.split('/').pop()} } from "${uniqueSources[0]}"`,
          });
        }
      }
      
      return issues;
    },
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Rule 5: Unreachable Constraints
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'unreachable-constraints',
    name: 'Unreachable Constraints',
    description: 'Detects postconditions that can never be satisfied due to preconditions',
    severity: 'warning',
    check: (domain, filePath, source) => {
      const issues: LintIssue[] = [];
      
      for (const behavior of domain.behaviors || []) {
        if (!behavior.preconditions || !behavior.postconditions) continue;
        
        const preExprs = extractConditionExpressions(behavior.preconditions, source);
        const postExprs = extractConditionExpressions(behavior.postconditions, source);
        
        // Simple check: if postcondition contradicts precondition
        for (const postExpr of postExprs) {
          for (const preExpr of preExprs) {
            if (contradicts(preExpr, postExpr)) {
              issues.push({
                rule: 'unreachable-constraints',
                severity: 'warning',
                message: `Behavior '${behavior.name.name}' has unreachable postcondition "${postExpr}" due to precondition "${preExpr}"`,
                file: filePath,
                line: behavior.postconditions.span?.start?.line,
                column: behavior.postconditions.span?.start?.column,
                suggestion: 'Review preconditions and postconditions for logical consistency',
              });
            }
          }
        }
      }
      
      return issues;
    },
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Rule 6: Missing Preconditions
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'missing-preconditions',
    name: 'Missing Preconditions',
    description: 'Behaviors should have preconditions to specify valid inputs',
    severity: 'warning',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      
      for (const behavior of domain.behaviors || []) {
        if (!behavior.preconditions || 
            (Array.isArray(behavior.preconditions) && behavior.preconditions.length === 0)) {
          issues.push({
            rule: 'missing-preconditions',
            severity: 'warning',
            message: `Behavior '${behavior.name.name}' has no preconditions`,
            file: filePath,
            line: behavior.name.location?.line,
            column: behavior.name.location?.column,
            suggestion: 'Add preconditions to specify valid input constraints',
          });
        }
      }
      
      return issues;
    },
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Rule 7: Unused Imports
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'unused-imports',
    name: 'Unused Imports',
    description: 'Detects imported symbols that are never used',
    severity: 'warning',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      const referenced = collectReferencedSymbols(domain);
      
      for (const importDecl of domain.imports || []) {
        for (const name of importDecl.names || []) {
          const symbolName = name.name;
          // Check if imported symbol is used
          if (!referenced.entities.has(symbolName) &&
              !referenced.types.has(symbolName) &&
              !referenced.enums.has(symbolName)) {
            issues.push({
              rule: 'unused-imports',
              severity: 'warning',
              message: `Imported symbol '${symbolName}' from "${importDecl.from.value}" is never used`,
              file: filePath,
              line: name.span?.start?.line,
              column: name.span?.start?.column,
              suggestion: `Remove unused import '${symbolName}'`,
            });
          }
        }
      }
      
      return issues;
    },
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Rule 8: Missing Error Handling
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'missing-error-handling',
    name: 'Missing Error Handling',
    description: 'Behaviors should define error outputs for failure cases',
    severity: 'info',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      
      for (const behavior of domain.behaviors || []) {
        if (behavior.output && (!behavior.output.errors || behavior.output.errors.length === 0)) {
          issues.push({
            rule: 'missing-error-handling',
            severity: 'info',
            message: `Behavior '${behavior.name.name}' has no error outputs defined`,
            file: filePath,
            line: behavior.output.location?.line,
            column: behavior.output.location?.column,
            suggestion: 'Consider adding error outputs for failure cases',
          });
        }
      }
      
      return issues;
    },
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Rule 9: Circular Dependencies
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'circular-dependencies',
    name: 'Circular Dependencies',
    description: 'Detects circular import dependencies',
    severity: 'error',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      const importGraph = new Map<string, Set<string>>();
      const visited = new Set<string>();
      const recursionStack = new Set<string>();
      
      // Build import graph
      for (const importDecl of domain.imports || []) {
        const from = importDecl.from.value;
        if (!importGraph.has(filePath)) {
          importGraph.set(filePath, new Set());
        }
        importGraph.get(filePath)!.add(from);
      }
      
      // Detect cycles (simplified - would need full resolution for real check)
      // This is a basic check for same-file circular references
      const hasSelfReference = importGraph.get(filePath)?.has(filePath);
      if (hasSelfReference) {
        issues.push({
          rule: 'circular-dependencies',
          severity: 'error',
          message: 'Circular import detected (file imports itself)',
          file: filePath,
          suggestion: 'Remove self-referential imports',
        });
      }
      
      return issues;
    },
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Rule 10: Inconsistent Naming
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'inconsistent-naming',
    name: 'Inconsistent Naming',
    description: 'Detects inconsistent naming conventions (PascalCase vs camelCase)',
    severity: 'info',
    check: (domain, filePath) => {
      const issues: LintIssue[] = [];
      const pascalCase = /^[A-Z][a-zA-Z0-9]*$/;
      const camelCase = /^[a-z][a-zA-Z0-9]*$/;
      
      // Check entity names
      for (const entity of domain.entities || []) {
        if (!pascalCase.test(entity.name.name)) {
          issues.push({
            rule: 'inconsistent-naming',
            severity: 'info',
            message: `Entity '${entity.name.name}' should be PascalCase`,
            file: filePath,
            line: entity.name.location?.line,
            column: entity.name.location?.column,
            suggestion: `Rename to '${toPascalCase(entity.name.name)}'`,
          });
        }
      }
      
      // Check behavior names
      for (const behavior of domain.behaviors || []) {
        if (!pascalCase.test(behavior.name.name)) {
          issues.push({
            rule: 'inconsistent-naming',
            severity: 'info',
            message: `Behavior '${behavior.name.name}' should be PascalCase`,
            file: filePath,
            line: behavior.name.location?.line,
            column: behavior.name.location?.column,
            suggestion: `Rename to '${toPascalCase(behavior.name.name)}'`,
          });
        }
      }
      
      // Check field names
      for (const entity of domain.entities || []) {
        if (entity.fields) {
          for (const field of entity.fields) {
            if (!camelCase.test(field.name.name) && field.name.name !== 'ID') {
              issues.push({
                rule: 'inconsistent-naming',
                severity: 'info',
                message: `Field '${field.name.name}' in entity '${entity.name.name}' should be camelCase`,
                file: filePath,
                line: field.name.location?.line,
                column: field.name.location?.column,
                suggestion: `Rename to '${toCamelCase(field.name.name)}'`,
              });
            }
          }
        }
      }
      
      return issues;
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function toPascalCase(str: string): string {
  return str.replace(/(?:^|[-_\s])(\w)/g, (_, c) => c.toUpperCase());
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Symbol Collection Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ReferencedSymbols {
  entities: Set<string>;
  types: Set<string>;
  enums: Set<string>;
  behaviors: Set<string>;
  fields: Map<string, Set<string>>; // entity -> fields
}

function collectReferencedSymbols(domain: DomainDeclaration): ReferencedSymbols {
  const result: ReferencedSymbols = {
    entities: new Set(),
    types: new Set(),
    enums: new Set(),
    behaviors: new Set(),
    fields: new Map(),
  };

  // Walk through all behaviors to find references
  for (const behavior of domain.behaviors || []) {
    // Input/output types reference entities/types
    if (behavior.input) {
      for (const field of behavior.input.fields || []) {
        collectTypeReferences(field.type, result);
      }
    }
    if (behavior.output) {
      collectTypeReferences(behavior.output.success, result);
    }

    // Expressions in conditions reference fields/entities
    if (behavior.preconditions) {
      collectExpressionReferences(behavior.preconditions, result);
    }
    if (behavior.postconditions) {
      collectExpressionReferences(behavior.postconditions, result);
    }
    if (behavior.invariants && Array.isArray(behavior.invariants)) {
      for (const inv of behavior.invariants) {
        collectExpressionReferences(inv, result);
      }
    }
  }

  // Entity fields can reference other entities
  for (const entity of domain.entities || []) {
    if (entity.fields && Array.isArray(entity.fields)) {
      for (const field of entity.fields) {
        collectTypeReferences(field.type, result);
      }
    }
  }

  return result;
}

function collectTypeReferences(type: unknown, refs: ReferencedSymbols): void {
  if (!type || typeof type !== 'object') return;
  
  const t = type as Record<string, unknown>;
  
  // ReferenceType: references entities/types
  if (t.kind === 'ReferenceType') {
    const name = t.name as { name?: string } | string | undefined;
    if (name) {
      const nameStr = typeof name === 'string' ? name : name.name;
      if (nameStr) {
        refs.types.add(nameStr);
        refs.entities.add(nameStr); // Could be either, add to both
      }
    }
  }
  
  // PrimitiveType: built-in types, skip
  if (t.kind === 'PrimitiveType') {
    return;
  }
  
  // EnumType: has variants
  if (t.kind === 'EnumType' && Array.isArray(t.variants)) {
    for (const variant of t.variants) {
      const v = variant as { name?: { name?: string } };
      if (v.name?.name) {
        refs.enums.add(v.name.name);
      }
    }
  }
  
  // StructType: has fields
  if (t.kind === 'StructType' && Array.isArray(t.fields)) {
    for (const field of t.fields) {
      const f = field as { type?: unknown };
      if (f.type) {
        collectTypeReferences(f.type, refs);
      }
    }
  }
  
  // UnionType: has variants
  if (t.kind === 'UnionType' && Array.isArray(t.variants)) {
    for (const variant of t.variants) {
      const v = variant as { fields?: Array<{ type?: unknown }> };
      if (v.fields) {
        for (const field of v.fields) {
          if (field.type) {
            collectTypeReferences(field.type, refs);
          }
        }
      }
    }
  }
  
  // ListType: has element
  if (t.kind === 'ListType' && t.element) {
    collectTypeReferences(t.element, refs);
  }
  
  // MapType: has key and value
  if (t.kind === 'MapType') {
    if (t.key) collectTypeReferences(t.key, refs);
    if (t.value) collectTypeReferences(t.value, refs);
  }
  
  // OptionalType: has inner
  if (t.kind === 'OptionalType' && t.inner) {
    collectTypeReferences(t.inner, refs);
  }
  
  // ConstrainedType: has base
  if (t.kind === 'ConstrainedType' && t.base) {
    collectTypeReferences(t.base, refs);
  }
}

function collectExpressionReferences(block: unknown, refs: ReferencedSymbols): void {
  if (!block || typeof block !== 'object') return;
  
  walkObject(block, (node) => {
    if (typeof node !== 'object' || !node) return;
    
    const n = node as Record<string, unknown>;
    
    // Member expressions like Entity.field
    if (n.kind === 'MemberExpression') {
      const obj = n.object as { name?: string };
      const prop = n.property as { name?: string };
      if (obj?.name && prop?.name) {
        if (!refs.fields.has(obj.name)) {
          refs.fields.set(obj.name, new Set());
        }
        refs.fields.get(obj.name)!.add(prop.name);
        refs.entities.add(obj.name);
      }
    }
    
    // Call expressions like User.lookup(id)
    if (n.kind === 'CallExpression') {
      const callee = n.callee as { object?: { name?: string }; name?: string };
      if (callee?.object?.name) {
        refs.entities.add(callee.object.name);
      }
      if (callee?.name) {
        refs.behaviors.add(callee.name);
      }
    }
    
    // Identifier references
    if (n.kind === 'Identifier' && n.name) {
      const name = n.name as string;
      // Could be entity, type, enum, or behavior reference
      refs.entities.add(name);
      refs.types.add(name);
      refs.enums.add(name);
    }
  });
}

function walkObject(obj: unknown, visitor: (node: unknown) => void): void {
  if (!obj || typeof obj !== 'object') return;
  
  visitor(obj);
  
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        walkObject(item, visitor);
      }
    } else if (value && typeof value === 'object') {
      walkObject(value, visitor);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Invariant Analysis Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractExpressionText(expr: unknown, source: string): string {
  if (!expr || typeof expr !== 'object') return '';
  
  const exprObj = expr as { location?: { line?: number; column?: number; endLine?: number; endColumn?: number } };
  if (exprObj.location) {
    const lines = source.split('\n');
    const startLine = (exprObj.location.line ?? 1) - 1;
    const endLine = (exprObj.location.endLine ?? exprObj.location.line ?? 1) - 1;
    if (startLine >= 0 && endLine < lines.length) {
      if (startLine === endLine) {
        const startCol = exprObj.location.column ?? 0;
        const endCol = exprObj.location.endColumn ?? lines[startLine]!.length;
        return lines[startLine]!.substring(startCol, endCol).trim();
      }
      return lines.slice(startLine, endLine + 1).join(' ').trim();
    }
  }
  return '';
}

function isOverlyBroad(expr: string): boolean {
  const normalized = expr.trim().toLowerCase();
  
  // Check for tautologies
  if (normalized === 'true' || normalized === '1' || normalized === '1 == 1') {
    return true;
  }
  
  // Check for self-referential equality (x == x)
  const selfEqMatch = normalized.match(/^(\w+)\s*==\s*\1$/);
  if (selfEqMatch) {
    return true;
  }
  
  // Check for overly generic patterns
  if (normalized.length < 5) {
    return true; // Very short expressions are likely too generic
  }
  
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constraint Analysis Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractConditionExpressions(block: unknown, source: string): string[] {
  const exprs: string[] = [];
  
  if (!block || typeof block !== 'object') return exprs;
  
  const b = block as { conditions?: Array<{ statements?: Array<{ expression?: unknown }> }> };
  
  if (Array.isArray(b.conditions)) {
    for (const cond of b.conditions) {
      if (Array.isArray(cond.statements)) {
        for (const stmt of cond.statements) {
          if (stmt.expression) {
            const expr = extractExpressionText(stmt.expression, source);
            if (expr) exprs.push(expr);
          }
        }
      }
    }
  }
  
  return exprs;
}

function extractExpressionText(expr: unknown, source: string): string {
  if (expr && typeof expr === 'object') {
    const exprObj = expr as { span?: { start?: { line?: number; column?: number }; end?: { line?: number; column?: number } } };
    if (exprObj.span && exprObj.span.start && exprObj.span.end) {
      const lines = source.split('\n');
      const startLine = (exprObj.span.start.line ?? 1) - 1;
      const endLine = (exprObj.span.end.line ?? 1) - 1;
      if (startLine >= 0 && endLine < lines.length) {
        if (startLine === endLine) {
          return lines[startLine]!.substring(exprObj.span.start.column ?? 0, exprObj.span.end.column ?? lines[startLine]!.length).trim();
        }
        return lines.slice(startLine, endLine + 1).join(' ').trim();
      }
    }
  }
  return '';
}

function contradicts(preExpr: string, postExpr: string): boolean {
  // Simple contradiction detection
  // Check if postExpr negates preExpr
  
  const pre = preExpr.toLowerCase().trim();
  const post = postExpr.toLowerCase().trim();
  
  // Check for direct negation patterns
  if (pre.includes('==') && post.includes('!=')) {
    const preVar = pre.split('==')[0]?.trim();
    const postVar = post.split('!=')[0]?.trim();
    if (preVar === postVar) {
      return true;
    }
  }
  
  if (pre.includes('!=') && post.includes('==')) {
    const preVar = pre.split('!=')[0]?.trim();
    const postVar = post.split('==')[0]?.trim();
    if (preVar === postVar) {
      return true;
    }
  }
  
  // Check for boolean negation
  if (pre.startsWith('not ') && post === pre.substring(4)) {
    return true;
  }
  
  if (post.startsWith('not ') && pre === post.substring(4)) {
    return true;
  }
  
  return false;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Lint Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lint an ISL file for best practices
 */
export async function lint(file: string, options: LintOptions = {}): Promise<LintResult> {
  const startTime = Date.now();
  const filePath = resolve(file);
  const spinner = options.format !== 'json' ? ora('Linting ISL file...').start() : null;
  
  // Check if file exists
  if (!await fileExists(filePath)) {
    spinner?.fail(`File not found: ${file}`);
    
    const similar = await findSimilarFiles(filePath);
    if (similar.length > 0) {
      console.log('');
      console.log(chalk.gray('Did you mean:'));
      for (const s of similar) {
        console.log(chalk.gray(`  ${relative(process.cwd(), s)}`));
      }
    }
    
    return {
      success: false,
      file: filePath,
      issues: [{
        rule: 'file-not-found',
        severity: 'error',
        message: `File not found: ${file}`,
        file: filePath,
      }],
      stats: { errors: 1, warnings: 0, info: 0, semanticErrors: 0, semanticWarnings: 0, semanticHints: 0 },
      duration: Date.now() - startTime,
    };
  }
  
  try {
    const source = await readFile(filePath, 'utf-8');
    spinner && (spinner.text = 'Parsing...');
    
    const { domain: ast, errors: parseErrors } = parseISL(source, filePath);
    
    if (parseErrors.length > 0 || !ast) {
      spinner?.fail('Parse failed - cannot lint invalid ISL');
      return {
        success: false,
        file: filePath,
        issues: parseErrors.map(e => ({
          rule: 'parse-error',
          severity: 'error' as const,
          message: e.message,
          file: filePath,
          line: 'line' in e ? e.line : undefined,
          column: 'column' in e ? e.column : undefined,
        })),
        stats: { errors: parseErrors.length, warnings: 0, info: 0, semanticErrors: 0, semanticWarnings: 0, semanticHints: 0 },
        duration: Date.now() - startTime,
      };
    }
    
    // Run lint rules
    spinner && (spinner.text = 'Running lint rules...');
    const allIssues: LintIssue[] = [];
    
    for (const rule of LINT_RULES) {
      const issues = rule.check(ast, filePath, source);
      allIssues.push(...issues);
    }
    
    // Run semantic analysis passes if enabled (default: true)
    let semanticResult: AnalysisResult | undefined;
    const runSemantic = options.semantic !== false;
    
    if (runSemantic) {
      spinner && (spinner.text = 'Running semantic analysis...');
      
      try {
        const runner = new PassRunner({
          enablePasses: options.semanticPasses || [],
          disablePasses: options.skipPasses || [],
          includeHints: options.includeHints ?? false,
        });
        
        runner.registerAll(builtinPasses);
        
        const typeEnv = buildTypeEnvironment(ast);
        semanticResult = runner.run(ast, source, filePath, typeEnv);
        
        // Convert semantic diagnostics to LintIssues
        for (const diag of semanticResult.diagnostics) {
          allIssues.push({
            rule: `semantic:${diag.code}`,
            severity: diag.severity === 'error' ? 'error' : 
                      diag.severity === 'warning' ? 'warning' : 'info',
            message: diag.message,
            file: filePath,
            line: diag.location?.line,
            column: diag.location?.column,
            suggestion: diag.help?.[0],
          });
        }
      } catch (err) {
        // If semantic analysis fails, add as warning
        allIssues.push({
          rule: 'semantic:internal-error',
          severity: 'warning',
          message: `Semantic analysis failed: ${err instanceof Error ? err.message : String(err)}`,
          file: filePath,
        });
      }
    }
    
    // Calculate stats (separate lint and semantic)
    const lintErrors = allIssues.filter(i => i.severity === 'error' && !i.rule.startsWith('semantic:')).length;
    const lintWarnings = allIssues.filter(i => i.severity === 'warning' && !i.rule.startsWith('semantic:')).length;
    const lintInfo = allIssues.filter(i => i.severity === 'info' && !i.rule.startsWith('semantic:')).length;
    
    const semanticErrors = semanticResult?.stats.errorCount ?? 0;
    const semanticWarnings = semanticResult?.stats.warningCount ?? 0;
    const semanticHints = semanticResult?.stats.hintCount ?? 0;
    
    const stats = {
      errors: lintErrors + semanticErrors,
      warnings: lintWarnings + semanticWarnings,
      info: lintInfo + (options.includeHints ? semanticHints : 0),
      semanticErrors,
      semanticWarnings,
      semanticHints,
    };
    
    const duration = Date.now() - startTime;
    
    // Determine success
    const hasErrors = stats.errors > 0;
    const hasWarnings = stats.warnings > 0;
    const success = !hasErrors && (!options.strict || !hasWarnings);
    
    const totalIssues = stats.errors + stats.warnings;
    if (!success) {
      spinner?.fail(`Lint found ${formatCount(stats.errors, 'error')}, ${formatCount(stats.warnings, 'warning')}`);
    } else if (stats.warnings > 0 || stats.info > 0) {
      spinner?.warn(`Lint passed with ${formatCount(stats.warnings, 'warning')}, ${formatCount(stats.info, 'info issue')}`);
    } else {
      const semanticMsg = runSemantic ? ` (${semanticResult?.stats.passesRun ?? 0} semantic passes)` : '';
      spinner?.succeed(`Lint passed${semanticMsg} (${duration}ms)`);
    }
    
    return {
      success,
      file: filePath,
      issues: allIssues,
      stats,
      duration,
      semanticResult,
    };
  } catch (err) {
    spinner?.fail('Lint failed');
    
    return {
      success: false,
      file: filePath,
      issues: [{
        rule: 'internal-error',
        severity: 'error',
        message: err instanceof Error ? err.message : String(err),
        file: filePath,
      }],
      stats: { errors: 1, warnings: 0, info: 0, semanticErrors: 0, semanticWarnings: 0, semanticHints: 0 },
      duration: Date.now() - startTime,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print lint results to console
 */
export function printLintResult(result: LintResult, options?: LintOptions): void {
  // JSON output
  if (options?.format === 'json') {
    console.log(JSON.stringify({
      success: result.success,
      file: result.file,
      issues: result.issues,
      stats: result.stats,
      duration: result.duration,
    }, null, 2));
    return;
  }
  
  // Quiet output
  if (options?.format === 'quiet') {
    for (const issue of result.issues.filter(i => i.severity === 'error')) {
      const loc = issue.line ? `${issue.file}:${issue.line}:${issue.column ?? 0}` : issue.file;
      console.error(`${loc}: ${issue.message}`);
    }
    return;
  }
  
  console.log('');
  
  // Group issues by severity
  const errors = result.issues.filter(i => i.severity === 'error');
  const warnings = result.issues.filter(i => i.severity === 'warning');
  const infos = result.issues.filter(i => i.severity === 'info');
  
  const printIssue = (issue: LintIssue) => {
    const icon = issue.severity === 'error' ? chalk.red('✗')
      : issue.severity === 'warning' ? chalk.yellow('⚠')
      : chalk.blue('ℹ');
    
    const rule = chalk.gray(`[${issue.rule}]`);
    console.log(`  ${icon} ${issue.message} ${rule}`);
    
    if (issue.suggestion && options?.verbose) {
      console.log(chalk.gray(`    Suggestion: ${issue.suggestion}`));
    }
  };
  
  if (errors.length > 0) {
    console.log(chalk.bold.red('Errors:'));
    errors.forEach(printIssue);
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log(chalk.bold.yellow('Warnings:'));
    warnings.forEach(printIssue);
    console.log('');
  }
  
  if (infos.length > 0 && options?.verbose) {
    console.log(chalk.bold.blue('Info:'));
    infos.forEach(printIssue);
    console.log('');
  }
  
  // Summary
  const parts: string[] = [];
  if (result.stats.errors > 0) parts.push(chalk.red(`${result.stats.errors} error${result.stats.errors === 1 ? '' : 's'}`));
  if (result.stats.warnings > 0) parts.push(chalk.yellow(`${result.stats.warnings} warning${result.stats.warnings === 1 ? '' : 's'}`));
  if (result.stats.info > 0) parts.push(chalk.blue(`${result.stats.info} info`));
  
  if (parts.length > 0) {
    console.log(parts.join(', '));
  }
  
  // Show semantic analysis breakdown if verbose
  if (options?.verbose && result.semanticResult) {
    console.log('');
    console.log(chalk.gray('Semantic Analysis:'));
    console.log(chalk.gray(`  Passes run: ${result.semanticResult.stats.passesRun}/${result.semanticResult.stats.totalPasses}`));
    console.log(chalk.gray(`  Duration: ${result.semanticResult.stats.totalDurationMs}ms`));
    if (result.semanticResult.cacheInfo.enabled) {
      console.log(chalk.gray(`  Cache: ${result.semanticResult.cacheInfo.hits} hits, ${result.semanticResult.cacheInfo.misses} misses`));
    }
  }
  
  console.log(chalk.gray(`Completed in ${result.duration}ms`));
}

/**
 * Get exit code for lint result
 */
export function getLintExitCode(result: LintResult): number {
  if (result.success) return ExitCode.SUCCESS;
  
  if (result.issues.some(i => i.rule === 'file-not-found')) {
    return ExitCode.USAGE_ERROR;
  }
  
  return ExitCode.ISL_ERROR;
}

export default lint;
