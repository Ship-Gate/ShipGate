// ============================================================================
// Go Struct Generator - Entities to Go Structs
// ============================================================================

import type {
  Entity,
  Field,
  TypeDeclaration,
  EnumType,
  StructType,
  UnionType,
} from './ast-types.js';

import {
  mapType,
  toGoName,
  generateJsonTag,
  type GoImports,
  emptyImports,
} from './types.js';

import { generateValidationTag } from './validation.js';

// Generated struct result
export interface GeneratedStruct {
  name: string;
  code: string;
  imports: GoImports;
}

// Generated enum result
export interface GeneratedEnum {
  name: string;
  code: string;
}

/**
 * Generate Go struct from ISL Entity
 */
export function generateEntityStruct(
  entity: Entity,
  typeRegistry: Map<string, string> = new Map()
): GeneratedStruct {
  const structName = toGoName(entity.name.name);
  const imports = emptyImports();
  const lines: string[] = [];

  // Doc comment
  lines.push(`// ${structName} represents the ${entity.name.name} entity.`);
  lines.push(`type ${structName} struct {`);

  // Generate fields
  for (const field of entity.fields) {
    const fieldResult = generateStructField(field, typeRegistry);
    mergeInto(imports, fieldResult.imports);
    lines.push(`\t${fieldResult.code}`);
  }

  lines.push('}');

  return {
    name: structName,
    code: lines.join('\n'),
    imports,
  };
}

/**
 * Generate Go struct from ISL TypeDeclaration with StructType
 */
export function generateTypeStruct(
  typeDecl: TypeDeclaration,
  typeRegistry: Map<string, string> = new Map()
): GeneratedStruct | null {
  if (typeDecl.definition.kind !== 'StructType') {
    return null;
  }

  const structDef = typeDecl.definition as StructType;
  const structName = toGoName(typeDecl.name.name);
  const imports = emptyImports();
  const lines: string[] = [];

  // Doc comment
  lines.push(`// ${structName} represents the ${typeDecl.name.name} type.`);
  lines.push(`type ${structName} struct {`);

  // Generate fields
  for (const field of structDef.fields) {
    const fieldResult = generateStructField(field, typeRegistry);
    mergeInto(imports, fieldResult.imports);
    lines.push(`\t${fieldResult.code}`);
  }

  lines.push('}');

  return {
    name: structName,
    code: lines.join('\n'),
    imports,
  };
}

/**
 * Generate Go enum (type alias with constants) from ISL EnumType
 */
export function generateEnum(
  name: string,
  enumType: EnumType
): GeneratedEnum {
  const enumName = toGoName(name);
  const lines: string[] = [];

  // Type definition
  lines.push(`// ${enumName} represents the ${name} enum.`);
  lines.push(`type ${enumName} string`);
  lines.push('');

  // Enum constants
  lines.push('const (');
  for (const variant of enumType.variants) {
    const constName = `${enumName}${toGoName(variant.name.name)}`;
    const value = variant.name.name;
    lines.push(`\t${constName} ${enumName} = "${value}"`);
  }
  lines.push(')');
  lines.push('');

  // Valid values function
  lines.push(`// ${enumName}Values returns all valid ${enumName} values.`);
  lines.push(`func ${enumName}Values() []${enumName} {`);
  lines.push(`\treturn []${enumName}{`);
  for (const variant of enumType.variants) {
    const constName = `${enumName}${toGoName(variant.name.name)}`;
    lines.push(`\t\t${constName},`);
  }
  lines.push('\t}');
  lines.push('}');
  lines.push('');

  // IsValid method
  lines.push(`// IsValid checks if the ${enumName} value is valid.`);
  lines.push(`func (e ${enumName}) IsValid() bool {`);
  lines.push(`\tswitch e {`);
  for (const variant of enumType.variants) {
    const constName = `${enumName}${toGoName(variant.name.name)}`;
    lines.push(`\tcase ${constName}:`);
  }
  lines.push(`\t\treturn true`);
  lines.push(`\tdefault:`);
  lines.push(`\t\treturn false`);
  lines.push(`\t}`);
  lines.push('}');

  return {
    name: enumName,
    code: lines.join('\n'),
  };
}

/**
 * Generate Go interface from ISL UnionType
 */
export function generateUnionInterface(
  name: string,
  unionType: UnionType,
  typeRegistry: Map<string, string> = new Map()
): { interface: string; variants: GeneratedStruct[] } {
  const interfaceName = toGoName(name);
  const lines: string[] = [];
  const variants: GeneratedStruct[] = [];

  // Interface definition
  lines.push(`// ${interfaceName} is a union type with multiple variants.`);
  lines.push(`type ${interfaceName} interface {`);
  lines.push(`\tis${interfaceName}()`);
  lines.push('}');
  lines.push('');

  // Generate variant structs
  for (const variant of unionType.variants) {
    const variantName = `${interfaceName}${toGoName(variant.name.name)}`;
    const imports = emptyImports();
    const variantLines: string[] = [];

    variantLines.push(`// ${variantName} is a variant of ${interfaceName}.`);
    variantLines.push(`type ${variantName} struct {`);

    for (const field of variant.fields) {
      const fieldResult = generateStructField(field, typeRegistry);
      mergeInto(imports, fieldResult.imports);
      variantLines.push(`\t${fieldResult.code}`);
    }

    variantLines.push('}');
    variantLines.push('');

    // Interface implementation
    variantLines.push(`func (${variantName}) is${interfaceName}() {}`);

    variants.push({
      name: variantName,
      code: variantLines.join('\n'),
      imports,
    });
  }

  return {
    interface: lines.join('\n'),
    variants,
  };
}

/**
 * Generate a single struct field
 */
function generateStructField(
  field: Field,
  typeRegistry: Map<string, string>
): { code: string; imports: GoImports } {
  const fieldName = toGoName(field.name.name);
  const typeResult = mapType(field.type, typeRegistry);
  
  // Apply optional type wrapping if needed
  let goType = typeResult.typeName;
  if (field.optional && !goType.startsWith('*')) {
    goType = `*${goType}`;
  }

  // Generate tags
  const tags: string[] = [];
  
  // JSON tag
  tags.push(generateJsonTag(field.name.name, field.optional));
  
  // Validation tag
  const validationTag = generateValidationTag(field);
  if (validationTag) {
    tags.push(validationTag);
  }

  const tagString = tags.length > 0 ? ` \`${tags.join(' ')}\`` : '';

  return {
    code: `${fieldName} ${goType}${tagString}`,
    imports: typeResult.imports,
  };
}

/**
 * Generate lifecycle status field and methods for entities with lifecycle
 */
export function generateLifecycleMethods(
  entity: Entity
): string | null {
  if (!entity.lifecycle) {
    return null;
  }

  const entityName = toGoName(entity.name.name);
  const lines: string[] = [];

  // Collect unique states
  const states = new Set<string>();
  for (const transition of entity.lifecycle.transitions) {
    states.add(transition.from.name);
    states.add(transition.to.name);
  }

  // Generate transition validation method
  lines.push(`// CanTransitionTo checks if the ${entityName} can transition to the target status.`);
  lines.push(`func (e *${entityName}) CanTransitionTo(target string) bool {`);
  lines.push(`\tvalidTransitions := map[string][]string{`);

  // Build transition map
  const transitionMap = new Map<string, string[]>();
  for (const transition of entity.lifecycle.transitions) {
    const from = transition.from.name;
    const to = transition.to.name;
    if (!transitionMap.has(from)) {
      transitionMap.set(from, []);
    }
    transitionMap.get(from)!.push(to);
  }

  for (const [from, toList] of transitionMap) {
    const toStr = toList.map(t => `"${t}"`).join(', ');
    lines.push(`\t\t"${from}": {${toStr}},`);
  }

  lines.push(`\t}`);
  lines.push('');
  lines.push(`\tallowed, ok := validTransitions[string(e.Status)]`);
  lines.push(`\tif !ok {`);
  lines.push(`\t\treturn false`);
  lines.push(`\t}`);
  lines.push('');
  lines.push(`\tfor _, s := range allowed {`);
  lines.push(`\t\tif s == target {`);
  lines.push(`\t\t\treturn true`);
  lines.push(`\t\t}`);
  lines.push(`\t}`);
  lines.push(`\treturn false`);
  lines.push('}');

  return lines.join('\n');
}

/**
 * Merge imports in place
 */
function mergeInto(target: GoImports, source: GoImports): void {
  source.standard.forEach(i => target.standard.add(i));
  source.external.forEach(i => target.external.add(i));
}
