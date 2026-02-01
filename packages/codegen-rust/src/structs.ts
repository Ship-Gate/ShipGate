// ============================================================================
// ISL Entities → Rust Structs
// ============================================================================

import type {
  Entity,
  TypeDeclaration,
  Field,
  EnumType,
  StructType,
  UnionType,
  LifecycleSpec,
} from './ast-types';
import { mapType, toSnakeCase, type RustImport } from './types';
import { generateSerdeFieldAttrs, generateSerdeContainerAttrs, DEFAULT_SERDE_CONFIG } from './serde';
import { generateValidationFieldAttrs, generateValidatedNewtype } from './validation';

export interface GeneratedStruct {
  name: string;
  code: string;
  imports: RustImport[];
}

/**
 * Generate Rust struct from ISL Entity
 */
export function generateEntityStruct(entity: Entity): GeneratedStruct {
  const lines: string[] = [];
  const imports: RustImport[] = [];
  
  // Add documentation
  lines.push(`/// ${entity.name.name} entity`);
  
  // Derive macros
  lines.push('#[derive(Debug, Clone, Serialize, Deserialize, Validate)]');
  
  // Serde container attributes
  const containerAttrs = generateSerdeContainerAttrs(DEFAULT_SERDE_CONFIG);
  lines.push(...containerAttrs);
  
  // Struct definition
  lines.push(`pub struct ${entity.name.name} {`);
  
  // Fields
  for (const field of entity.fields) {
    const fieldCode = generateField(field);
    lines.push(...fieldCode.lines.map(l => `    ${l}`));
    imports.push(...fieldCode.imports);
  }
  
  lines.push('}');
  
  // Add standard imports
  imports.push({ crate: 'serde', items: ['Deserialize', 'Serialize'] });
  imports.push({ crate: 'validator', items: ['Validate'] });
  
  return {
    name: entity.name.name,
    code: lines.join('\n'),
    imports,
  };
}

/**
 * Generate Rust type from ISL TypeDeclaration
 */
export function generateTypeDeclaration(typeDecl: TypeDeclaration): GeneratedStruct {
  const name = typeDecl.name.name;
  const def = typeDecl.definition;
  
  switch (def.kind) {
    case 'EnumType':
      return generateEnum(name, def);
    
    case 'StructType':
      return generateStruct(name, def);
    
    case 'UnionType':
      return generateUnion(name, def);
    
    case 'ConstrainedType': {
      // Generate newtype wrapper with validation
      const baseRust = mapType(def.base);
      const code = generateValidatedNewtype(name, baseRust.type, def.constraints);
      return {
        name,
        code,
        imports: [
          { crate: 'serde', items: ['Deserialize', 'Serialize'] },
          { crate: 'validator', items: ['Validate'] },
          ...baseRust.imports,
        ],
      };
    }
    
    default: {
      // Simple type alias
      const rustType = mapType(def);
      return {
        name,
        code: `pub type ${name} = ${rustType.type};`,
        imports: rustType.imports,
      };
    }
  }
}

/**
 * Generate Rust enum from ISL EnumType
 */
export function generateEnum(name: string, enumType: EnumType): GeneratedStruct {
  const lines: string[] = [];
  const imports: RustImport[] = [];
  
  // Documentation
  lines.push(`/// ${name} enum`);
  
  // Derive macros for enums
  lines.push('#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]');
  lines.push('#[serde(rename_all = "SCREAMING_SNAKE_CASE")]');
  
  // Enum definition
  lines.push(`pub enum ${name} {`);
  
  for (const variant of enumType.variants) {
    lines.push(`    ${variant.name.name},`);
  }
  
  lines.push('}');
  
  // Add Display implementation
  lines.push('');
  lines.push(`impl std::fmt::Display for ${name} {`);
  lines.push('    fn fmt(&self, f: &mut std::fmt::Formatter<\'_>) -> std::fmt::Result {');
  lines.push('        match self {');
  for (const variant of enumType.variants) {
    const screaming = toSnakeCase(variant.name.name).toUpperCase();
    lines.push(`            Self::${variant.name.name} => write!(f, "${screaming}"),`);
  }
  lines.push('        }');
  lines.push('    }');
  lines.push('}');
  
  // Default implementation (first variant)
  if (enumType.variants.length > 0) {
    lines.push('');
    lines.push(`impl Default for ${name} {`);
    lines.push(`    fn default() -> Self {`);
    lines.push(`        Self::${enumType.variants[0].name.name}`);
    lines.push('    }');
    lines.push('}');
  }
  
  imports.push({ crate: 'serde', items: ['Deserialize', 'Serialize'] });
  
  return { name, code: lines.join('\n'), imports };
}

/**
 * Generate Rust struct from ISL StructType
 */
export function generateStruct(name: string, structType: StructType): GeneratedStruct {
  const lines: string[] = [];
  const imports: RustImport[] = [];
  
  // Documentation
  lines.push(`/// ${name} struct`);
  
  // Derive macros
  lines.push('#[derive(Debug, Clone, Serialize, Deserialize, Validate)]');
  
  // Struct definition
  lines.push(`pub struct ${name} {`);
  
  for (const field of structType.fields) {
    const fieldCode = generateField(field);
    lines.push(...fieldCode.lines.map(l => `    ${l}`));
    imports.push(...fieldCode.imports);
  }
  
  lines.push('}');
  
  imports.push({ crate: 'serde', items: ['Deserialize', 'Serialize'] });
  imports.push({ crate: 'validator', items: ['Validate'] });
  
  return { name, code: lines.join('\n'), imports };
}

/**
 * Generate Rust enum from ISL UnionType (tagged union)
 */
export function generateUnion(name: string, unionType: UnionType): GeneratedStruct {
  const lines: string[] = [];
  const imports: RustImport[] = [];
  
  // Documentation
  lines.push(`/// ${name} union type`);
  
  // Derive macros
  lines.push('#[derive(Debug, Clone, Serialize, Deserialize)]');
  lines.push('#[serde(tag = "type")]');
  
  // Enum definition
  lines.push(`pub enum ${name} {`);
  
  for (const variant of unionType.variants) {
    if (variant.fields.length === 0) {
      lines.push(`    ${variant.name.name},`);
    } else {
      lines.push(`    ${variant.name.name} {`);
      for (const field of variant.fields) {
        const fieldCode = generateField(field);
        lines.push(...fieldCode.lines.map(l => `        ${l}`));
        imports.push(...fieldCode.imports);
      }
      lines.push('    },');
    }
  }
  
  lines.push('}');
  
  imports.push({ crate: 'serde', items: ['Deserialize', 'Serialize'] });
  
  return { name, code: lines.join('\n'), imports };
}

/**
 * Generate lifecycle state enum from entity
 */
export function generateLifecycleEnum(
  entityName: string,
  lifecycle: LifecycleSpec
): GeneratedStruct {
  const enumName = `${entityName}Status`;
  const states = new Set<string>();
  
  for (const transition of lifecycle.transitions) {
    states.add(transition.from.name);
    states.add(transition.to.name);
  }
  
  const lines: string[] = [];
  
  // Documentation
  lines.push(`/// Lifecycle states for ${entityName}`);
  
  // Derive macros
  lines.push('#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]');
  lines.push('#[serde(rename_all = "SCREAMING_SNAKE_CASE")]');
  
  // Enum definition
  lines.push(`pub enum ${enumName} {`);
  
  for (const state of states) {
    // Capitalize first letter for Rust enum variant
    const variantName = state.charAt(0).toUpperCase() + state.slice(1);
    lines.push(`    ${variantName},`);
  }
  
  lines.push('}');
  
  // Add valid transitions method
  lines.push('');
  lines.push(`impl ${enumName} {`);
  lines.push(`    /// Check if transition to the given state is valid`);
  lines.push(`    pub fn can_transition_to(&self, target: Self) -> bool {`);
  lines.push('        match (self, target) {');
  
  for (const transition of lifecycle.transitions) {
    const from = transition.from.name.charAt(0).toUpperCase() + transition.from.name.slice(1);
    const to = transition.to.name.charAt(0).toUpperCase() + transition.to.name.slice(1);
    lines.push(`            (Self::${from}, Self::${to}) => true,`);
  }
  
  lines.push('            _ => false,');
  lines.push('        }');
  lines.push('    }');
  lines.push('}');
  
  return {
    name: enumName,
    code: lines.join('\n'),
    imports: [{ crate: 'serde', items: ['Deserialize', 'Serialize'] }],
  };
}

/**
 * Generate a single field
 */
function generateField(field: Field): { lines: string[]; imports: RustImport[] } {
  const lines: string[] = [];
  const imports: RustImport[] = [];
  
  // Serde attributes
  const serdeAttrs = generateSerdeFieldAttrs(field, field.annotations);
  lines.push(...serdeAttrs);
  
  // Validation attributes
  const validationAttrs = generateValidationFieldAttrs(field);
  lines.push(...validationAttrs);
  
  // Get Rust type
  let rustType = mapType(field.type);
  
  // Handle optional fields
  if (field.optional && field.type.kind !== 'OptionalType') {
    rustType = {
      ...rustType,
      type: `Option<${rustType.type}>`,
    };
  }
  
  imports.push(...rustType.imports);
  
  // Field definition
  const fieldName = toSnakeCase(field.name.name);
  lines.push(`pub ${fieldName}: ${rustType.type},`);
  
  return { lines, imports };
}
