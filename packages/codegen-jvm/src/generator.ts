// ============================================================================
// ISL JVM Code Generator - Main Generator
// ============================================================================

import type {
  Domain,
  TypeDeclaration,
  Entity,
  Behavior,
  Field,
  TypeDefinition,
  EnumType,
  StructType,
  UnionType,
} from '../../../master_contracts/ast';

import { generateJavaTypes, generateJavaTypeImports } from './java/types';
import { generateJavaRecords } from './java/records';
import { generateJavaInterfaces } from './java/interfaces';
import { generateJavaValidation } from './java/validation';
import { generateSpringController, generateSpringConfig } from './java/spring';
import { generateKotlinTypes, generateKotlinTypeImports } from './kotlin/types';
import { generateKotlinDataClasses } from './kotlin/dataclass';
import { generateKotlinSealed } from './kotlin/sealed';
import { generateKotlinCoroutines } from './kotlin/coroutines';

// ============================================================================
// TYPES
// ============================================================================

export interface GeneratorOptions {
  language: 'java' | 'kotlin';
  javaVersion?: 17 | 21;
  framework?: 'spring' | 'quarkus' | 'micronaut' | 'none';
  package: string;
  generateValidation?: boolean;
  generateOpenApi?: boolean;
  useSuspend?: boolean; // Kotlin coroutines
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'type' | 'entity' | 'behavior' | 'service' | 'controller' | 'config';
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generate(domain: Domain, options: GeneratorOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const packagePath = options.package.replace(/\./g, '/');

  if (options.language === 'java') {
    files.push(...generateJava(domain, options, packagePath));
  } else {
    files.push(...generateKotlin(domain, options, packagePath));
  }

  return files;
}

// ============================================================================
// JAVA GENERATION
// ============================================================================

function generateJava(
  domain: Domain,
  options: GeneratorOptions,
  packagePath: string
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const javaVersion = options.javaVersion ?? 17;
  const framework = options.framework ?? 'none';

  // Generate custom types (value objects)
  for (const type of domain.types) {
    const content = generateJavaTypeFile(type, options);
    files.push({
      path: `${packagePath}/types/${type.name.name}.java`,
      content,
      type: 'type',
    });
  }

  // Generate entities as records
  for (const entity of domain.entities) {
    const content = generateJavaEntityFile(entity, domain, options);
    files.push({
      path: `${packagePath}/entities/${entity.name.name}.java`,
      content,
      type: 'entity',
    });
  }

  // Generate behavior input/output/result types
  for (const behavior of domain.behaviors) {
    const inputOutput = generateJavaBehaviorTypes(behavior, domain, options);
    files.push({
      path: `${packagePath}/behaviors/${behavior.name.name}Types.java`,
      content: inputOutput,
      type: 'behavior',
    });
  }

  // Generate service interfaces
  const serviceInterface = generateJavaServiceInterface(domain, options);
  files.push({
    path: `${packagePath}/services/${domain.name.name}Service.java`,
    content: serviceInterface,
    type: 'service',
  });

  // Generate framework-specific code
  if (framework === 'spring') {
    const controller = generateSpringController(domain, options);
    files.push({
      path: `${packagePath}/controllers/${domain.name.name}Controller.java`,
      content: controller,
      type: 'controller',
    });

    const config = generateSpringConfig(domain, options);
    files.push({
      path: `${packagePath}/config/${domain.name.name}Config.java`,
      content: config,
      type: 'config',
    });
  }

  return files;
}

// ============================================================================
// KOTLIN GENERATION
// ============================================================================

function generateKotlin(
  domain: Domain,
  options: GeneratorOptions,
  packagePath: string
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const useSuspend = options.useSuspend ?? true;

  // Generate types file (all value classes in one file)
  const typesContent = generateKotlinTypesFile(domain, options);
  files.push({
    path: `${packagePath}/Types.kt`,
    content: typesContent,
    type: 'type',
  });

  // Generate entities as data classes
  const entitiesContent = generateKotlinEntitiesFile(domain, options);
  files.push({
    path: `${packagePath}/Entities.kt`,
    content: entitiesContent,
    type: 'entity',
  });

  // Generate behavior types (sealed classes for results)
  for (const behavior of domain.behaviors) {
    const content = generateKotlinBehaviorFile(behavior, domain, options);
    files.push({
      path: `${packagePath}/behaviors/${behavior.name.name}.kt`,
      content,
      type: 'behavior',
    });
  }

  // Generate service interface
  const serviceContent = generateKotlinServiceFile(domain, options);
  files.push({
    path: `${packagePath}/${domain.name.name}Service.kt`,
    content: serviceContent,
    type: 'service',
  });

  return files;
}

// ============================================================================
// JAVA FILE GENERATORS
// ============================================================================

function generateJavaTypeFile(
  type: TypeDeclaration,
  options: GeneratorOptions
): string {
  const lines: string[] = [];
  const pkg = options.package;

  lines.push(`package ${pkg}.types;`);
  lines.push('');
  lines.push(...generateJavaTypeImports(type.definition));
  lines.push('');
  lines.push(generateJavaTypes(type, options));

  return lines.join('\n');
}

function generateJavaEntityFile(
  entity: Entity,
  domain: Domain,
  options: GeneratorOptions
): string {
  const lines: string[] = [];
  const pkg = options.package;

  lines.push(`package ${pkg}.entities;`);
  lines.push('');
  lines.push(`import ${pkg}.types.*;`);
  lines.push('import java.util.UUID;');
  lines.push('import java.time.Instant;');
  lines.push('import java.util.List;');
  lines.push('import java.util.Map;');
  if (options.generateValidation !== false) {
    lines.push('import jakarta.validation.constraints.*;');
  }
  lines.push('');
  lines.push(generateJavaRecords(entity, options));

  return lines.join('\n');
}

function generateJavaBehaviorTypes(
  behavior: Behavior,
  domain: Domain,
  options: GeneratorOptions
): string {
  const lines: string[] = [];
  const pkg = options.package;
  const name = behavior.name.name;

  lines.push(`package ${pkg}.behaviors;`);
  lines.push('');
  lines.push(`import ${pkg}.types.*;`);
  lines.push(`import ${pkg}.entities.*;`);
  lines.push('import java.util.UUID;');
  lines.push('import java.time.Instant;');
  if (options.generateValidation !== false) {
    lines.push('import jakarta.validation.constraints.*;');
  }
  lines.push('');

  // Generate Input record
  lines.push(generateJavaInputRecord(behavior, options));
  lines.push('');

  // Generate Result sealed interface
  lines.push(generateJavaResultSealed(behavior, options));

  return lines.join('\n');
}

function generateJavaInputRecord(behavior: Behavior, options: GeneratorOptions): string {
  const name = behavior.name.name;
  const fields = behavior.input.fields;
  const lines: string[] = [];

  lines.push(`public record ${name}Input(`);
  const fieldLines = fields.map((field, idx) => {
    const annotations = generateJavaFieldAnnotations(field, options);
    const type = javaType(field.type);
    const fieldName = toCamelCase(field.name.name);
    const comma = idx < fields.length - 1 ? ',' : '';
    return `    ${annotations}${type} ${fieldName}${comma}`;
  });
  lines.push(fieldLines.join('\n'));
  lines.push(') {}');

  return lines.join('\n');
}

function generateJavaResultSealed(behavior: Behavior, options: GeneratorOptions): string {
  const name = behavior.name.name;
  const lines: string[] = [];

  lines.push(`public sealed interface ${name}Result {`);

  // Success case
  const successType = javaType(behavior.output.success);
  lines.push(`    record Success(${successType} value) implements ${name}Result {}`);

  // Error cases
  for (const error of behavior.output.errors) {
    const errorName = toPascalCase(error.name.name);
    if (error.returns) {
      const returnType = javaType(error.returns);
      lines.push(`    record ${errorName}(${returnType} details) implements ${name}Result {}`);
    } else {
      lines.push(`    record ${errorName}() implements ${name}Result {}`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

function generateJavaServiceInterface(domain: Domain, options: GeneratorOptions): string {
  const lines: string[] = [];
  const pkg = options.package;
  const serviceName = `${domain.name.name}Service`;

  lines.push(`package ${pkg}.services;`);
  lines.push('');
  lines.push(`import ${pkg}.behaviors.*;`);
  lines.push('');
  lines.push(`public interface ${serviceName} {`);

  for (const behavior of domain.behaviors) {
    const methodName = toCamelCase(behavior.name.name);
    const inputType = `${behavior.name.name}Input`;
    const resultType = `${behavior.name.name}Result`;
    lines.push(`    ${resultType} ${methodName}(${inputType} input);`);
  }

  lines.push('}');
  return lines.join('\n');
}

// ============================================================================
// KOTLIN FILE GENERATORS
// ============================================================================

function generateKotlinTypesFile(domain: Domain, options: GeneratorOptions): string {
  const lines: string[] = [];
  const pkg = options.package;

  lines.push(`package ${pkg}`);
  lines.push('');
  lines.push(...generateKotlinTypeImports());
  lines.push('');

  for (const type of domain.types) {
    lines.push(generateKotlinTypes(type, options));
    lines.push('');
  }

  return lines.join('\n');
}

function generateKotlinEntitiesFile(domain: Domain, options: GeneratorOptions): string {
  const lines: string[] = [];
  const pkg = options.package;

  lines.push(`package ${pkg}`);
  lines.push('');
  lines.push('import java.util.UUID');
  lines.push('import java.time.Instant');
  lines.push('');

  for (const entity of domain.entities) {
    lines.push(generateKotlinDataClasses(entity, options));
    lines.push('');
  }

  return lines.join('\n');
}

function generateKotlinBehaviorFile(
  behavior: Behavior,
  domain: Domain,
  options: GeneratorOptions
): string {
  const lines: string[] = [];
  const pkg = options.package;
  const name = behavior.name.name;

  lines.push(`package ${pkg}.behaviors`);
  lines.push('');
  lines.push(`import ${pkg}.*`);
  lines.push('import java.util.UUID');
  lines.push('import java.time.Instant');
  lines.push('');

  // Input data class
  lines.push(generateKotlinInputClass(behavior, options));
  lines.push('');

  // Result sealed class
  lines.push(generateKotlinSealed(behavior, options));

  return lines.join('\n');
}

function generateKotlinInputClass(behavior: Behavior, options: GeneratorOptions): string {
  const name = behavior.name.name;
  const fields = behavior.input.fields;
  const lines: string[] = [];

  lines.push(`data class ${name}Input(`);
  const fieldLines = fields.map((field, idx) => {
    const type = kotlinType(field.type, field.optional);
    const fieldName = toCamelCase(field.name.name);
    const comma = idx < fields.length - 1 ? ',' : '';
    return `    val ${fieldName}: ${type}${comma}`;
  });
  lines.push(fieldLines.join('\n'));
  lines.push(')');

  return lines.join('\n');
}

function generateKotlinServiceFile(domain: Domain, options: GeneratorOptions): string {
  const lines: string[] = [];
  const pkg = options.package;
  const serviceName = `${domain.name.name}Service`;
  const useSuspend = options.useSuspend ?? true;

  lines.push(`package ${pkg}`);
  lines.push('');
  lines.push(`import ${pkg}.behaviors.*`);
  lines.push('');
  lines.push(`interface ${serviceName} {`);

  for (const behavior of domain.behaviors) {
    const methodName = toCamelCase(behavior.name.name);
    const inputType = `${behavior.name.name}Input`;
    const resultType = `${behavior.name.name}Result`;
    const suspend = useSuspend ? 'suspend ' : '';
    lines.push(`    ${suspend}fun ${methodName}(input: ${inputType}): ${resultType}`);
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
        case 'Timestamp': return 'Instant';
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

function kotlinType(def: TypeDefinition, optional: boolean = false): string {
  let base: string;

  switch (def.kind) {
    case 'PrimitiveType':
      switch (def.name) {
        case 'String': base = 'String'; break;
        case 'Int': base = 'Int'; break;
        case 'Decimal': base = 'java.math.BigDecimal'; break;
        case 'Boolean': base = 'Boolean'; break;
        case 'Timestamp': base = 'Instant'; break;
        case 'UUID': base = 'UUID'; break;
        case 'Duration': base = 'java.time.Duration'; break;
        default: base = 'Any';
      }
      break;
    case 'ListType':
      base = `List<${kotlinType(def.element)}>`;
      break;
    case 'MapType':
      base = `Map<${kotlinType(def.key)}, ${kotlinType(def.value)}>`;
      break;
    case 'OptionalType':
      return `${kotlinType(def.inner)}?`;
    case 'ReferenceType':
      base = def.name.parts.map(p => p.name).join('.');
      break;
    case 'ConstrainedType':
      base = kotlinType(def.base);
      break;
    default:
      base = 'Any';
  }

  return optional ? `${base}?` : base;
}

// ============================================================================
// ANNOTATION GENERATION
// ============================================================================

function generateJavaFieldAnnotations(field: Field, options: GeneratorOptions): string {
  if (options.generateValidation === false) return '';

  const annotations: string[] = [];

  if (!field.optional) {
    annotations.push('@NotNull ');
  }

  for (const ann of field.annotations) {
    switch (ann.name.name) {
      case 'email':
        annotations.push('@Email ');
        break;
      case 'min':
        if (ann.value && ann.value.kind === 'NumberLiteral') {
          annotations.push(`@Min(${ann.value.value}) `);
        }
        break;
      case 'max':
        if (ann.value && ann.value.kind === 'NumberLiteral') {
          annotations.push(`@Max(${ann.value.value}) `);
        }
        break;
      case 'size':
        if (ann.value && ann.value.kind === 'NumberLiteral') {
          annotations.push(`@Size(max = ${ann.value.value}) `);
        }
        break;
    }
  }

  return annotations.join('');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toPascalCase(str: string): string {
  return str.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join('');
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}
