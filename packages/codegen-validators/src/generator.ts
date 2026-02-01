// ============================================================================
// Runtime Validator Generator
// Transforms ISL domains into runtime validators
// ============================================================================

import type * as AST from '@intentos/isl-core';
import type { GenerateOptions, GeneratedFile, ValidatorDefinition } from './types';
import * as zod from './libraries/zod';
import * as yup from './libraries/yup';

/**
 * Generate runtime validators from ISL domain
 */
export function generate(
  domain: AST.Domain,
  options: GenerateOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const validators: ValidatorDefinition[] = [];

  switch (options.library) {
    case 'zod':
      return generateZodValidators(domain, options);
    case 'yup':
      return generateYupValidators(domain, options);
    default:
      throw new Error(`Unsupported library: ${options.library}`);
  }
}

/**
 * Generate Zod validators
 */
function generateZodValidators(
  domain: AST.Domain,
  options: GenerateOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const validators: ValidatorDefinition[] = [];
  const exports: string[] = [];

  // Generate enum validators
  for (const typeDecl of domain.types || []) {
    if (typeDecl.definition.kind === 'enum') {
      const validator = zod.generateZodEnum(typeDecl, options);
      validators.push(validator);
      exports.push(`${validator.name}Schema`);
    }
  }

  // Generate entity validators
  for (const entity of domain.entities || []) {
    const validator = zod.generateZodEntity(entity, options);
    validators.push(validator);
    exports.push(`${validator.name}Schema`);
  }

  // Generate behavior input validators
  for (const behavior of domain.behaviors || []) {
    const validator = zod.generateZodBehaviorInput(behavior, options);
    if (validator) {
      validators.push(validator);
      exports.push(validator.name);
    }
  }

  if (options.splitFiles) {
    // Generate separate files
    for (const validator of validators) {
      const content = zod.generateZodHeader() + validator.schemaCode + '\n\n' + (validator.typeCode || '');
      files.push({
        path: `${toKebabCase(validator.name)}.ts`,
        content,
        exports: [validator.name],
      });
    }

    // Generate index file
    files.push({
      path: 'index.ts',
      content: generateBarrelExport(validators, 'zod'),
      exports: [],
    });
  } else {
    // Generate single file
    const lines: string[] = [zod.generateZodHeader()];

    for (const validator of validators) {
      lines.push(validator.schemaCode);
      lines.push('');
      if (validator.typeCode) {
        lines.push(validator.typeCode);
        lines.push('');
      }
    }

    // Add invariant refinements for entities with invariants
    for (const entity of domain.entities || []) {
      if (entity.invariants && entity.invariants.length > 0) {
        for (const invariant of entity.invariants) {
          lines.push(zod.generateZodRefinement(invariant, `${entity.name}Schema`));
          lines.push('');
        }
      }
    }

    files.push({
      path: 'validators.ts',
      content: lines.join('\n'),
      exports,
    });

    // Generate index file
    files.push({
      path: 'index.ts',
      content: zod.generateZodIndex(validators),
      exports: [],
    });
  }

  return files;
}

/**
 * Generate Yup validators
 */
function generateYupValidators(
  domain: AST.Domain,
  options: GenerateOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const validators: ValidatorDefinition[] = [];
  const exports: string[] = [];

  // Generate enum validators
  for (const typeDecl of domain.types || []) {
    if (typeDecl.definition.kind === 'enum') {
      const validator = yup.generateYupEnum(typeDecl, options);
      validators.push(validator);
      exports.push(`${validator.name}Schema`);
    }
  }

  // Generate entity validators
  for (const entity of domain.entities || []) {
    const validator = yup.generateYupEntity(entity, options);
    validators.push(validator);
    exports.push(`${validator.name}Schema`);
  }

  // Generate behavior input validators
  for (const behavior of domain.behaviors || []) {
    const validator = yup.generateYupBehaviorInput(behavior, options);
    if (validator) {
      validators.push(validator);
      exports.push(validator.name);
    }
  }

  if (options.splitFiles) {
    // Generate separate files
    for (const validator of validators) {
      const content = yup.generateYupHeader() + validator.schemaCode + '\n\n' + (validator.typeCode || '');
      files.push({
        path: `${toKebabCase(validator.name)}.ts`,
        content,
        exports: [validator.name],
      });
    }

    // Generate index file
    files.push({
      path: 'index.ts',
      content: generateBarrelExport(validators, 'yup'),
      exports: [],
    });
  } else {
    // Generate single file
    const lines: string[] = [yup.generateYupHeader()];

    for (const validator of validators) {
      lines.push(validator.schemaCode);
      lines.push('');
      if (validator.typeCode) {
        lines.push(validator.typeCode);
        lines.push('');
      }
    }

    files.push({
      path: 'validators.ts',
      content: lines.join('\n'),
      exports,
    });

    // Generate index file
    files.push({
      path: 'index.ts',
      content: yup.generateYupIndex(validators),
      exports: [],
    });
  }

  return files;
}

/**
 * Generate barrel export file
 */
function generateBarrelExport(
  validators: ValidatorDefinition[],
  library: string
): string {
  const lines: string[] = [
    '// Auto-generated by @intentos/codegen-validators',
    '',
  ];

  for (const validator of validators) {
    const filename = toKebabCase(validator.name);
    lines.push(`export { ${validator.name}Schema } from './${filename}';`);
    if (validator.typeCode) {
      const typeName = validator.name.replace('Schema', '');
      lines.push(`export type { ${typeName} } from './${filename}';`);
    }
  }

  return lines.join('\n');
}

/**
 * Convert to kebab-case
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '')
    .replace(/schema$/i, '');
}
