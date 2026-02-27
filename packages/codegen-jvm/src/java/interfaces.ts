// ============================================================================
// ISL JVM Code Generator - Java Service Interfaces
// ============================================================================

import type {
  Domain,
  Behavior,
  Entity,
  TypeDefinition,
} from '@isl-lang/parser';
import type { GeneratorOptions } from '../generator';

// ============================================================================
// SERVICE INTERFACE GENERATOR
// ============================================================================

export function generateJavaInterfaces(
  domain: Domain,
  options: GeneratorOptions
): string {
  const serviceName = `${domain.name.name}Service`;
  const lines: string[] = [];

  // Package declaration
  lines.push(`package ${options.package}.services;`);
  lines.push('');

  // Imports
  lines.push(`import ${options.package}.behaviors.*;`);
  lines.push(`import ${options.package}.entities.*;`);
  lines.push('import java.util.List;');
  lines.push('import java.util.Optional;');
  lines.push('import java.util.UUID;');
  lines.push('');

  // Interface Javadoc
  lines.push('/**');
  lines.push(` * Service interface for ${domain.name.name} domain.`);
  lines.push(' * Generated from ISL specification.');
  lines.push(' */');

  // Interface declaration
  lines.push(`public interface ${serviceName} {`);
  lines.push('');

  // Generate method for each behavior
  for (const behavior of domain.behaviors) {
    lines.push(generateBehaviorMethod(behavior, options));
    lines.push('');
  }

  // Generate CRUD methods for each entity
  for (const entity of domain.entities) {
    lines.push(generateEntityMethods(entity, options));
    lines.push('');
  }

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// BEHAVIOR METHOD GENERATION
// ============================================================================

function generateBehaviorMethod(behavior: Behavior, _options: GeneratorOptions): string {
  const lines: string[] = [];
  const methodName = toCamelCase(behavior.name.name);
  const inputType = `${behavior.name.name}Input`;
  const resultType = `${behavior.name.name}Result`;

  // Method Javadoc
  if (behavior.description) {
    lines.push('    /**');
    lines.push(`     * ${behavior.description.value}`);
    lines.push('     *');
    lines.push(`     * @param input the ${inputType}`);
    lines.push(`     * @return ${resultType} - success or error`);
    lines.push('     */');
  }

  // Method signature
  lines.push(`    ${resultType} ${methodName}(${inputType} input);`);

  return lines.join('\n');
}

// ============================================================================
// ENTITY CRUD METHODS
// ============================================================================

function generateEntityMethods(entity: Entity, _options: GeneratorOptions): string {
  const lines: string[] = [];
  const name = entity.name.name;
  const varName = toCamelCase(name);

  // Find ID field
  const idField = entity.fields.find(f => 
    f.name.name === 'id' || 
    f.annotations.some(a => a.name.name === 'unique' || a.name.name === 'immutable')
  );
  const idType = idField ? javaType(idField.type) : 'UUID';

  // Find by ID
  lines.push('    /**');
  lines.push(`     * Find ${name} by ID.`);
  lines.push('     */');
  lines.push(`    Optional<${name}> find${name}ById(${idType} id);`);
  lines.push('');

  // Find all
  lines.push('    /**');
  lines.push(`     * Find all ${name} entities.`);
  lines.push('     */');
  lines.push(`    List<${name}> findAll${name}s();`);
  lines.push('');

  // Find by unique fields
  const uniqueFields = entity.fields.filter(f => 
    f.annotations.some(a => a.name.name === 'unique') && f.name.name !== 'id'
  );

  for (const field of uniqueFields) {
    const fieldName = toPascalCase(field.name.name);
    const fieldType = javaType(field.type);
    const paramName = toCamelCase(field.name.name);

    lines.push('    /**');
    lines.push(`     * Find ${name} by ${field.name.name}.`);
    lines.push('     */');
    lines.push(`    Optional<${name}> find${name}By${fieldName}(${fieldType} ${paramName});`);
    lines.push('');
  }

  // Save
  lines.push('    /**');
  lines.push(`     * Save ${name} entity.`);
  lines.push('     */');
  lines.push(`    ${name} save${name}(${name} ${varName});`);
  lines.push('');

  // Delete
  lines.push('    /**');
  lines.push(`     * Delete ${name} by ID.`);
  lines.push('     */');
  lines.push(`    void delete${name}ById(${idType} id);`);

  return lines.join('\n');
}

// ============================================================================
// REPOSITORY INTERFACE GENERATION
// ============================================================================

export function generateJavaRepository(
  entity: Entity,
  options: GeneratorOptions
): string {
  const name = entity.name.name;
  const lines: string[] = [];

  // Package declaration
  lines.push(`package ${options.package}.repositories;`);
  lines.push('');

  // Imports
  lines.push(`import ${options.package}.entities.${name};`);
  lines.push('import org.springframework.data.jpa.repository.JpaRepository;');
  lines.push('import org.springframework.stereotype.Repository;');
  lines.push('import java.util.Optional;');
  lines.push('import java.util.UUID;');
  lines.push('');

  // Find ID type
  const idField = entity.fields.find(f => f.name.name === 'id');
  const idType = idField ? javaType(idField.type) : 'UUID';

  // Interface declaration
  lines.push('@Repository');
  lines.push(`public interface ${name}Repository extends JpaRepository<${name}, ${idType}> {`);
  lines.push('');

  // Custom finder methods for unique/indexed fields
  const queryFields = entity.fields.filter(f => 
    f.annotations.some(a => a.name.name === 'unique' || a.name.name === 'indexed') &&
    f.name.name !== 'id'
  );

  for (const field of queryFields) {
    const fieldName = toPascalCase(field.name.name);
    const fieldType = javaType(field.type);
    const isUnique = field.annotations.some(a => a.name.name === 'unique');
    const returnType = isUnique ? `Optional<${name}>` : `List<${name}>`;

    lines.push(`    ${returnType} findBy${fieldName}(${fieldType} ${toCamelCase(field.name.name)});`);
    lines.push('');
  }

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// TYPE MAPPING
// ============================================================================

function javaType(def: TypeDefinition): string {
  switch (def.kind) {
    case 'PrimitiveType':
      switch (def.name) {
        case 'String': return 'String';
        case 'Int': return 'Integer';
        case 'Decimal': return 'java.math.BigDecimal';
        case 'Boolean': return 'Boolean';
        case 'Timestamp': return 'java.time.Instant';
        case 'UUID': return 'UUID';
        case 'Duration': return 'java.time.Duration';
        default: return 'Object';
      }
    case 'ListType':
      return `List<${javaType(def.element)}>`;
    case 'MapType':
      return `Map<${javaType(def.key)}, ${javaType(def.value)}>`;
    case 'OptionalType':
      return javaType(def.inner);
    case 'ReferenceType':
      return def.name.parts.map(p => p.name).join('.');
    case 'ConstrainedType':
      return javaType(def.base);
    default:
      return 'Object';
  }
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
