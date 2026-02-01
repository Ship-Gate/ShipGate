// ============================================================================
// Rust Code Generator - Main Logic
// ============================================================================

import type { Domain } from './ast-types';
import { generateEntityStruct, generateTypeDeclaration, generateLifecycleEnum } from './structs';
import { generateBehaviorTrait, generateCombinedServiceTrait } from './traits';
import { mergeImports, generateImports, type RustImport } from './types';

export interface GeneratorOptions {
  /** Output directory for generated files */
  outputDir: string;
  /** Rust crate name */
  crateName: string;
  /** Whether to generate mock implementations */
  generateMocks?: boolean;
  /** Whether to include documentation comments */
  includeDocs?: boolean;
}

export interface GeneratedFile {
  /** File path relative to output directory */
  path: string;
  /** File contents */
  content: string;
}

/**
 * Generate Rust code from ISL Domain
 */
export function generateRustCode(domain: Domain, options: GeneratorOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  
  // Collect all generated code by category
  const typeCode: string[] = [];
  const typeImports: RustImport[] = [];
  
  const modelCode: string[] = [];
  const modelImports: RustImport[] = [];
  
  const traitCode: string[] = [];
  const traitImports: RustImport[] = [];
  
  const errorCode: string[] = [];
  const errorImports: RustImport[] = [];
  
  // Generate types
  for (const typeDecl of domain.types) {
    const generated = generateTypeDeclaration(typeDecl);
    typeCode.push(generated.code);
    typeImports.push(...generated.imports);
  }
  
  // Generate entities (models)
  for (const entity of domain.entities) {
    const generated = generateEntityStruct(entity);
    modelCode.push(generated.code);
    modelImports.push(...generated.imports);
    
    // Generate lifecycle enum if present
    if (entity.lifecycle) {
      const lifecycleEnum = generateLifecycleEnum(entity.name.name, entity.lifecycle);
      modelCode.push('');
      modelCode.push(lifecycleEnum.code);
      modelImports.push(...lifecycleEnum.imports);
    }
  }
  
  // Generate behaviors (traits)
  for (const behavior of domain.behaviors) {
    const generated = generateBehaviorTrait(behavior);
    
    // Input struct goes in models
    modelCode.push('');
    modelCode.push(generated.inputStructCode);
    
    // Error enum goes in errors
    errorCode.push('');
    errorCode.push(generated.errorEnumCode);
    errorImports.push(...generated.imports.filter(i => i.crate === 'thiserror'));
    
    // Output type and trait go in traits
    traitCode.push('');
    traitCode.push(generated.outputTypeCode);
    traitCode.push('');
    traitCode.push(generated.traitCode);
    
    traitImports.push(...generated.imports);
  }
  
  // Generate combined service trait if multiple behaviors
  if (domain.behaviors.length > 1) {
    const serviceName = domain.name.name;
    const combinedTrait = generateCombinedServiceTrait(serviceName, domain.behaviors);
    traitCode.push('');
    traitCode.push(combinedTrait);
  }
  
  // Generate types.rs
  files.push({
    path: 'src/types.rs',
    content: generateTypesFile(typeCode, typeImports, options),
  });
  
  // Generate models.rs
  files.push({
    path: 'src/models.rs',
    content: generateModelsFile(modelCode, modelImports, options),
  });
  
  // Generate traits.rs
  files.push({
    path: 'src/traits.rs',
    content: generateTraitsFile(traitCode, traitImports, options),
  });
  
  // Generate errors.rs
  files.push({
    path: 'src/errors.rs',
    content: generateErrorsFile(errorCode, errorImports, options),
  });
  
  // Generate lib.rs
  files.push({
    path: 'src/lib.rs',
    content: generateLibFile(domain, options),
  });
  
  // Generate Cargo.toml
  files.push({
    path: 'Cargo.toml',
    content: generateCargoToml(options),
  });
  
  return files;
}

/**
 * Generate types.rs file
 */
function generateTypesFile(
  code: string[],
  imports: RustImport[],
  options: GeneratorOptions
): string {
  const lines: string[] = [];
  
  lines.push('//! Custom type definitions');
  lines.push('//!');
  lines.push(`//! Generated from ISL specification for ${options.crateName}`);
  lines.push('');
  
  // Standard imports
  const allImports = mergeImports([
    { crate: 'serde', items: ['Deserialize', 'Serialize'] },
    { crate: 'validator', items: ['Validate'] },
    ...imports,
  ]);
  
  lines.push(generateImports(allImports));
  lines.push('');
  
  // Type definitions
  lines.push(...code);
  
  return lines.join('\n');
}

/**
 * Generate models.rs file
 */
function generateModelsFile(
  code: string[],
  imports: RustImport[],
  options: GeneratorOptions
): string {
  const lines: string[] = [];
  
  lines.push('//! Entity and input/output models');
  lines.push('//!');
  lines.push(`//! Generated from ISL specification for ${options.crateName}`);
  lines.push('');
  
  // Standard imports
  const allImports = mergeImports([
    { crate: 'serde', items: ['Deserialize', 'Serialize'] },
    { crate: 'validator', items: ['Validate'] },
    ...imports,
  ]);
  
  lines.push(generateImports(allImports));
  lines.push('');
  lines.push('use crate::types::*;');
  lines.push('');
  
  // Model definitions
  lines.push(...code);
  
  return lines.join('\n');
}

/**
 * Generate traits.rs file
 */
function generateTraitsFile(
  code: string[],
  imports: RustImport[],
  options: GeneratorOptions
): string {
  const lines: string[] = [];
  
  lines.push('//! Service traits defining behavior contracts');
  lines.push('//!');
  lines.push(`//! Generated from ISL specification for ${options.crateName}`);
  lines.push('');
  
  // Standard imports
  const allImports = mergeImports([
    { crate: 'async_trait', items: ['async_trait'] },
    ...imports,
  ]);
  
  lines.push(generateImports(allImports));
  lines.push('');
  lines.push('use crate::models::*;');
  lines.push('use crate::errors::*;');
  lines.push('');
  
  // Trait definitions
  lines.push(...code);
  
  return lines.join('\n');
}

/**
 * Generate errors.rs file
 */
function generateErrorsFile(
  code: string[],
  imports: RustImport[],
  options: GeneratorOptions
): string {
  const lines: string[] = [];
  
  lines.push('//! Error types for behavior operations');
  lines.push('//!');
  lines.push(`//! Generated from ISL specification for ${options.crateName}`);
  lines.push('');
  
  // Standard imports
  const allImports = mergeImports([
    { crate: 'serde', items: ['Deserialize', 'Serialize'] },
    { crate: 'thiserror', items: ['Error'] },
    ...imports,
  ]);
  
  lines.push(generateImports(allImports));
  lines.push('');
  
  // Error definitions
  lines.push(...code);
  
  return lines.join('\n');
}

/**
 * Generate lib.rs file
 */
function generateLibFile(domain: Domain, options: GeneratorOptions): string {
  const lines: string[] = [];
  
  lines.push(`//! ${options.crateName} - Generated from ISL specification`);
  lines.push('//!');
  lines.push(`//! Domain: ${domain.name.name}`);
  lines.push(`//! Version: ${domain.version.value}`);
  lines.push('');
  lines.push('#![warn(missing_docs)]');
  lines.push('#![warn(clippy::all)]');
  lines.push('');
  lines.push('pub mod types;');
  lines.push('pub mod models;');
  lines.push('pub mod traits;');
  lines.push('pub mod errors;');
  lines.push('');
  lines.push('// Re-exports for convenience');
  lines.push('pub use models::*;');
  lines.push('pub use traits::*;');
  lines.push('pub use errors::*;');
  lines.push('pub use types::*;');
  
  return lines.join('\n');
}

/**
 * Generate Cargo.toml file
 */
function generateCargoToml(options: GeneratorOptions): string {
  const lines: string[] = [];
  
  lines.push('[package]');
  lines.push(`name = "${options.crateName}"`);
  lines.push('version = "0.1.0"');
  lines.push('edition = "2021"');
  lines.push('description = "Generated from ISL specification"');
  lines.push('');
  lines.push('[dependencies]');
  lines.push('serde = { version = "1.0", features = ["derive"] }');
  lines.push('serde_json = "1.0"');
  lines.push('validator = { version = "0.16", features = ["derive"] }');
  lines.push('thiserror = "1.0"');
  lines.push('async-trait = "0.1"');
  lines.push('uuid = { version = "1.0", features = ["v4", "serde"] }');
  lines.push('chrono = { version = "0.4", features = ["serde"] }');
  lines.push('rust_decimal = { version = "1.0", features = ["serde"] }');
  lines.push('');
  lines.push('[dev-dependencies]');
  lines.push('tokio = { version = "1.0", features = ["full", "test-util"] }');
  
  return lines.join('\n');
}
