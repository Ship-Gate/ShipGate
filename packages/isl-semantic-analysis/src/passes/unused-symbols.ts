/**
 * Unused Symbols Detection Pass
 * 
 * Detects:
 * - Unused input parameters in behaviors
 * - Unused output fields
 * - Unused entity fields
 * - Unused custom types
 */

import type { Diagnostic } from '@isl-lang/errors';
import type { DomainDeclaration, BehaviorDeclaration, Expression } from '@isl-lang/isl-core';
import type { EntityDeclaration } from '@isl-lang/isl-core/ast';
import type { SemanticPass, PassContext } from '../types.js';
import { spanToLocation } from '../types.js';

export const UnusedSymbolsPass: SemanticPass = {
  id: 'unused-symbols',
  name: 'Unused Symbols',
  description: 'Detects unused inputs, outputs, fields, and types',
  dependencies: [],
  priority: 90,
  enabledByDefault: true,

  run(ctx: PassContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { ast, filePath, typeEnv } = ctx;

    // Collect all referenced symbols
    const referenced = collectReferencedSymbols(ast);

    // Check behaviors for unused inputs/outputs
    for (const behavior of ast.behaviors || []) {
      diagnostics.push(...checkUnusedBehaviorSymbols(behavior, filePath));
    }

    // Check for unused entities
    for (const entity of ast.entities || []) {
      if (!referenced.entities.has(entity.name.name)) {
        diagnostics.push({
          code: 'E0320',
          category: 'semantic',
          severity: 'hint',
          message: `Entity '${entity.name.name}' is declared but never referenced`,
          location: spanToLocation((entity as { span?: unknown }).span ?? (entity as { location?: unknown }).location ?? (entity.name as { span?: unknown }).span, filePath),
          source: 'verifier',
          tags: ['unnecessary'],
          help: ['Consider removing unused entities or adding references to them'],
        });
      }

      // Check for unused fields within entities
      diagnostics.push(...checkUnusedEntityFields(entity as unknown as EntityDeclaration, ast as DomainDeclaration, filePath));
    }

    // Check for unused custom types
    for (const type of ast.types || []) {
      if (!referenced.types.has(type.name.name)) {
        diagnostics.push({
          code: 'E0321',
          category: 'semantic',
          severity: 'hint',
          message: `Type '${type.name.name}' is declared but never used`,
          location: spanToLocation((type as { span?: unknown }).span ?? (type as { location?: unknown }).location ?? (type.name as { span?: unknown }).span, filePath),
          source: 'verifier',
          tags: ['unnecessary'],
          help: ['Consider removing unused types'],
        });
      }
    }

    return diagnostics;
  },
};

/**
 * Convenience export for the pass instance
 */
export const unusedSymbolsPass = UnusedSymbolsPass;

// ============================================================================
// Symbol Collection
// ============================================================================

interface ReferencedSymbols {
  entities: Set<string>;
  types: Set<string>;
  enums: Set<string>;
  fields: Map<string, Set<string>>; // entity -> fields
}

function collectReferencedSymbols(ast: DomainDeclaration): ReferencedSymbols {
  const result: ReferencedSymbols = {
    entities: new Set(),
    types: new Set(),
    enums: new Set(),
    fields: new Map(),
  };

  // Walk through all behaviors to find references
  for (const behavior of ast.behaviors || []) {
    // Input/output types reference entities/types (input/output may be single object or array)
    const inputs = Array.isArray(behavior.input) ? behavior.input : (behavior.input ? [behavior.input] : []);
    const outputs = Array.isArray(behavior.output) ? behavior.output : (behavior.output ? [behavior.output] : []);
    for (const input of inputs) {
      collectTypeReferences((input as { type?: unknown }).type, result);
    }
    for (const output of outputs) {
      collectTypeReferences((output as { type?: unknown }).type, result);
    }

    // Expressions in conditions reference fields/entities
    collectExpressionReferences(behavior.preconditions, result);
    collectExpressionReferences(behavior.postconditions, result);
    collectExpressionReferences(behavior.invariants, result);
  }

  // Entity fields can reference other entities
  for (const entity of ast.entities || []) {
    for (const field of entity.fields || []) {
      collectTypeReferences(field.type, result);
    }
  }

  return result;
}

function collectTypeReferences(type: unknown, refs: ReferencedSymbols): void {
  if (!type || typeof type !== 'object') return;

  const t = type as { kind?: string; name?: { name: string }; params?: unknown[]; elementType?: unknown; types?: unknown[] };

  if (t.kind === 'SimpleType' && t.name) {
    // Could be an entity or custom type
    refs.entities.add(t.name.name);
    refs.types.add(t.name.name);
  }

  if (t.kind === 'GenericType') {
    if (t.name) refs.types.add(t.name.name);
    for (const param of t.params || []) {
      collectTypeReferences(param, refs);
    }
  }

  if (t.kind === 'ArrayType' && t.elementType) {
    collectTypeReferences(t.elementType, refs);
  }

  if (t.kind === 'UnionType') {
    for (const ut of t.types || []) {
      collectTypeReferences(ut, refs);
    }
  }
}

function collectExpressionReferences(block: unknown, refs: ReferencedSymbols): void {
  if (!block || typeof block !== 'object') return;

  // Walk the expression tree
  walkObject(block, (node) => {
    if (typeof node !== 'object' || !node) return;
    
    const n = node as { kind?: string; object?: { name?: string }; property?: { name?: string } };
    
    // Member expressions like Entity.field
    if (n.kind === 'MemberExpression' && n.object && n.property) {
      const entityName = n.object.name;
      const fieldName = n.property.name;
      if (entityName && fieldName) {
        if (!refs.fields.has(entityName)) {
          refs.fields.set(entityName, new Set());
        }
        refs.fields.get(entityName)!.add(fieldName);
        refs.entities.add(entityName);
      }
    }

    // Call expressions like User.lookup(id)
    if (n.kind === 'CallExpression') {
      const call = node as { callee?: { object?: { name?: string } } };
      if (call.callee?.object?.name) {
        refs.entities.add(call.callee.object.name);
      }
    }
  });
}

function walkObject(obj: unknown, visitor: (node: unknown) => void): void {
  if (!obj || typeof obj !== 'object') return;
  
  visitor(obj);
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      walkObject(item, visitor);
    }
  } else {
    for (const value of Object.values(obj)) {
      walkObject(value, visitor);
    }
  }
}

// ============================================================================
// Behavior Analysis
// ============================================================================

function checkUnusedBehaviorSymbols(
  behavior: BehaviorDeclaration,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Collect all identifiers used in the behavior body
  const usedIdentifiers = new Set<string>();
  
  collectIdentifiers(behavior.preconditions, usedIdentifiers);
  collectIdentifiers(behavior.postconditions, usedIdentifiers);
  collectIdentifiers(behavior.invariants, usedIdentifiers);
  collectIdentifiers(behavior.temporal, usedIdentifiers);
  collectIdentifiers(behavior.security, usedIdentifiers);

  // Check inputs — normalize InputBlock { fields: [...] } vs flat Field[]
  const inputBlock = behavior.input as unknown as { fields?: Array<{ name: { name: string }; span?: unknown; location?: unknown }> } | Array<{ name: { name: string }; span?: unknown; location?: unknown }> | undefined;
  const inputFields = inputBlock
    ? (Array.isArray(inputBlock) ? inputBlock : (inputBlock.fields || []))
    : [];
  for (const input of inputFields) {
    if (!input?.name?.name) continue;
    const name = input.name.name;
    if (!usedIdentifiers.has(name)) {
      diagnostics.push({
        code: 'E0322',
        category: 'semantic',
        severity: 'warning',
        message: `Input parameter '${name}' is never used in behavior '${behavior.name.name}'`,
        location: spanToLocation((input as { span?: unknown }).span || (input as { location?: unknown }).location || (input.name as unknown as { span?: unknown })?.span, filePath),
        source: 'verifier',
        tags: ['unnecessary'],
        help: [
          'Remove the unused parameter',
          'Or use it in a precondition or postcondition',
        ],
        fix: {
          title: `Remove unused input '${name}'`,
          edits: [],  // Would need source range for actual fix
          isPreferred: false,
        },
      });
    }
  }

  // Check outputs — normalize OutputBlock { success, errors } vs flat Field[]
  const outputBlock = behavior.output as unknown as { fields?: Array<{ name: { name: string } }>; success?: unknown; errors?: unknown[] } | Array<{ name: { name: string } }> | undefined;
  const outputFields = outputBlock
    ? (Array.isArray(outputBlock) ? outputBlock : (outputBlock.fields || []))
    : [];
  for (const output of outputFields) {
    if (!output?.name?.name) continue;
    const name = output.name.name;
    if (!usedIdentifiers.has(name)) {
      diagnostics.push({
        code: 'E0323',
        category: 'semantic',
        severity: 'warning',
        message: `Output '${name}' is declared but never constrained in behavior '${behavior.name.name}'`,
        location: spanToLocation((output as { span?: unknown }).span || (output as { location?: unknown }).location || (output.name as unknown as { span?: unknown })?.span, filePath),
        source: 'verifier',
        notes: ['Outputs should typically be constrained in postconditions'],
        help: [
          'Add a postcondition that defines the output value',
          'Or remove the output if not needed',
        ],
      });
    }
  }

  return diagnostics;
}

function collectIdentifiers(block: unknown, identifiers: Set<string>): void {
  if (!block || typeof block !== 'object') return;

  walkObject(block, (node) => {
    if (typeof node !== 'object' || !node) return;
    
    const n = node as { kind?: string; name?: string };
    if (n.kind === 'Identifier' && n.name) {
      identifiers.add(n.name);
    }
  });
}

// ============================================================================
// Entity Field Analysis
// ============================================================================

function checkUnusedEntityFields(
  entity: EntityDeclaration,
  ast: DomainDeclaration,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Collect fields used anywhere in the domain
  const usedFields = new Set<string>();
  
  for (const behavior of ast.behaviors || []) {
    collectFieldReferences(behavior, entity.name.name, usedFields);
  }

  // Check each field
  for (const field of entity.fields || []) {
    const name = field.name.name;
    
    // Skip common fields that are implicitly used
    if (isCommonImplicitField(name)) continue;

    if (!usedFields.has(name)) {
      diagnostics.push({
        code: 'E0324',
        category: 'semantic',
        severity: 'hint',
        message: `Field '${entity.name.name}.${name}' is declared but never referenced`,
        location: spanToLocation((field as { span?: unknown }).span ?? (field as { location?: unknown }).location ?? (field.name as { span?: unknown } | undefined)?.span, filePath),
        source: 'verifier',
        tags: ['unnecessary'],
        help: [
          'Remove the unused field',
          'Or add references to it in behaviors',
        ],
      });
    }
  }

  return diagnostics;
}

function collectFieldReferences(
  behavior: BehaviorDeclaration,
  entityName: string,
  usedFields: Set<string>
): void {
  walkObject(behavior, (node) => {
    if (typeof node !== 'object' || !node) return;
    
    const n = node as { 
      kind?: string; 
      object?: { kind?: string; name?: string }; 
      property?: { name?: string } 
    };
    
    if (n.kind === 'MemberExpression') {
      // Check for Entity.field pattern
      if (n.object?.kind === 'Identifier' && n.object.name === entityName) {
        if (n.property?.name) {
          usedFields.add(n.property.name);
        }
      }
    }
  });
}

function isCommonImplicitField(name: string): boolean {
  // These fields are commonly used implicitly (serialization, ORM, etc.)
  const implicitFields = new Set([
    'id', 'createdAt', 'updatedAt', 'version', 'deleted',
    'createdBy', 'updatedBy', 'tenantId',
  ]);
  return implicitFields.has(name);
}
