// ============================================================================
// Type Encoding for SMT-LIB
// Translates ISL types to SMT-LIB sort and function declarations
// ============================================================================

import type * as AST from '../../../../master_contracts/ast';

// ============================================================================
// SORT ENCODING
// ============================================================================

/**
 * Generate SMT-LIB sort declarations for a type
 */
export function encodeSorts(type: AST.TypeDeclaration): string {
  const name = type.name.name;
  const def = type.definition;

  switch (def.kind) {
    case 'PrimitiveType':
      return encodePrimitiveSort(name, def);
    case 'ConstrainedType':
      return encodeConstrainedSort(name, def);
    case 'EnumType':
      return encodeEnumSort(name, def);
    case 'StructType':
      return encodeStructSort(name, def);
    case 'UnionType':
      return encodeUnionSort(name, def);
    case 'ListType':
      return encodeListSort(name, def);
    case 'MapType':
      return encodeMapSort(name, def);
    case 'OptionalType':
      return encodeOptionalSort(name, def);
    case 'ReferenceType':
      return `; ${name} is alias for ${def.name.parts.map(p => p.name).join('.')}`;
    default:
      return `; Unknown type: ${name}`;
  }
}

function encodePrimitiveSort(name: string, def: AST.PrimitiveType): string {
  const smtSort = primitiveToSmt(def.name);
  return `; ${name} = ${def.name}\n(define-sort ${name} () ${smtSort})`;
}

function encodeConstrainedSort(name: string, def: AST.ConstrainedType): string {
  const lines: string[] = [];
  const baseSort = typeDefToSmt(def.base);
  
  lines.push(`; ${name} with constraints`);
  lines.push(`(define-sort ${name} () ${baseSort})`);
  
  // Generate constraint predicates
  lines.push(`(define-fun ${name}-valid ((x ${baseSort})) Bool`);
  
  const constraints = def.constraints.map(c => encodeConstraint(c, 'x', baseSort));
  if (constraints.length > 0) {
    lines.push(`  (and ${constraints.join(' ')})`);
  } else {
    lines.push('  true');
  }
  lines.push(')');

  return lines.join('\n');
}

function encodeConstraint(constraint: AST.Constraint, varName: string, sort: string): string {
  const value = extractLiteralValue(constraint.value);
  
  switch (constraint.name) {
    case 'min':
    case 'minimum':
      return `(>= ${varName} ${value})`;
    case 'max':
    case 'maximum':
      return `(<= ${varName} ${value})`;
    case 'min_length':
    case 'minLength':
      return `(>= (str.len ${varName}) ${value})`;
    case 'max_length':
    case 'maxLength':
      return `(<= (str.len ${varName}) ${value})`;
    case 'length':
      return `(= (str.len ${varName}) ${value})`;
    case 'pattern':
    case 'format':
      // Z3 has limited regex support - simplified
      return `(str.in_re ${varName} (str.to_re "${value}"))`;
    case 'precision':
      // Precision constraint - simplified as true
      return 'true';
    default:
      return 'true';
  }
}

function encodeEnumSort(name: string, def: AST.EnumType): string {
  const lines: string[] = [];
  
  lines.push(`; Enum ${name}`);
  
  // Use Int to represent enum
  lines.push(`(define-sort ${name} () Int)`);
  
  // Define constants for each variant
  def.variants.forEach((variant, index) => {
    lines.push(`(define-const ${name}-${variant.name.name} ${name} ${index})`);
  });
  
  // Define validity predicate
  lines.push(`(define-fun ${name}-valid ((x ${name})) Bool`);
  lines.push(`  (and (>= x 0) (< x ${def.variants.length})))`);

  return lines.join('\n');
}

function encodeStructSort(name: string, def: AST.StructType): string {
  const lines: string[] = [];
  
  lines.push(`; Struct ${name}`);
  lines.push(`(declare-sort ${name} 0)`);
  
  // Declare accessor functions
  for (const field of def.fields) {
    const fieldSort = typeDefToSmt(field.type);
    lines.push(`(declare-fun ${name}-${field.name.name} (${name}) ${fieldSort})`);
  }

  return lines.join('\n');
}

function encodeUnionSort(name: string, def: AST.UnionType): string {
  const lines: string[] = [];
  
  lines.push(`; Union ${name}`);
  lines.push(`(declare-sort ${name} 0)`);
  
  // Tag function to determine variant
  lines.push(`(declare-fun ${name}-tag (${name}) Int)`);
  
  // Define variant tags
  def.variants.forEach((variant, index) => {
    lines.push(`(define-const ${name}-tag-${variant.name.name} Int ${index})`);
    
    // Accessor functions for variant fields
    for (const field of variant.fields) {
      const fieldSort = typeDefToSmt(field.type);
      lines.push(`(declare-fun ${name}-${variant.name.name}-${field.name.name} (${name}) ${fieldSort})`);
    }
  });

  return lines.join('\n');
}

function encodeListSort(name: string, def: AST.ListType): string {
  const elementSort = typeDefToSmt(def.element);
  return `; List ${name}\n(define-sort ${name} () (Array Int ${elementSort}))\n(declare-fun ${name}-length ((Array Int ${elementSort})) Int)`;
}

function encodeMapSort(name: string, def: AST.MapType): string {
  const keySort = typeDefToSmt(def.key);
  const valueSort = typeDefToSmt(def.value);
  return `; Map ${name}\n(define-sort ${name} () (Array ${keySort} ${valueSort}))`;
}

function encodeOptionalSort(name: string, def: AST.OptionalType): string {
  const innerSort = typeDefToSmt(def.inner);
  const lines: string[] = [];
  
  lines.push(`; Optional ${name}`);
  lines.push(`(declare-sort ${name} 0)`);
  lines.push(`(declare-fun ${name}-has-value (${name}) Bool)`);
  lines.push(`(declare-fun ${name}-value (${name}) ${innerSort})`);

  return lines.join('\n');
}

// ============================================================================
// TYPE ENCODING FUNCTIONS
// ============================================================================

/**
 * Encode a complete type with all its constraints
 */
export function encodeTypes(domain: AST.TypeDeclaration[]): string {
  const lines: string[] = [];
  
  for (const type of domain) {
    lines.push(encodeSorts(type));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate type validity assertions
 */
export function encodeTypeValidity(varName: string, type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'ConstrainedType': {
      const baseSort = typeDefToSmt(type.base);
      const constraints = type.constraints
        .map(c => encodeConstraint(c, varName, baseSort))
        .join(' ');
      return constraints ? `(and ${constraints})` : 'true';
    }
    case 'EnumType': {
      const max = type.variants.length - 1;
      return `(and (>= ${varName} 0) (<= ${varName} ${max}))`;
    }
    case 'ListType':
      return `(>= (select-length ${varName}) 0)`;
    default:
      return 'true';
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function primitiveToSmt(name: string): string {
  switch (name) {
    case 'String':
      return 'String';
    case 'Int':
      return 'Int';
    case 'Decimal':
      return 'Real';
    case 'Boolean':
      return 'Bool';
    case 'Timestamp':
      return 'Int'; // Unix timestamp
    case 'UUID':
      return 'String'; // Simplified
    case 'Duration':
      return 'Int'; // Milliseconds
    default:
      return 'Int';
  }
}

export function typeDefToSmt(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      return primitiveToSmt(type.name);
    case 'ReferenceType':
      return type.name.parts.map(p => p.name).join('_');
    case 'ListType':
      return `(Array Int ${typeDefToSmt(type.element)})`;
    case 'MapType':
      return `(Array ${typeDefToSmt(type.key)} ${typeDefToSmt(type.value)})`;
    case 'OptionalType':
      return typeDefToSmt(type.inner);
    case 'ConstrainedType':
      return typeDefToSmt(type.base);
    case 'EnumType':
      return 'Int';
    case 'StructType':
      return 'Int'; // Simplified
    case 'UnionType':
      return 'Int'; // Simplified
    default:
      return 'Int';
  }
}

function extractLiteralValue(expr: AST.Expression): string {
  switch (expr.kind) {
    case 'NumberLiteral':
      return expr.isFloat ? expr.value.toFixed(10) : String(expr.value);
    case 'StringLiteral':
      return `"${expr.value}"`;
    case 'BooleanLiteral':
      return expr.value ? 'true' : 'false';
    case 'RegexLiteral':
      return `"${expr.pattern}"`;
    default:
      return '0';
  }
}
