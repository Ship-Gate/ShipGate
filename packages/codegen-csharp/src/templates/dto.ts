// ============================================================================
// C# DTO Templates
// ============================================================================

import type { CSharpClassInfo, CSharpGeneratorOptions } from '../types.js';
import { generateUsings, generateXmlDoc, generateAttributes } from './model.js';

/**
 * Generate CreateDto for a model
 */
export function generateCreateDto(
  model: CSharpClassInfo,
  options: CSharpGeneratorOptions
): string {
  const dtoName = `Create${model.name}Dto`;
  const parts: string[] = [];

  // Usings
  const usings = [...model.usings];
  if (options.validation === 'data-annotations' || options.validation === 'both') {
    usings.push('System.ComponentModel.DataAnnotations');
  }
  if (options.serialization === 'system-text-json' || options.serialization === 'both') {
    usings.push('System.Text.Json.Serialization');
  }
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${model.namespace}.Dtos;\n`);

  // XML documentation
  if (options.generateXmlDocs) {
    parts.push(generateXmlDoc(`DTO for creating a new ${model.name}`));
  }

  // Class/record declaration
  const keyword = options.useRecords ? 'record' : 'class';
  parts.push(`public ${keyword} ${dtoName}`);
  parts.push('{');

  // Properties — exclude Id, CreatedAt, UpdatedAt (auto-generated fields)
  const autoFields = new Set(['Id', 'CreatedAt', 'UpdatedAt']);
  const props = model.properties.filter((p) => !autoFields.has(p.name));

  for (const prop of props) {
    if (options.generateXmlDocs && prop.xmlDoc) {
      parts.push(generateXmlDoc(prop.xmlDoc, '    '));
    }

    // Data annotations
    const attrs: string[] = [...prop.attributes];
    if (prop.isRequired && (options.validation === 'data-annotations' || options.validation === 'both')) {
      if (!attrs.includes('Required')) {
        attrs.push('Required');
      }
    }
    if (attrs.length > 0) {
      parts.push(generateAttributes(attrs, '    '));
    }

    const nullSuffix = !prop.isRequired && options.nullableReferenceTypes ? '?' : '';
    const setter = options.useInitOnlySetters ? '{ get; init; }' : '{ get; set; }';
    parts.push(`    public ${prop.type.name}${nullSuffix} ${prop.name} ${setter}`);
  }

  parts.push('}');

  return parts.join('\n');
}

/**
 * Generate UpdateDto for a model
 */
export function generateUpdateDto(
  model: CSharpClassInfo,
  options: CSharpGeneratorOptions
): string {
  const dtoName = `Update${model.name}Dto`;
  const parts: string[] = [];

  // Usings
  const usings = [...model.usings];
  if (options.validation === 'data-annotations' || options.validation === 'both') {
    usings.push('System.ComponentModel.DataAnnotations');
  }
  if (options.serialization === 'system-text-json' || options.serialization === 'both') {
    usings.push('System.Text.Json.Serialization');
  }
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${model.namespace}.Dtos;\n`);

  // XML documentation
  if (options.generateXmlDocs) {
    parts.push(generateXmlDoc(`DTO for updating an existing ${model.name}`));
  }

  // Class/record declaration — all properties optional for partial updates
  const keyword = options.useRecords ? 'record' : 'class';
  parts.push(`public ${keyword} ${dtoName}`);
  parts.push('{');

  // Properties — exclude Id, CreatedAt, UpdatedAt
  const autoFields = new Set(['Id', 'CreatedAt', 'UpdatedAt']);
  const props = model.properties.filter((p) => !autoFields.has(p.name));

  for (const prop of props) {
    if (options.generateXmlDocs && prop.xmlDoc) {
      parts.push(generateXmlDoc(prop.xmlDoc, '    '));
    }

    const attrs = [...prop.attributes];
    if (attrs.length > 0) {
      parts.push(generateAttributes(attrs, '    '));
    }

    // All fields nullable for update DTO (partial update)
    const nullSuffix = options.nullableReferenceTypes ? '?' : '';
    const setter = options.useInitOnlySetters ? '{ get; init; }' : '{ get; set; }';
    parts.push(`    public ${prop.type.name}${nullSuffix} ${prop.name} ${setter}`);
  }

  parts.push('}');

  return parts.join('\n');
}

/**
 * Generate ResponseDto for a model
 */
export function generateResponseDto(
  model: CSharpClassInfo,
  options: CSharpGeneratorOptions
): string {
  const dtoName = `${model.name}ResponseDto`;
  const parts: string[] = [];

  // Usings
  const usings = [...model.usings];
  if (options.serialization === 'system-text-json' || options.serialization === 'both') {
    usings.push('System.Text.Json.Serialization');
  }
  parts.push(generateUsings(usings) + '\n');

  // Namespace
  parts.push(`namespace ${model.namespace}.Dtos;\n`);

  // XML documentation
  if (options.generateXmlDocs) {
    parts.push(generateXmlDoc(`Response DTO for ${model.name}`));
  }

  // Class/record declaration
  const keyword = options.useRecords ? 'record' : 'class';
  parts.push(`public ${keyword} ${dtoName}`);
  parts.push('{');

  // All properties exposed in response
  for (const prop of model.properties) {
    if (options.generateXmlDocs && prop.xmlDoc) {
      parts.push(generateXmlDoc(prop.xmlDoc, '    '));
    }

    const attrs = [...prop.attributes];
    if (attrs.length > 0) {
      parts.push(generateAttributes(attrs, '    '));
    }

    const nullSuffix = prop.type.isNullable || (!prop.isRequired && options.nullableReferenceTypes) ? '?' : '';
    const setter = options.useInitOnlySetters ? '{ get; init; }' : '{ get; set; }';
    parts.push(`    public ${prop.type.name}${nullSuffix} ${prop.name} ${setter}`);
  }

  parts.push('}');

  return parts.join('\n');
}
