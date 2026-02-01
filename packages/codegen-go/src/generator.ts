// ============================================================================
// Go Code Generator - Main Logic
// ============================================================================

import type {
  Domain,
  Entity,
  Behavior,
  TypeDeclaration,
  EnumType,
  StructType,
  UnionType,
  ConstrainedType,
  RegexLiteral,
} from './ast-types.js';

import {
  toGoName,
  toSnakeCase,
  type GoImports,
  mergeImports,
  emptyImports,
} from './types.js';

import {
  generateEntityStruct,
  generateTypeStruct,
  generateEnum,
  generateUnionInterface,
  generateLifecycleMethods,
} from './structs.js';

import {
  generateServiceInterface,
  generateBehaviorTypes,
} from './interfaces.js';

import {
  generateStructValidator,
  generateRegexValidator,
  generateValidatorRegistration,
} from './validation.js';

import { renderValidationHelpers, renderRegexValidator } from './templates/validation.tmpl.js';

// Generator options
export interface GeneratorOptions {
  outputDir: string;
  module: string;
  packageName?: string;
  includeValidation?: boolean;
  includeMocks?: boolean;
}

// Generated file
export interface GeneratedFile {
  path: string;
  content: string;
  type: 'types' | 'models' | 'interfaces' | 'validation' | 'errors';
}

// Generator result
export interface GeneratorResult {
  success: boolean;
  files: GeneratedFile[];
  errors: string[];
}

/**
 * Generate Go code from ISL Domain
 */
export function generate(domain: Domain, options: GeneratorOptions): GeneratedFile[] {
  const packageName = options.packageName ?? toSnakeCase(domain.name.name).toLowerCase();
  const files: GeneratedFile[] = [];
  const typeRegistry = buildTypeRegistry(domain);

  // Generate types.go (type aliases and enums)
  const typesFile = generateTypesFile(domain, packageName, typeRegistry);
  if (typesFile) {
    files.push(typesFile);
  }

  // Generate models.go (structs)
  const modelsFile = generateModelsFile(domain, packageName, typeRegistry);
  if (modelsFile) {
    files.push(modelsFile);
  }

  // Generate interfaces.go (service interfaces)
  const interfacesFile = generateInterfacesFile(domain, packageName, typeRegistry);
  if (interfacesFile) {
    files.push(interfacesFile);
  }

  // Generate validation.go
  if (options.includeValidation !== false) {
    const validationFile = generateValidationFile(domain, packageName, typeRegistry);
    if (validationFile) {
      files.push(validationFile);
    }
  }

  // Generate errors.go (error types for behaviors)
  const errorsFile = generateErrorsFile(domain, packageName, typeRegistry);
  if (errorsFile) {
    files.push(errorsFile);
  }

  return files;
}

/**
 * Build type registry from domain
 */
function buildTypeRegistry(domain: Domain): Map<string, string> {
  const registry = new Map<string, string>();

  // Register all type declarations
  for (const typeDecl of domain.types) {
    const goName = toGoName(typeDecl.name.name);
    registry.set(typeDecl.name.name, goName);
  }

  // Register all entities
  for (const entity of domain.entities) {
    const goName = toGoName(entity.name.name);
    registry.set(entity.name.name, goName);
  }

  return registry;
}

/**
 * Generate types.go file
 */
function generateTypesFile(
  domain: Domain,
  packageName: string,
  typeRegistry: Map<string, string>
): GeneratedFile | null {
  const imports = emptyImports();
  const sections: string[] = [];

  // Collect type aliases, enums, and union types
  for (const typeDecl of domain.types) {
    const def = typeDecl.definition;

    if (def.kind === 'EnumType') {
      const enumResult = generateEnum(typeDecl.name.name, def as EnumType);
      sections.push(enumResult.code);
    } else if (def.kind === 'UnionType') {
      const unionResult = generateUnionInterface(typeDecl.name.name, def as UnionType, typeRegistry);
      sections.push(unionResult.interface);
      for (const variant of unionResult.variants) {
        mergeInto(imports, variant.imports);
        sections.push(variant.code);
      }
    } else if (def.kind === 'ConstrainedType') {
      // Generate type alias for constrained types
      const aliasResult = generateTypeAlias(typeDecl, typeRegistry);
      mergeInto(imports, aliasResult.imports);
      sections.push(aliasResult.code);
    }
  }

  if (sections.length === 0) {
    return null;
  }

  const content = formatGoFile(packageName, imports, sections);

  return {
    path: `${packageName}/types.go`,
    content,
    type: 'types',
  };
}

/**
 * Generate type alias for constrained type
 */
function generateTypeAlias(
  typeDecl: TypeDeclaration,
  typeRegistry: Map<string, string>
): { code: string; imports: GoImports } {
  const imports = emptyImports();
  const def = typeDecl.definition;
  const goName = toGoName(typeDecl.name.name);

  if (def.kind !== 'ConstrainedType') {
    return { code: '', imports };
  }

  const constrained = def as ConstrainedType;
  
  // Get base type
  let baseType = 'string';
  if (constrained.base.kind === 'PrimitiveType') {
    const primitiveMap: Record<string, string> = {
      String: 'string',
      Int: 'int64',
      Decimal: 'decimal.Decimal',
      Boolean: 'bool',
      Timestamp: 'time.Time',
      UUID: 'uuid.UUID',
      Duration: 'time.Duration',
    };
    baseType = primitiveMap[constrained.base.name] ?? 'string';
    
    if (baseType.includes('.')) {
      const parts = baseType.split('.');
      if (parts[0] === 'decimal') {
        imports.external.add('github.com/shopspring/decimal');
      } else if (parts[0] === 'uuid') {
        imports.external.add('github.com/google/uuid');
      } else if (parts[0] === 'time') {
        imports.standard.add('time');
      }
    }
  }

  const lines: string[] = [];
  lines.push(`// ${goName} is a constrained type based on ${baseType}.`);
  lines.push(`type ${goName} ${baseType}`);

  return { code: lines.join('\n'), imports };
}

/**
 * Generate models.go file
 */
function generateModelsFile(
  domain: Domain,
  packageName: string,
  typeRegistry: Map<string, string>
): GeneratedFile | null {
  const imports = emptyImports();
  const sections: string[] = [];

  // Generate entity structs
  for (const entity of domain.entities) {
    const structResult = generateEntityStruct(entity, typeRegistry);
    mergeInto(imports, structResult.imports);
    sections.push(structResult.code);

    // Generate lifecycle methods if present
    const lifecycleMethods = generateLifecycleMethods(entity);
    if (lifecycleMethods) {
      sections.push(lifecycleMethods);
    }
  }

  // Generate struct types
  for (const typeDecl of domain.types) {
    if (typeDecl.definition.kind === 'StructType') {
      const structResult = generateTypeStruct(typeDecl, typeRegistry);
      if (structResult) {
        mergeInto(imports, structResult.imports);
        sections.push(structResult.code);
      }
    }
  }

  if (sections.length === 0) {
    return null;
  }

  const content = formatGoFile(packageName, imports, sections);

  return {
    path: `${packageName}/models.go`,
    content,
    type: 'models',
  };
}

/**
 * Generate interfaces.go file
 */
function generateInterfacesFile(
  domain: Domain,
  packageName: string,
  typeRegistry: Map<string, string>
): GeneratedFile | null {
  const imports = emptyImports();
  imports.standard.add('context');
  const sections: string[] = [];

  if (domain.behaviors.length === 0) {
    return null;
  }

  // Generate service interface
  const interfaceResult = generateServiceInterface(domain.name.name, domain.behaviors, typeRegistry);
  mergeInto(imports, interfaceResult.imports);
  sections.push(interfaceResult.code);

  // Generate input/output structs for each behavior
  for (const behavior of domain.behaviors) {
    const typesResult = generateBehaviorTypes(behavior, typeRegistry);
    mergeInto(imports, typesResult.imports);
    sections.push(typesResult.inputStruct);
    sections.push(typesResult.outputStruct);
  }

  const content = formatGoFile(packageName, imports, sections);

  return {
    path: `${packageName}/interfaces.go`,
    content,
    type: 'interfaces',
  };
}

/**
 * Generate validation.go file
 */
function generateValidationFile(
  domain: Domain,
  packageName: string,
  typeRegistry: Map<string, string>
): GeneratedFile | null {
  const customValidators: { name: string; funcName: string; pattern: string; code: string }[] = [];
  const types: { name: string; hasCustomValidation: boolean }[] = [];

  // Collect types that need validation
  for (const entity of domain.entities) {
    types.push({ name: toGoName(entity.name.name), hasCustomValidation: false });
  }

  for (const behavior of domain.behaviors) {
    types.push({ name: `${toGoName(behavior.name.name)}Input`, hasCustomValidation: false });
  }

  // Look for regex patterns in constrained types
  for (const typeDecl of domain.types) {
    if (typeDecl.definition.kind === 'ConstrainedType') {
      const constrained = typeDecl.definition as ConstrainedType;
      for (const constraint of constrained.constraints) {
        if (constraint.name === 'format' && constraint.value.kind === 'RegexLiteral') {
          const regex = constraint.value as RegexLiteral;
          const validatorData = renderRegexValidator(typeDecl.name.name, regex.pattern);
          customValidators.push(validatorData);
        }
        if (constraint.name === 'pattern' && constraint.value.kind === 'RegexLiteral') {
          const regex = constraint.value as RegexLiteral;
          const validatorData = renderRegexValidator(typeDecl.name.name, regex.pattern);
          customValidators.push(validatorData);
        }
      }
    }
  }

  if (types.length === 0) {
    return null;
  }

  const content = renderValidationHelpers({
    PackageName: packageName,
    Types: types,
    CustomValidators: customValidators,
  });

  return {
    path: `${packageName}/validation.go`,
    content,
    type: 'validation',
  };
}

/**
 * Generate errors.go file
 */
function generateErrorsFile(
  domain: Domain,
  packageName: string,
  typeRegistry: Map<string, string>
): GeneratedFile | null {
  const imports = emptyImports();
  imports.standard.add('fmt');
  const sections: string[] = [];

  // Generate error types for each behavior
  for (const behavior of domain.behaviors) {
    if (behavior.output.errors.length === 0) {
      continue;
    }

    const typesResult = generateBehaviorTypes(behavior, typeRegistry);
    mergeInto(imports, typesResult.imports);
    sections.push(...typesResult.errorTypes);
  }

  if (sections.length === 0) {
    return null;
  }

  const content = formatGoFile(packageName, imports, sections);

  return {
    path: `${packageName}/errors.go`,
    content,
    type: 'errors',
  };
}

/**
 * Format complete Go file with package, imports, and content
 */
function formatGoFile(packageName: string, imports: GoImports, sections: string[]): string {
  const lines: string[] = [];

  // Package declaration
  lines.push(`// Code generated by @isl-lang/codegen-go. DO NOT EDIT.`);
  lines.push(`package ${packageName}`);
  lines.push('');

  // Imports
  if (imports.standard.size > 0 || imports.external.size > 0) {
    lines.push('import (');

    // Standard library imports first
    const stdImports = Array.from(imports.standard).sort();
    for (const imp of stdImports) {
      lines.push(`\t"${imp}"`);
    }

    // Blank line between standard and external
    if (imports.standard.size > 0 && imports.external.size > 0) {
      lines.push('');
    }

    // External imports
    const extImports = Array.from(imports.external).sort();
    for (const imp of extImports) {
      lines.push(`\t"${imp}"`);
    }

    lines.push(')');
    lines.push('');
  }

  // Content sections
  for (let i = 0; i < sections.length; i++) {
    lines.push(sections[i]!);
    if (i < sections.length - 1) {
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Merge imports in place
 */
function mergeInto(target: GoImports, source: GoImports): void {
  source.standard.forEach(i => target.standard.add(i));
  source.external.forEach(i => target.external.add(i));
}
