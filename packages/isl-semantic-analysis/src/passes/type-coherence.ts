/**
 * Type Coherence Pass
 * 
 * Validates type-level semantic constraints:
 * - Type consistency across references
 * - Generic type parameter validation
 * - Constraint satisfaction checks
 * - Type narrowing coherence
 * 
 * @module @isl-lang/semantic-analysis
 */

import type { Diagnostic } from '@isl-lang/errors';
import type { DomainDeclaration, BehaviorDeclaration, Expression } from '@isl-lang/isl-core';
import type { EntityDeclaration } from '@isl-lang/isl-core/ast';
import type { SemanticPass, PassContext, TypeInfo } from '../types.js';
import { spanToLocation } from '../types.js';

// ============================================================================
// Pass Definition
// ============================================================================

export const TypeCoherencePass: SemanticPass = {
  id: 'type-coherence',
  name: 'Type Coherence',
  description: 'Validates type-level semantic constraints and consistency',
  dependencies: [],
  priority: 60,
  enabledByDefault: true,

  run(ctx: PassContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { ast, filePath, typeEnv } = ctx;

    // Check entity type coherence (ast.entities may be parser Entity[]; cast for span)
    for (const entity of ast.entities || []) {
      diagnostics.push(...checkEntityTypeCoherence(entity as unknown as EntityDeclaration, ast as DomainDeclaration, filePath, typeEnv));
    }

    // Check behavior type coherence
    for (const behavior of ast.behaviors || []) {
      diagnostics.push(...checkBehaviorTypeCoherence(behavior, ast, filePath, typeEnv));
    }

    // Check for type shadowing
    diagnostics.push(...checkTypeShadowing(ast, filePath));

    // Check generic type parameter usage
    diagnostics.push(...checkGenericTypeUsage(ast, filePath));

    return diagnostics;
  },
};

/**
 * Convenience export for the pass instance
 */
export const typeCoherencePass = TypeCoherencePass;

// ============================================================================
// Entity Type Coherence
// ============================================================================

function checkEntityTypeCoherence(
  entity: EntityDeclaration,
  ast: DomainDeclaration,
  filePath: string,
  typeEnv: PassContext['typeEnv']
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Check for fields with incompatible types in constraints
  for (const field of entity.fields || []) {
    const fieldType = extractTypeName(field.type);
    const constraints = extractConstraints(field.type);

    // Check numeric constraints on non-numeric types
    if (fieldType && !isNumericType(fieldType)) {
      for (const constraint of constraints) {
        if (constraint.kind === 'min' || constraint.kind === 'max') {
          if (typeof constraint.value === 'number') {
            diagnostics.push({
              code: 'E0340',
              category: 'semantic',
              severity: 'error',
              message: `Numeric constraint '${constraint.kind}' is not valid for type '${fieldType}'`,
              location: spanToLocation((field as { span?: unknown }).span, filePath),
              source: 'verifier',
              notes: [
                `Field '${field.name.name}' in entity '${entity.name.name}'`,
                `min/max constraints are only valid for numeric types (Int, Float, Decimal)`,
              ],
              help: [
                'Use a numeric type for this field',
                'Or use length/minLength/maxLength for strings',
              ],
            });
          }
        }
      }
    }

    // Check pattern constraints on non-string types
    if (fieldType && !isStringType(fieldType)) {
      for (const constraint of constraints) {
        if (constraint.kind === 'pattern') {
          diagnostics.push({
            code: 'E0341',
            category: 'semantic',
            severity: 'error',
            message: `Pattern constraint is not valid for type '${fieldType}'`,
            location: spanToLocation(field.span, filePath),
            source: 'verifier',
            notes: [
              `Field '${field.name.name}' in entity '${entity.name.name}'`,
              'Pattern constraints are only valid for String types',
            ],
            help: [
              'Use String type for regex pattern validation',
              'Or use enum constraint for specific values',
            ],
          });
        }
      }
    }

    // Check for contradictory constraints (e.g., min > max)
    const minConstraint = constraints.find(c => c.kind === 'min');
    const maxConstraint = constraints.find(c => c.kind === 'max');
    
    if (minConstraint && maxConstraint) {
      const min = minConstraint.value;
      const max = maxConstraint.value;
      
      if (typeof min === 'number' && typeof max === 'number' && min > max) {
        diagnostics.push({
          code: 'E0342',
          category: 'semantic',
          severity: 'error',
          message: `Contradictory constraints: min (${min}) is greater than max (${max})`,
          location: spanToLocation(field.span, filePath),
          source: 'verifier',
          notes: [
            `Field '${field.name.name}' in entity '${entity.name.name}'`,
            'No value can satisfy both constraints',
          ],
          help: [
            'Swap min and max values',
            `min: ${max}, max: ${min}`,
          ],
          fix: {
            title: 'Swap min and max constraints',
            edits: [],
            isPreferred: true,
          },
        });
      }
    }
  }

  // Check for circular entity references
  const referencedEntities = collectEntityReferences(entity);
  for (const refName of referencedEntities) {
    const refEntity = ast.entities?.find(e => e.name.name === refName);
    if (refEntity) {
      const backRefs = collectEntityReferences(refEntity as unknown as EntityDeclaration);
      if (backRefs.has(entity.name.name)) {
        // This is a bidirectional reference - check if it's intentional
        const hasBidirectionalAnnotation = checkForBidirectionalAnnotation(entity as unknown as EntityDeclaration, refName);
        if (!hasBidirectionalAnnotation) {
          diagnostics.push({
            code: 'E0343',
            category: 'semantic',
            severity: 'hint',
            message: `Bidirectional reference between '${entity.name.name}' and '${refName}'`,
            location: spanToLocation((entity as { span?: unknown }).span, filePath),
            source: 'verifier',
            notes: [
              'Bidirectional entity references can cause serialization issues',
              'Consider using @bidirectional annotation if intentional',
            ],
            help: [
              'Add @bidirectional annotation to indicate this is intentional',
              'Or restructure to use one-way references',
            ],
          });
        }
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// Behavior Type Coherence
// ============================================================================

function checkBehaviorTypeCoherence(
  behavior: BehaviorDeclaration,
  ast: DomainDeclaration,
  filePath: string,
  typeEnv: PassContext['typeEnv']
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Check input types — normalize InputBlock { fields: [...] } vs flat Field[]
  const inputBlock = behavior.input as unknown as { fields?: unknown[] } | unknown[] | undefined;
  const inputs = inputBlock
    ? (Array.isArray(inputBlock) ? inputBlock : ((inputBlock as { fields?: unknown[] }).fields || []))
    : [];
  for (const input of inputs) {
    const inp = input as { name?: { name: string }; type?: unknown; span?: unknown };
    if (!inp?.name?.name) continue;
    const typeName = extractTypeName(inp.type);
    
    // Check for optional types in required contexts
    if (isOptionalType(inp.type) && hasRequiredAnnotation(inp)) {
      diagnostics.push({
        code: 'E0344',
        category: 'semantic',
        severity: 'warning',
        message: `Input '${inp.name.name}' is marked optional but has @required annotation`,
        location: spanToLocation(inp.span, filePath),
        source: 'verifier',
        notes: [
          `In behavior '${behavior.name.name}'`,
          'Optional type (?) conflicts with @required annotation',
        ],
        help: [
          'Remove the optional marker (?)',
          'Or remove the @required annotation',
        ],
      });
    }
  }

  // Check postcondition type coherence
  if (behavior.postconditions) {
    const postBlock = behavior.postconditions as { conditions?: Array<{ expression?: Expression }> };
    for (const condition of postBlock.conditions || []) {
      if (condition.expression) {
        diagnostics.push(...checkExpressionTypeCoherence(
          condition.expression,
          behavior,
          filePath
        ));
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// Expression Type Coherence
// ============================================================================

function checkExpressionTypeCoherence(
  expr: Expression,
  behavior: BehaviorDeclaration,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const kind = (expr as { kind?: string }).kind ?? '';
  if (kind === 'BinaryExpression' || kind === 'ComparisonExpression' || kind === 'BinaryExpr' || kind === 'ComparisonExpr') {
    const binary = expr as {
      left: Expression;
      operator: string;
      right: Expression;
      span?: { start: { line: number; column: number; offset: number }; end: { line: number; column: number; offset: number } };
    };

    // Check for string comparisons with numeric operators
    if (binary.operator === '<' || binary.operator === '>' || 
        binary.operator === '<=' || binary.operator === '>=') {
      const leftType = inferExpressionType(binary.left);
      const rightType = inferExpressionType(binary.right);

      if ((leftType === 'String' || rightType === 'String') && 
          (leftType !== rightType)) {
        if (binary.span) {
          diagnostics.push({
            code: 'E0345',
            category: 'semantic',
            severity: 'warning',
            message: `Comparison between String and ${leftType === 'String' ? rightType : leftType} may not work as expected`,
            location: spanToLocation(binary.span, filePath),
            source: 'verifier',
            notes: [
              `In behavior '${behavior.name.name}'`,
              'String comparisons use lexicographic ordering',
            ],
            help: [
              'Convert to same type before comparison',
              'Use .length property for string length comparisons',
            ],
          });
        }
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// Type Shadowing Detection
// ============================================================================

function checkTypeShadowing(
  ast: DomainDeclaration,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const BUILTIN_TYPES = new Set([
    'String', 'Int', 'Float', 'Decimal', 'Boolean', 'Bool',
    'UUID', 'Timestamp', 'DateTime', 'Date', 'Time', 'Duration',
    'Bytes', 'JSON', 'Any', 'Void', 'Never',
  ]);

  // Check if any custom types shadow built-in types
  for (const typeDef of ast.types || []) {
    const name = typeDef.name.name;
    if (BUILTIN_TYPES.has(name)) {
      diagnostics.push({
        code: 'E0346',
        category: 'semantic',
        severity: 'warning',
        message: `Type '${name}' shadows a built-in type`,
        location: spanToLocation((typeDef as { span?: unknown }).span, filePath),
        source: 'verifier',
        notes: [
          `'${name}' is a built-in ISL type`,
          'Shadowing built-in types can cause confusion',
        ],
        help: [
          `Rename to avoid shadowing (e.g., Custom${name}, My${name})`,
        ],
      });
    }
  }

  // Check if any entities shadow built-in types
  for (const entity of ast.entities || []) {
    const name = entity.name.name;
    if (BUILTIN_TYPES.has(name)) {
      diagnostics.push({
        code: 'E0347',
        category: 'semantic',
        severity: 'warning',
        message: `Entity '${name}' shadows a built-in type`,
        location: spanToLocation((entity as { span?: unknown }).span, filePath),
        source: 'verifier',
        notes: [
          `'${name}' is a built-in ISL type`,
          'This may cause type resolution conflicts',
        ],
        help: [
          `Rename to avoid shadowing (e.g., ${name}Entity, ${name}Model)`,
        ],
      });
    }
  }

  return diagnostics;
}

// ============================================================================
// Generic Type Usage
// ============================================================================

function checkGenericTypeUsage(
  ast: DomainDeclaration,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const GENERIC_TYPES = new Map([
    ['List', 1],
    ['Set', 1],
    ['Map', 2],
    ['Optional', 1],
    ['Result', 2],
  ]);

  // Walk through all type references and check generic usage
  const checkType = (typeNode: unknown, context: string): void => {
    if (!typeNode || typeof typeNode !== 'object') return;

    const t = typeNode as {
      kind?: string;
      name?: { name?: string };
      params?: unknown[];
      elementType?: unknown;
      types?: unknown[];
      span?: { start: { line: number; column: number; offset: number }; end: { line: number; column: number; offset: number } };
    };

    if (t.kind === 'GenericType' && t.name?.name) {
      const expectedArity = GENERIC_TYPES.get(t.name.name);
      if (expectedArity !== undefined) {
        const actualArity = t.params?.length ?? 0;
        if (actualArity !== expectedArity && t.span) {
          diagnostics.push({
            code: 'E0348',
            category: 'semantic',
            severity: 'error',
            message: `Generic type '${t.name.name}' expects ${expectedArity} type parameter(s), got ${actualArity}`,
            location: spanToLocation(t.span, filePath),
            source: 'verifier',
            notes: [context],
            help: [
              expectedArity === 1
                ? `Use ${t.name.name}<T>`
                : `Use ${t.name.name}<${Array(expectedArity).fill('T').map((_, i) => `T${i + 1}`).join(', ')}>`,
            ],
          });
        }
      }
    }

    // Recurse into nested types
    if (t.params) {
      for (const param of t.params) {
        checkType(param, context);
      }
    }
    if (t.elementType) {
      checkType(t.elementType, context);
    }
    if (t.types) {
      for (const ut of t.types) {
        checkType(ut, context);
      }
    }
  };

  // Check entities
  for (const entity of ast.entities || []) {
    for (const field of entity.fields || []) {
      checkType(field.type, `Field '${field.name.name}' in entity '${entity.name.name}'`);
    }
  }

  // Check behaviors
  for (const behavior of ast.behaviors || []) {
    const inputBlock = behavior.input as unknown as { fields?: unknown[] } | unknown[] | undefined;
    const behaviorInputs = inputBlock
      ? (Array.isArray(inputBlock) ? inputBlock : ((inputBlock as { fields?: unknown[] }).fields || []))
      : [];
    for (const input of behaviorInputs) {
      const inp = input as { name?: { name: string }; type?: unknown };
      if (inp?.name?.name && inp.type) {
        checkType(inp.type, `Input '${inp.name.name}' in behavior '${behavior.name.name}'`);
      }
    }
    const outputBlock = behavior.output as unknown as { fields?: unknown[] } | unknown[] | undefined;
    const behaviorOutputs = outputBlock
      ? (Array.isArray(outputBlock) ? outputBlock : ((outputBlock as { fields?: unknown[] }).fields || []))
      : [];
    for (const output of behaviorOutputs) {
      const out = output as { name?: { name: string }; type?: unknown };
      if (out?.name?.name && out.type) {
        checkType(out.type, `Output '${out.name.name}' in behavior '${behavior.name.name}'`);
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractTypeName(typeNode: unknown): string | null {
  if (!typeNode || typeof typeNode !== 'object') return null;

  const t = typeNode as {
    kind?: string;
    name?: { name?: string } | string;
  };

  if (t.kind === 'SimpleType') {
    if (typeof t.name === 'string') return t.name;
    if (t.name && typeof t.name === 'object' && 'name' in t.name) {
      return t.name.name ?? null;
    }
  }

  return null;
}

interface ConstraintInfo {
  kind: 'min' | 'max' | 'pattern' | 'enum' | 'custom';
  value: unknown;
}

function extractConstraints(typeNode: unknown): ConstraintInfo[] {
  const constraints: ConstraintInfo[] = [];
  if (!typeNode || typeof typeNode !== 'object') return constraints;

  const t = typeNode as {
    constraints?: Array<{
      name?: string | { name?: string };
      value?: unknown;
    }>;
  };

  for (const c of t.constraints || []) {
    const name = typeof c.name === 'string' ? c.name : c.name?.name;
    if (name === 'min' || name === 'max' || name === 'pattern' || name === 'enum') {
      constraints.push({ kind: name, value: extractLiteralValue(c.value) });
    } else if (name) {
      constraints.push({ kind: 'custom', value: c.value });
    }
  }

  return constraints;
}

function extractLiteralValue(expr: unknown): unknown {
  if (!expr || typeof expr !== 'object') return undefined;
  
  const e = expr as { kind?: string; value?: unknown };
  switch (e.kind) {
    case 'NumberLiteral':
    case 'StringLiteral':
    case 'BooleanLiteral':
      return e.value;
    default:
      return undefined;
  }
}

function isNumericType(typeName: string): boolean {
  return ['Int', 'Integer', 'Float', 'Double', 'Decimal', 'Number'].includes(typeName);
}

function isStringType(typeName: string): boolean {
  return ['String', 'Text', 'Email', 'URL', 'UUID'].includes(typeName);
}

function isOptionalType(typeNode: unknown): boolean {
  if (!typeNode || typeof typeNode !== 'object') return false;
  const t = typeNode as { kind?: string; nullable?: boolean };
  return t.kind === 'OptionalType' || t.nullable === true;
}

function hasRequiredAnnotation(field: unknown): boolean {
  if (!field || typeof field !== 'object') return false;
  const f = field as { annotations?: Array<{ name?: string | { name?: string } }> };
  
  for (const ann of f.annotations || []) {
    const name = typeof ann.name === 'string' ? ann.name : ann.name?.name;
    if (name?.toLowerCase() === 'required') return true;
  }
  return false;
}

function collectEntityReferences(entity: EntityDeclaration): Set<string> {
  const refs = new Set<string>();
  
  for (const field of entity.fields || []) {
    const typeName = extractTypeName(field.type);
    if (typeName && !isBuiltinType(typeName)) {
      refs.add(typeName);
    }
  }
  
  return refs;
}

function isBuiltinType(name: string): boolean {
  const BUILTIN_TYPES = new Set([
    'String', 'Int', 'Float', 'Decimal', 'Boolean', 'Bool',
    'UUID', 'Timestamp', 'DateTime', 'Date', 'Time', 'Duration',
    'Bytes', 'JSON', 'Any', 'Void', 'Never', 'Email', 'URL',
  ]);
  return BUILTIN_TYPES.has(name);
}

function checkForBidirectionalAnnotation(entity: EntityDeclaration, refName: string): boolean {
  // Check entity-level annotations
  const entityNode = entity as { annotations?: Array<{ name?: string | { name?: string } }> };
  for (const ann of entityNode.annotations || []) {
    const name = typeof ann.name === 'string' ? ann.name : ann.name?.name;
    if (name?.toLowerCase() === 'bidirectional') return true;
  }
  return false;
}

function inferExpressionType(expr: Expression): string | null {
  switch (expr.kind) {
    case 'StringLiteral':
      return 'String';
    case 'NumberLiteral':
      return 'Number';
    case 'BooleanLiteral':
      return 'Boolean';
    default:
      return null;
  }
}
