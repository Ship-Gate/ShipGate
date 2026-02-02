// ============================================================================
// Arbitrary Generators
// Converts ISL types to fast-check arbitraries
// ============================================================================

import type * as AST from '../../../master_contracts/ast.js';
import type { ArbitraryDefinition, ConstraintInfo } from './types.js';

/**
 * Generate arbitrary for a type declaration
 */
export function generateArbitrary(
  typeDecl: AST.TypeDeclaration
): ArbitraryDefinition {
  const name = `arb${typeDecl.name.name}`;
  const code = generateTypeArbitrary(typeDecl.definition, typeDecl.name.name);
  const dependencies = collectDependencies(typeDecl.definition);

  return { name, code, dependencies };
}

/**
 * Generate arbitrary for a type definition
 */
export function generateTypeArbitrary(
  type: AST.TypeDefinition,
  typeName?: string
): string {
  switch (type.kind) {
    case 'PrimitiveType':
      return generatePrimitiveArbitrary(type);

    case 'ConstrainedType':
      return generateConstrainedArbitrary(type);

    case 'EnumType':
      return generateEnumArbitrary(type);

    case 'StructType':
      return generateStructArbitrary(type, typeName);

    case 'UnionType':
      return generateUnionArbitrary(type);

    case 'ListType':
      return generateListArbitrary(type);

    case 'MapType':
      return generateMapArbitrary(type);

    case 'OptionalType':
      return generateOptionalArbitrary(type);

    case 'ReferenceType':
      return `arb${type.name.parts.map((p) => p.name).join('')}`;

    default:
      return 'fc.anything()';
  }
}

/**
 * Generate arbitrary for primitive types
 */
function generatePrimitiveArbitrary(type: AST.PrimitiveType): string {
  switch (type.name) {
    case 'String':
      return 'fc.string()';
    case 'Int':
      return 'fc.integer()';
    case 'Decimal':
      return 'fc.double()';
    case 'Boolean':
      return 'fc.boolean()';
    case 'UUID':
      return 'fc.uuid()';
    case 'Timestamp':
      return 'fc.date()';
    case 'Duration':
      return 'fc.integer({ min: 0, max: 86400000 })'; // 0 to 24 hours in ms
    default:
      return 'fc.anything()';
  }
}

/**
 * Generate arbitrary for constrained types
 */
function generateConstrainedArbitrary(type: AST.ConstrainedType): string {
  const baseArb = generateTypeArbitrary(type.base);
  const constraints = type.constraints.map((c) => parseConstraint(c));

  // Apply constraints based on base type
  if (type.base.kind === 'PrimitiveType') {
    return applyConstraints(type.base.name, constraints);
  }

  // For non-primitive bases, apply filter
  const filters = constraints
    .map((c) => constraintToFilter(c))
    .filter(Boolean);

  if (filters.length === 0) {
    return baseArb;
  }

  return `${baseArb}.filter(v => ${filters.join(' && ')})`;
}

/**
 * Apply constraints to generate optimized arbitrary
 */
function applyConstraints(baseName: string, constraints: ConstraintInfo[]): string {
  const options: string[] = [];
  let filters: string[] = [];

  for (const constraint of constraints) {
    switch (constraint.type) {
      case 'min':
        options.push(`min: ${constraint.value}`);
        break;
      case 'max':
        options.push(`max: ${constraint.value}`);
        break;
      case 'minLength':
        options.push(`minLength: ${constraint.value}`);
        break;
      case 'maxLength':
        options.push(`maxLength: ${constraint.value}`);
        break;
      case 'precision':
        options.push(`noNaN: true`);
        break;
      case 'pattern':
        filters.push(`/${constraint.value}/.test(v)`);
        break;
      case 'format':
        const formatArb = getFormatArbitrary(constraint.value as string);
        if (formatArb) {
          return formatArb;
        }
        break;
    }
  }

  let arb: string;
  switch (baseName) {
    case 'String':
      arb = options.length > 0 ? `fc.string({ ${options.join(', ')} })` : 'fc.string()';
      break;
    case 'Int':
      arb = options.length > 0 ? `fc.integer({ ${options.join(', ')} })` : 'fc.integer()';
      break;
    case 'Decimal':
      arb = options.length > 0 ? `fc.double({ ${options.join(', ')} })` : 'fc.double()';
      break;
    default:
      arb = generatePrimitiveArbitrary({ kind: 'PrimitiveType', name: baseName as AST.PrimitiveType['name'], location: {} as AST.SourceLocation });
  }

  if (filters.length > 0) {
    return `${arb}.filter(v => ${filters.join(' && ')})`;
  }

  return arb;
}

/**
 * Get specialized arbitrary for common formats
 */
function getFormatArbitrary(format: string): string | null {
  switch (format.toLowerCase()) {
    case 'email':
      return 'fc.emailAddress()';
    case 'url':
      return 'fc.webUrl()';
    case 'uuid':
      return 'fc.uuid()';
    case 'ipv4':
      return 'fc.ipV4()';
    case 'ipv6':
      return 'fc.ipV6()';
    case 'date':
      return 'fc.date().map(d => d.toISOString().split("T")[0])';
    case 'datetime':
      return 'fc.date().map(d => d.toISOString())';
    case 'json':
      return 'fc.json()';
    default:
      return null;
  }
}

/**
 * Generate arbitrary for enum types
 */
function generateEnumArbitrary(type: AST.EnumType): string {
  const variants = type.variants.map((v) => `'${v.name.name}'`);
  return `fc.constantFrom(${variants.join(', ')})`;
}

/**
 * Generate arbitrary for struct types
 */
function generateStructArbitrary(type: AST.StructType, typeName?: string): string {
  const fields = type.fields.map((field) => {
    const fieldArb = generateTypeArbitrary(field.type);
    const arb = field.optional ? `fc.option(${fieldArb}, { nil: undefined })` : fieldArb;
    return `  ${field.name.name}: ${arb}`;
  });

  return `fc.record({\n${fields.join(',\n')}\n})`;
}

/**
 * Generate arbitrary for union types
 */
function generateUnionArbitrary(type: AST.UnionType): string {
  const variants = type.variants.map((variant) => {
    const fields = variant.fields.map((field) => {
      const fieldArb = generateTypeArbitrary(field.type);
      return `    ${field.name.name}: ${fieldArb}`;
    });

    return `fc.record({\n    _tag: fc.constant('${variant.name.name}'),\n${fields.join(',\n')}\n  })`;
  });

  return `fc.oneof(\n  ${variants.join(',\n  ')}\n)`;
}

/**
 * Generate arbitrary for list types
 */
function generateListArbitrary(type: AST.ListType): string {
  const elementArb = generateTypeArbitrary(type.element);
  return `fc.array(${elementArb})`;
}

/**
 * Generate arbitrary for map types
 */
function generateMapArbitrary(type: AST.MapType): string {
  const keyArb = generateTypeArbitrary(type.key);
  const valueArb = generateTypeArbitrary(type.value);
  return `fc.dictionary(${keyArb}, ${valueArb})`;
}

/**
 * Generate arbitrary for optional types
 */
function generateOptionalArbitrary(type: AST.OptionalType): string {
  const innerArb = generateTypeArbitrary(type.inner);
  return `fc.option(${innerArb}, { nil: undefined })`;
}

/**
 * Generate arbitrary for an entity
 */
export function generateEntityArbitrary(entity: AST.Entity): ArbitraryDefinition {
  const name = `arb${entity.name.name}`;
  const fields = entity.fields.map((field) => {
    const fieldArb = generateTypeArbitrary(field.type);
    const arb = field.optional ? `fc.option(${fieldArb}, { nil: undefined })` : fieldArb;
    return `  ${field.name.name}: ${arb}`;
  });

  // Add invariant filters if present
  const invariantFilters = entity.invariants.map((inv) => compileInvariantFilter(inv));
  const filterCode = invariantFilters.length > 0
    ? `.filter(e => ${invariantFilters.join(' && ')})`
    : '';

  const code = `fc.record({\n${fields.join(',\n')}\n})${filterCode}`;
  const dependencies = collectEntityDependencies(entity);

  return { name, code, dependencies };
}

/**
 * Generate arbitrary for behavior input
 */
export function generateInputArbitrary(behavior: AST.Behavior): ArbitraryDefinition {
  const name = `arb${behavior.name.name}Input`;
  const fields = behavior.input.fields.map((field) => {
    const fieldArb = generateTypeArbitrary(field.type);
    const arb = field.optional ? `fc.option(${fieldArb}, { nil: undefined })` : fieldArb;
    return `  ${field.name.name}: ${arb}`;
  });

  const code = `fc.record({\n${fields.join(',\n')}\n})`;
  const dependencies = collectInputDependencies(behavior.input);

  return { name, code, dependencies };
}

/**
 * Parse a constraint into structured format
 */
function parseConstraint(constraint: AST.Constraint): ConstraintInfo {
  const name = constraint.name.toLowerCase();
  const value = extractConstraintValue(constraint.value);

  switch (name) {
    case 'min':
      return { type: 'min', value };
    case 'max':
      return { type: 'max', value };
    case 'min_length':
    case 'minlength':
      return { type: 'minLength', value };
    case 'max_length':
    case 'maxlength':
      return { type: 'maxLength', value };
    case 'format':
    case 'pattern':
      return { type: 'pattern', value };
    case 'precision':
      return { type: 'precision', value };
    default:
      return { type: 'pattern', value: '.*' };
  }
}

/**
 * Extract value from constraint expression
 */
function extractConstraintValue(expr: AST.Expression): unknown {
  switch (expr.kind) {
    case 'NumberLiteral':
      return expr.value;
    case 'StringLiteral':
      return expr.value;
    case 'BooleanLiteral':
      return expr.value;
    case 'RegexLiteral':
      return expr.pattern;
    default:
      return null;
  }
}

/**
 * Convert constraint to filter expression
 */
function constraintToFilter(constraint: ConstraintInfo): string | null {
  switch (constraint.type) {
    case 'min':
      return `v >= ${constraint.value}`;
    case 'max':
      return `v <= ${constraint.value}`;
    case 'minLength':
      return `v.length >= ${constraint.value}`;
    case 'maxLength':
      return `v.length <= ${constraint.value}`;
    case 'pattern':
      return `/${constraint.value}/.test(v)`;
    default:
      return null;
  }
}

/**
 * Compile invariant expression to filter
 */
function compileInvariantFilter(expr: AST.Expression): string {
  switch (expr.kind) {
    case 'BinaryExpr':
      const left = compileInvariantFilter(expr.left);
      const right = compileInvariantFilter(expr.right);
      const op = mapOperator(expr.operator);
      return `(${left} ${op} ${right})`;

    case 'MemberExpr':
      return `e.${expr.property.name}`;

    case 'Identifier':
      return expr.name;

    case 'NumberLiteral':
      return String(expr.value);

    case 'BooleanLiteral':
      return String(expr.value);

    default:
      return 'true';
  }
}

function mapOperator(op: AST.BinaryOperator): string {
  switch (op) {
    case '==': return '===';
    case '!=': return '!==';
    case 'and': return '&&';
    case 'or': return '||';
    default: return op;
  }
}

/**
 * Collect dependencies from type definition
 */
function collectDependencies(type: AST.TypeDefinition): string[] {
  const deps: string[] = [];

  switch (type.kind) {
    case 'ReferenceType':
      deps.push(`arb${type.name.parts.map((p) => p.name).join('')}`);
      break;
    case 'ListType':
      deps.push(...collectDependencies(type.element));
      break;
    case 'MapType':
      deps.push(...collectDependencies(type.key));
      deps.push(...collectDependencies(type.value));
      break;
    case 'OptionalType':
      deps.push(...collectDependencies(type.inner));
      break;
    case 'StructType':
      type.fields.forEach((f) => deps.push(...collectDependencies(f.type)));
      break;
    case 'ConstrainedType':
      deps.push(...collectDependencies(type.base));
      break;
  }

  return [...new Set(deps)];
}

function collectEntityDependencies(entity: AST.Entity): string[] {
  const deps: string[] = [];
  entity.fields.forEach((f) => deps.push(...collectDependencies(f.type)));
  return [...new Set(deps)];
}

function collectInputDependencies(input: AST.InputSpec): string[] {
  const deps: string[] = [];
  input.fields.forEach((f) => deps.push(...collectDependencies(f.type)));
  return [...new Set(deps)];
}

/**
 * Generate all arbitraries for a domain
 */
export function generateAllArbitraries(domain: AST.Domain): ArbitraryDefinition[] {
  const arbitraries: ArbitraryDefinition[] = [];

  // Type declarations
  for (const typeDecl of domain.types) {
    arbitraries.push(generateArbitrary(typeDecl));
  }

  // Entities
  for (const entity of domain.entities) {
    arbitraries.push(generateEntityArbitrary(entity));
  }

  // Behavior inputs
  for (const behavior of domain.behaviors) {
    arbitraries.push(generateInputArbitrary(behavior));
  }

  return arbitraries;
}
