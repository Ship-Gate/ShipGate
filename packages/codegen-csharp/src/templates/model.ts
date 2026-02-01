// ============================================================================
// C# Model Templates
// ============================================================================

import type { CSharpClassInfo, CSharpPropertyInfo, CSharpGeneratorOptions } from '../types';

/**
 * Generate using statements
 */
export function generateUsings(usings: string[]): string {
  const sorted = [...new Set(usings)].sort();
  return sorted.map((u) => `using ${u};`).join('\n');
}

/**
 * Generate XML documentation
 */
export function generateXmlDoc(doc: string | undefined, indent: string = ''): string {
  if (!doc) return '';
  
  const lines = doc.split('\n');
  const formatted = lines.map((line) => `${indent}/// ${line}`).join('\n');
  return `${indent}/// <summary>\n${formatted}\n${indent}/// </summary>\n`;
}

/**
 * Generate attributes
 */
export function generateAttributes(attrs: string[], indent: string = ''): string {
  if (attrs.length === 0) return '';
  return attrs.map((attr) => `${indent}[${attr}]`).join('\n') + '\n';
}

/**
 * Generate property
 */
export function generateProperty(
  prop: CSharpPropertyInfo,
  options: CSharpGeneratorOptions,
  indent: string = '    '
): string {
  const parts: string[] = [];

  // XML documentation
  if (options.generateXmlDocs && prop.xmlDoc) {
    parts.push(generateXmlDoc(prop.xmlDoc, indent));
  }

  // Attributes
  if (prop.attributes.length > 0) {
    parts.push(generateAttributes(prop.attributes, indent));
  }

  // Property declaration
  const nullSuffix = options.nullableReferenceTypes && !prop.isRequired && !prop.type.isNullable
    ? '?'
    : prop.type.isNullable ? '?' : '';
  
  const typeName = formatTypeName(prop.type, options);
  const requiredKeyword = prop.isRequired && options.nullableReferenceTypes ? 'required ' : '';
  
  let declaration = `${indent}public ${requiredKeyword}${typeName}${nullSuffix} ${prop.name}`;
  
  if (options.useRecords) {
    // Record syntax with init
    declaration += options.useInitOnlySetters ? ' { get; init; }' : ' { get; set; }';
  } else {
    declaration += prop.isReadOnly ? ' { get; }' : ' { get; set; }';
  }

  if (prop.defaultValue) {
    declaration += ` = ${prop.defaultValue};`;
  }

  parts.push(declaration);

  return parts.join('');
}

/**
 * Format type name
 */
function formatTypeName(type: import('../types').CSharpTypeInfo, options: CSharpGeneratorOptions): string {
  if (type.isCollection && type.collectionType) {
    const innerType = type.genericArgs?.[0];
    const innerName = innerType ? formatTypeName(innerType, options) : 'object';
    
    switch (type.collectionType) {
      case 'List':
        return `List<${innerName}>`;
      case 'Array':
        return `${innerName}[]`;
      case 'IEnumerable':
        return `IEnumerable<${innerName}>`;
      case 'ICollection':
        return `ICollection<${innerName}>`;
    }
  }
  
  return type.name;
}

/**
 * Generate record model
 */
export function generateRecordModel(
  info: CSharpClassInfo,
  options: CSharpGeneratorOptions
): string {
  const parts: string[] = [];

  // File-scoped namespace
  parts.push(`namespace ${info.namespace};\n`);

  // Usings
  const usings = [...info.usings];
  if (options.validation === 'data-annotations' || options.validation === 'both') {
    usings.push('System.ComponentModel.DataAnnotations');
  }
  if (options.serialization === 'system-text-json' || options.serialization === 'both') {
    usings.push('System.Text.Json.Serialization');
  }
  if (options.serialization === 'newtonsoft' || options.serialization === 'both') {
    usings.push('Newtonsoft.Json');
  }
  
  if (usings.length > 0) {
    parts.unshift(generateUsings(usings) + '\n');
  }

  // XML documentation
  if (options.generateXmlDocs && info.xmlDoc) {
    parts.push(generateXmlDoc(info.xmlDoc));
  }

  // Attributes
  if (info.attributes.length > 0) {
    parts.push(generateAttributes(info.attributes));
  }

  // Record declaration
  const modifiers: string[] = ['public'];
  if (info.isSealed) modifiers.push('sealed');
  if (info.isPartial) modifiers.push('partial');
  
  const baseTypes = [info.baseClass, ...info.interfaces].filter(Boolean);
  const inheritance = baseTypes.length > 0 ? ` : ${baseTypes.join(', ')}` : '';

  // Primary constructor parameters for record
  const ctorParams = info.properties
    .filter((p) => p.isRequired)
    .map((p) => {
      const typeName = formatTypeName(p.type, options);
      const nullable = p.type.isNullable ? '?' : '';
      return `${typeName}${nullable} ${p.name}`;
    })
    .join(', ');

  parts.push(`${modifiers.join(' ')} record ${info.name}(${ctorParams})${inheritance}`);
  parts.push('{');

  // Non-required properties
  const optionalProps = info.properties.filter((p) => !p.isRequired);
  for (const prop of optionalProps) {
    parts.push(generateProperty(prop, options));
  }

  // Methods
  for (const method of info.methods) {
    parts.push(generateMethod(method, options));
  }

  parts.push('}');

  return parts.join('\n');
}

/**
 * Generate class model
 */
export function generateClassModel(
  info: CSharpClassInfo,
  options: CSharpGeneratorOptions
): string {
  const parts: string[] = [];

  // File-scoped namespace
  parts.push(`namespace ${info.namespace};\n`);

  // Usings
  const usings = [...info.usings];
  if (options.validation === 'data-annotations' || options.validation === 'both') {
    usings.push('System.ComponentModel.DataAnnotations');
  }
  if (options.serialization === 'system-text-json' || options.serialization === 'both') {
    usings.push('System.Text.Json.Serialization');
  }
  
  if (usings.length > 0) {
    parts.unshift(generateUsings(usings) + '\n');
  }

  // XML documentation
  if (options.generateXmlDocs && info.xmlDoc) {
    parts.push(generateXmlDoc(info.xmlDoc));
  }

  // Attributes
  if (info.attributes.length > 0) {
    parts.push(generateAttributes(info.attributes));
  }

  // Class declaration
  const modifiers: string[] = ['public'];
  if (info.isAbstract) modifiers.push('abstract');
  if (info.isSealed) modifiers.push('sealed');
  if (info.isPartial) modifiers.push('partial');
  
  const baseTypes = [info.baseClass, ...info.interfaces].filter(Boolean);
  const inheritance = baseTypes.length > 0 ? ` : ${baseTypes.join(', ')}` : '';

  parts.push(`${modifiers.join(' ')} class ${info.name}${inheritance}`);
  parts.push('{');

  // Properties
  for (const prop of info.properties) {
    parts.push(generateProperty(prop, options));
  }

  // Methods
  for (const method of info.methods) {
    parts.push(generateMethod(method, options));
  }

  parts.push('}');

  return parts.join('\n');
}

/**
 * Generate method
 */
function generateMethod(
  method: import('../types').CSharpMethodInfo,
  options: CSharpGeneratorOptions,
  indent: string = '    '
): string {
  const parts: string[] = [];

  // XML documentation
  if (options.generateXmlDocs && method.xmlDoc) {
    parts.push(generateXmlDoc(method.xmlDoc, indent));
  }

  // Attributes
  if (method.attributes.length > 0) {
    parts.push(generateAttributes(method.attributes, indent));
  }

  // Method signature
  const modifiers: string[] = [method.accessibility];
  if (method.isStatic) modifiers.push('static');
  if (method.isAsync) modifiers.push('async');

  const returnType = method.isAsync
    ? `Task<${formatTypeName(method.returnType, options)}>`
    : formatTypeName(method.returnType, options);

  const params = method.parameters
    .map((p) => {
      const typeName = formatTypeName(p.type, options);
      const nullable = p.type.isNullable ? '?' : '';
      const defaultVal = p.isOptional && p.defaultValue ? ` = ${p.defaultValue}` : '';
      const attrs = p.attributes.length > 0 ? `[${p.attributes.join(', ')}] ` : '';
      return `${attrs}${typeName}${nullable} ${p.name}${defaultVal}`;
    })
    .join(', ');

  parts.push(`${indent}${modifiers.join(' ')} ${returnType} ${method.name}(${params})`);
  
  if (method.body) {
    parts.push(`${indent}{`);
    parts.push(method.body.split('\n').map((l) => `${indent}    ${l}`).join('\n'));
    parts.push(`${indent}}`);
  } else {
    parts.push(`${indent}{`);
    parts.push(`${indent}    throw new NotImplementedException();`);
    parts.push(`${indent}}`);
  }

  return parts.join('\n');
}

/**
 * Generate model
 */
export function generateModel(
  info: CSharpClassInfo,
  options: CSharpGeneratorOptions
): string {
  if (options.useRecords && !info.isAbstract) {
    return generateRecordModel(info, options);
  }
  return generateClassModel(info, options);
}
