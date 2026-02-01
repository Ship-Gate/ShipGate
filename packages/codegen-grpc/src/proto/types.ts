// ============================================================================
// ISL to Proto Type Mapping
// ============================================================================

import type {
  TypeDefinition,
  PrimitiveType,
  ConstrainedType,
  EnumType,
  StructType,
  UnionType,
  ListType,
  MapType,
  OptionalType,
  ReferenceType,
  TypeDeclaration,
  Constraint,
  NumberLiteral,
  RegexLiteral,
} from '@intentos/isl-core';
import {
  toScreamingSnakeCase,
  toSnakeCase,
  toPascalCase,
  escapeRegexForProto,
  fieldNumbers,
  protoComment,
} from '../utils';

// ==========================================================================
// TYPE OPTIONS
// ==========================================================================

export interface ProtoTypeOptions {
  /** Include validate.proto validation rules */
  includeValidation?: boolean;
  /** Custom type mappings */
  customTypes?: Record<string, string>;
  /** Prefix for generated wrapper types */
  wrapperPrefix?: string;
}

// ==========================================================================
// PRIMITIVE TYPE MAPPING
// ==========================================================================

const PRIMITIVE_PROTO_TYPES: Record<string, string> = {
  String: 'string',
  Int: 'int64',
  Decimal: 'double',
  Boolean: 'bool',
  Timestamp: 'google.protobuf.Timestamp',
  UUID: 'string',
  Duration: 'google.protobuf.Duration',
};

const PRIMITIVE_IMPORTS: Record<string, string> = {
  Timestamp: 'google/protobuf/timestamp.proto',
  Duration: 'google/protobuf/duration.proto',
};

// ==========================================================================
// TYPE GENERATOR
// ==========================================================================

export interface GeneratedProtoType {
  name: string;
  definition: string;
  imports: Set<string>;
  isWrapper: boolean;
}

/**
 * Generate proto types from ISL type declarations
 */
export function generateProtoTypes(
  types: TypeDeclaration[],
  options: ProtoTypeOptions = {}
): GeneratedProtoType[] {
  const results: GeneratedProtoType[] = [];
  
  for (const type of types) {
    const generated = generateTypeDeclaration(type, options);
    if (generated) {
      results.push(generated);
    }
  }
  
  return results;
}

/**
 * Generate a single type declaration
 */
function generateTypeDeclaration(
  decl: TypeDeclaration,
  options: ProtoTypeOptions
): GeneratedProtoType | null {
  const name = toPascalCase(decl.name.name);
  const imports = new Set<string>();
  
  // Handle different type definitions
  switch (decl.definition.kind) {
    case 'EnumType':
      return {
        name,
        definition: generateEnum(name, decl.definition, options),
        imports,
        isWrapper: false,
      };
    
    case 'StructType':
      return generateStructType(name, decl.definition, options);
    
    case 'UnionType':
      return generateUnionType(name, decl.definition, options);
    
    case 'ConstrainedType':
      return generateConstrainedWrapper(name, decl.definition, options);
    
    case 'PrimitiveType':
      // Primitives with wrappers
      return generatePrimitiveWrapper(name, decl.definition, options);
    
    default:
      return null;
  }
}

// ==========================================================================
// ENUM GENERATION
// ==========================================================================

function generateEnum(
  name: string,
  enumType: EnumType,
  _options: ProtoTypeOptions
): string {
  const lines: string[] = [`enum ${name} {`];
  
  // Proto3 requires first value to be 0 (UNSPECIFIED)
  const prefix = toScreamingSnakeCase(name);
  lines.push(`  ${prefix}_UNSPECIFIED = 0;`);
  
  let value = 1;
  for (const variant of enumType.variants) {
    const variantName = `${prefix}_${toScreamingSnakeCase(variant.name.name)}`;
    lines.push(`  ${variantName} = ${value};`);
    value++;
  }
  
  lines.push('}');
  return lines.join('\n');
}

// ==========================================================================
// STRUCT GENERATION
// ==========================================================================

function generateStructType(
  name: string,
  structType: StructType,
  options: ProtoTypeOptions
): GeneratedProtoType {
  const imports = new Set<string>();
  const lines: string[] = [`message ${name} {`];
  const fieldNums = fieldNumbers();
  
  for (const field of structType.fields) {
    const fieldNum = fieldNums.next().value;
    const { protoType, fieldImports } = resolveType(field.type, options);
    fieldImports.forEach(i => imports.add(i));
    
    const fieldName = toSnakeCase(field.name.name);
    let fieldDef = `  ${protoType} ${fieldName} = ${fieldNum}`;
    
    // Add validation rules
    if (options.includeValidation) {
      const rules = generateValidationRules(field.type, field.optional);
      if (rules) {
        fieldDef += ` ${rules}`;
        imports.add('validate/validate.proto');
      }
    }
    
    fieldDef += ';';
    lines.push(fieldDef);
  }
  
  lines.push('}');
  
  return {
    name,
    definition: lines.join('\n'),
    imports,
    isWrapper: false,
  };
}

// ==========================================================================
// UNION GENERATION (as oneof)
// ==========================================================================

function generateUnionType(
  name: string,
  unionType: UnionType,
  options: ProtoTypeOptions
): GeneratedProtoType {
  const imports = new Set<string>();
  const lines: string[] = [`message ${name} {`];
  
  // Generate variant messages first
  const variantMessages: string[] = [];
  for (const variant of unionType.variants) {
    const variantName = `${name}${toPascalCase(variant.name.name)}`;
    const variantLines: string[] = [`message ${variantName} {`];
    const fieldNums = fieldNumbers();
    
    for (const field of variant.fields) {
      const fieldNum = fieldNums.next().value;
      const { protoType, fieldImports } = resolveType(field.type, options);
      fieldImports.forEach(i => imports.add(i));
      
      const fieldName = toSnakeCase(field.name.name);
      variantLines.push(`  ${protoType} ${fieldName} = ${fieldNum};`);
    }
    
    variantLines.push('}');
    variantMessages.push(variantLines.join('\n'));
  }
  
  // Generate oneof
  lines.push('  oneof value {');
  let fieldNum = 1;
  for (const variant of unionType.variants) {
    const variantName = `${name}${toPascalCase(variant.name.name)}`;
    const fieldName = toSnakeCase(variant.name.name);
    lines.push(`    ${variantName} ${fieldName} = ${fieldNum};`);
    fieldNum++;
  }
  lines.push('  }');
  lines.push('}');
  
  // Combine variant messages with the union message
  const fullDefinition = [...variantMessages, '', lines.join('\n')].join('\n');
  
  return {
    name,
    definition: fullDefinition,
    imports,
    isWrapper: false,
  };
}

// ==========================================================================
// CONSTRAINED TYPE (WRAPPER) GENERATION
// ==========================================================================

function generateConstrainedWrapper(
  name: string,
  constrained: ConstrainedType,
  options: ProtoTypeOptions
): GeneratedProtoType {
  const imports = new Set<string>();
  const { protoType, fieldImports } = resolveType(constrained.base, options);
  fieldImports.forEach(i => imports.add(i));
  
  const lines: string[] = [`message ${name} {`];
  let fieldDef = `  ${protoType} value = 1`;
  
  if (options.includeValidation) {
    const rules = generateConstraintValidation(constrained.constraints);
    if (rules) {
      fieldDef += ` ${rules}`;
      imports.add('validate/validate.proto');
    }
  }
  
  fieldDef += ';';
  lines.push(fieldDef);
  lines.push('}');
  
  return {
    name,
    definition: lines.join('\n'),
    imports,
    isWrapper: true,
  };
}

function generatePrimitiveWrapper(
  name: string,
  primitive: PrimitiveType,
  options: ProtoTypeOptions
): GeneratedProtoType {
  const imports = new Set<string>();
  const protoType = PRIMITIVE_PROTO_TYPES[primitive.name] ?? 'string';
  
  if (PRIMITIVE_IMPORTS[primitive.name]) {
    imports.add(PRIMITIVE_IMPORTS[primitive.name]);
  }
  
  const lines: string[] = [
    `// Wrapper type for ${primitive.name}`,
    `message ${name} {`,
    `  ${protoType} value = 1;`,
    '}',
  ];
  
  return {
    name,
    definition: lines.join('\n'),
    imports,
    isWrapper: true,
  };
}

// ==========================================================================
// TYPE RESOLUTION
// ==========================================================================

export interface ResolvedType {
  protoType: string;
  fieldImports: Set<string>;
}

export function resolveType(
  type: TypeDefinition,
  options: ProtoTypeOptions = {}
): ResolvedType {
  const fieldImports = new Set<string>();
  
  switch (type.kind) {
    case 'PrimitiveType': {
      const proto = PRIMITIVE_PROTO_TYPES[type.name] ?? 'string';
      const imp = PRIMITIVE_IMPORTS[type.name];
      if (imp) fieldImports.add(imp);
      return { protoType: proto, fieldImports };
    }
    
    case 'ReferenceType': {
      // Reference to another type - use as-is (will be in same package)
      const refName = type.name.parts.map(p => p.name).join('.');
      return { protoType: toPascalCase(refName), fieldImports };
    }
    
    case 'ListType': {
      const { protoType, fieldImports: elemImports } = resolveType(type.element, options);
      elemImports.forEach(i => fieldImports.add(i));
      return { protoType: `repeated ${protoType}`, fieldImports };
    }
    
    case 'MapType': {
      const { protoType: keyType, fieldImports: keyImports } = resolveType(type.key, options);
      const { protoType: valType, fieldImports: valImports } = resolveType(type.value, options);
      keyImports.forEach(i => fieldImports.add(i));
      valImports.forEach(i => fieldImports.add(i));
      // Proto3 maps only support scalar keys
      const safeKeyType = keyType === 'double' ? 'string' : keyType;
      return { protoType: `map<${safeKeyType}, ${valType}>`, fieldImports };
    }
    
    case 'OptionalType': {
      const { protoType, fieldImports: innerImports } = resolveType(type.inner, options);
      innerImports.forEach(i => fieldImports.add(i));
      // Proto3 all fields are optional by default, use wrapper for explicit optional
      fieldImports.add('google/protobuf/wrappers.proto');
      return { protoType: `optional ${protoType}`, fieldImports };
    }
    
    case 'ConstrainedType': {
      // Resolve the base type
      return resolveType(type.base, options);
    }
    
    case 'EnumType':
    case 'StructType':
    case 'UnionType':
      // These should be referenced by name, not inline
      return { protoType: 'UNRESOLVED', fieldImports };
    
    default:
      return { protoType: 'string', fieldImports };
  }
}

// ==========================================================================
// VALIDATION RULES GENERATION
// ==========================================================================

function generateValidationRules(type: TypeDefinition, optional: boolean): string | null {
  const rules: string[] = [];
  
  if (!optional) {
    // Required field
    if (type.kind === 'PrimitiveType' && type.name === 'String') {
      rules.push('string.min_len = 1');
    } else if (type.kind === 'ReferenceType') {
      rules.push('message.required = true');
    }
  }
  
  if (type.kind === 'ConstrainedType') {
    const constraintRules = generateConstraintValidation(type.constraints);
    if (constraintRules) {
      return constraintRules;
    }
  }
  
  if (rules.length === 0) return null;
  return `[(validate.rules).${rules.join(', ')}]`;
}

function generateConstraintValidation(constraints: Constraint[]): string | null {
  const rules: string[] = [];
  let ruleType = 'string';
  
  for (const constraint of constraints) {
    const name = constraint.name;
    const value = constraint.value;
    
    switch (name) {
      case 'min':
      case 'min_length':
        if (value.kind === 'NumberLiteral') {
          const v = (value as NumberLiteral).value;
          if (name === 'min') {
            ruleType = 'double';
            rules.push(`gte = ${v}`);
          } else {
            rules.push(`min_len = ${v}`);
          }
        }
        break;
      
      case 'max':
      case 'max_length':
        if (value.kind === 'NumberLiteral') {
          const v = (value as NumberLiteral).value;
          if (name === 'max') {
            ruleType = 'double';
            rules.push(`lte = ${v}`);
          } else {
            rules.push(`max_len = ${v}`);
          }
        }
        break;
      
      case 'length':
        if (value.kind === 'NumberLiteral') {
          const v = (value as NumberLiteral).value;
          rules.push(`len = ${v}`);
        }
        break;
      
      case 'pattern':
      case 'format':
        if (value.kind === 'RegexLiteral') {
          const pattern = escapeRegexForProto((value as RegexLiteral).pattern);
          rules.push(`pattern = "${pattern}"`);
        }
        break;
      
      case 'precision':
        // Decimal precision - no direct proto equivalent
        break;
    }
  }
  
  if (rules.length === 0) return null;
  return `[(validate.rules).${ruleType} = {${rules.join(', ')}}]`;
}

// ==========================================================================
// IMPORTS COLLECTOR
// ==========================================================================

export function collectTypeImports(types: GeneratedProtoType[]): string[] {
  const allImports = new Set<string>();
  
  for (const type of types) {
    type.imports.forEach(i => allImports.add(i));
  }
  
  return Array.from(allImports).sort();
}
