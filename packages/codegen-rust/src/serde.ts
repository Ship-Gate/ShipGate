// ============================================================================
// Serde Derives Generation
// ============================================================================

import type { Annotation, Field } from './ast-types';
import { toSnakeCase } from './types';

export interface SerdeConfig {
  /** Whether to derive Serialize */
  serialize: boolean;
  /** Whether to derive Deserialize */
  deserialize: boolean;
  /** Rename all fields to a specific case */
  renameAll?: 'camelCase' | 'snake_case' | 'SCREAMING_SNAKE_CASE' | 'kebab-case';
  /** Deny unknown fields */
  denyUnknownFields?: boolean;
}

export const DEFAULT_SERDE_CONFIG: SerdeConfig = {
  serialize: true,
  deserialize: true,
  renameAll: undefined,
  denyUnknownFields: false,
};

/**
 * Generate serde derive macros
 */
export function generateSerdeDerives(config: SerdeConfig = DEFAULT_SERDE_CONFIG): string[] {
  const derives: string[] = [];
  
  if (config.serialize) {
    derives.push('Serialize');
  }
  if (config.deserialize) {
    derives.push('Deserialize');
  }
  
  return derives;
}

/**
 * Generate serde container attributes
 */
export function generateSerdeContainerAttrs(config: SerdeConfig = DEFAULT_SERDE_CONFIG): string[] {
  const attrs: string[] = [];
  
  if (config.renameAll) {
    attrs.push(`#[serde(rename_all = "${config.renameAll}")]`);
  }
  
  if (config.denyUnknownFields) {
    attrs.push('#[serde(deny_unknown_fields)]');
  }
  
  return attrs;
}

/**
 * Generate serde field attributes
 */
export function generateSerdeFieldAttrs(
  field: Field,
  annotations: Annotation[]
): string[] {
  const attrs: string[] = [];
  
  // Check if field name needs renaming (if different from snake_case)
  const snakeName = toSnakeCase(field.name.name);
  if (snakeName !== field.name.name) {
    attrs.push(`#[serde(rename = "${field.name.name}")]`);
  }
  
  // Handle optional fields with default
  if (field.optional) {
    attrs.push('#[serde(skip_serializing_if = "Option::is_none")]');
    attrs.push('#[serde(default)]');
  }
  
  // Check annotations for serde-specific attributes
  for (const ann of annotations) {
    const name = ann.name.name.toLowerCase();
    
    if (name === 'serde_skip' || name === 'skip') {
      attrs.push('#[serde(skip)]');
    }
    
    if (name === 'serde_flatten' || name === 'flatten') {
      attrs.push('#[serde(flatten)]');
    }
    
    if (name === 'secret' || name === 'sensitive') {
      // Don't serialize secrets
      attrs.push('#[serde(skip_serializing)]');
    }
  }
  
  return attrs;
}

/**
 * Generate serde enum variant attributes
 */
export function generateSerdeVariantAttrs(variantName: string): string[] {
  // Convert PascalCase to SCREAMING_SNAKE_CASE for enum variants
  const screaming = variantName
    .replace(/([A-Z])/g, '_$1')
    .toUpperCase()
    .replace(/^_/, '');
    
  if (screaming !== variantName) {
    return [`#[serde(rename = "${screaming}")]`];
  }
  
  return [];
}

/**
 * Generate imports for serde
 */
export function generateSerdeImports(): string {
  return 'use serde::{Deserialize, Serialize};';
}

/**
 * Generate a #[derive(...)] attribute with serde and other derives
 */
export function generateDeriveAttribute(
  standardDerives: string[],
  serdeConfig: SerdeConfig = DEFAULT_SERDE_CONFIG,
  additionalDerives: string[] = []
): string {
  const allDerives = [
    ...standardDerives,
    ...generateSerdeDerives(serdeConfig),
    ...additionalDerives,
  ];
  
  return `#[derive(${allDerives.join(', ')})]`;
}
