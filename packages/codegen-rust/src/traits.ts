// ============================================================================
// ISL Behaviors → Rust Traits
// ============================================================================

import type { Behavior, ErrorSpec, Field } from './ast-types';
import { mapType, toSnakeCase, type RustImport } from './types';
import { generateSerdeFieldAttrs, DEFAULT_SERDE_CONFIG } from './serde';
import { generateValidationFieldAttrs } from './validation';

export interface GeneratedTrait {
  traitCode: string;
  inputStructCode: string;
  outputTypeCode: string;
  errorEnumCode: string;
  imports: RustImport[];
}

/**
 * Generate Rust trait and associated types from ISL Behavior
 */
export function generateBehaviorTrait(behavior: Behavior): GeneratedTrait {
  const name = behavior.name.name;
  const imports: RustImport[] = [];
  
  // Generate input struct
  const inputStruct = generateInputStruct(name, behavior.input.fields);
  imports.push(...inputStruct.imports);
  
  // Generate error enum
  const errorEnum = generateErrorEnum(name, behavior.output.errors);
  imports.push(...errorEnum.imports);
  
  // Generate output type alias
  const outputType = generateOutputType(name, behavior.output.success);
  imports.push(...outputType.imports);
  
  // Generate trait
  const traitCode = generateTrait(name, behavior.description?.value);
  imports.push({ crate: 'async_trait', items: ['async_trait'] });
  
  return {
    traitCode,
    inputStructCode: inputStruct.code,
    outputTypeCode: outputType.code,
    errorEnumCode: errorEnum.code,
    imports,
  };
}

/**
 * Generate input struct for a behavior
 */
function generateInputStruct(
  behaviorName: string,
  fields: Field[]
): { code: string; imports: RustImport[] } {
  const structName = `${behaviorName}Input`;
  const lines: string[] = [];
  const imports: RustImport[] = [];
  
  // Documentation
  lines.push(`/// Input for ${behaviorName} operation`);
  
  // Derive macros
  lines.push('#[derive(Debug, Clone, Serialize, Deserialize, Validate)]');
  
  // Struct definition
  lines.push(`pub struct ${structName} {`);
  
  for (const field of fields) {
    // Serde attributes
    const serdeAttrs = generateSerdeFieldAttrs(field, field.annotations);
    for (const attr of serdeAttrs) {
      lines.push(`    ${attr}`);
    }
    
    // Validation attributes
    const validationAttrs = generateValidationFieldAttrs(field);
    for (const attr of validationAttrs) {
      lines.push(`    ${attr}`);
    }
    
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
    lines.push(`    pub ${fieldName}: ${rustType.type},`);
  }
  
  lines.push('}');
  
  // Add builder pattern
  lines.push('');
  lines.push(`impl ${structName} {`);
  lines.push(`    /// Create a new builder for ${structName}`);
  lines.push(`    pub fn builder() -> ${structName}Builder {`);
  lines.push(`        ${structName}Builder::default()`);
  lines.push('    }');
  lines.push('}');
  
  // Generate simple builder
  lines.push('');
  lines.push(`#[derive(Debug, Default)]`);
  lines.push(`pub struct ${structName}Builder {`);
  
  for (const field of fields) {
    let rustType = mapType(field.type);
    if (field.optional && field.type.kind !== 'OptionalType') {
      rustType = { ...rustType, type: `Option<${rustType.type}>` };
    }
    const fieldName = toSnakeCase(field.name.name);
    lines.push(`    ${fieldName}: Option<${rustType.type}>,`);
  }
  
  lines.push('}');
  
  lines.push('');
  lines.push(`impl ${structName}Builder {`);
  
  for (const field of fields) {
    let rustType = mapType(field.type);
    if (field.optional && field.type.kind !== 'OptionalType') {
      rustType = { ...rustType, type: `Option<${rustType.type}>` };
    }
    const fieldName = toSnakeCase(field.name.name);
    lines.push(`    pub fn ${fieldName}(mut self, value: ${rustType.type}) -> Self {`);
    lines.push(`        self.${fieldName} = Some(value);`);
    lines.push('        self');
    lines.push('    }');
    lines.push('');
  }
  
  lines.push(`    pub fn build(self) -> Result<${structName}, &'static str> {`);
  lines.push(`        Ok(${structName} {`);
  
  for (const field of fields) {
    const fieldName = toSnakeCase(field.name.name);
    if (field.optional) {
      lines.push(`            ${fieldName}: self.${fieldName}.flatten(),`);
    } else {
      lines.push(`            ${fieldName}: self.${fieldName}.ok_or("${fieldName} is required")?,`);
    }
  }
  
  lines.push('        })');
  lines.push('    }');
  lines.push('}');
  
  imports.push({ crate: 'serde', items: ['Deserialize', 'Serialize'] });
  imports.push({ crate: 'validator', items: ['Validate'] });
  
  return { code: lines.join('\n'), imports };
}

/**
 * Generate error enum for a behavior
 */
function generateErrorEnum(
  behaviorName: string,
  errors: ErrorSpec[]
): { code: string; imports: RustImport[] } {
  const enumName = `${behaviorName}Error`;
  const lines: string[] = [];
  const imports: RustImport[] = [];
  
  // Documentation
  lines.push(`/// Errors for ${behaviorName} operation`);
  
  // Derive macros
  lines.push('#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]');
  
  // Enum definition
  lines.push(`pub enum ${enumName} {`);
  
  for (const error of errors) {
    const variantName = error.name.name;
    const description = error.when?.value || variantName;
    
    lines.push(`    #[error("${description}")]`);
    lines.push(`    ${variantName},`);
  }
  
  // Add generic variants
  lines.push('    #[error("Validation error: {0}")]');
  lines.push('    ValidationError(String),');
  lines.push('    #[error("Internal error: {0}")]');
  lines.push('    InternalError(String),');
  
  lines.push('}');
  
  // Add From implementation for validation errors
  lines.push('');
  lines.push(`impl From<validator::ValidationErrors> for ${enumName} {`);
  lines.push('    fn from(err: validator::ValidationErrors) -> Self {');
  lines.push('        Self::ValidationError(err.to_string())');
  lines.push('    }');
  lines.push('}');
  
  imports.push({ crate: 'serde', items: ['Deserialize', 'Serialize'] });
  imports.push({ crate: 'thiserror', items: ['Error'] });
  
  return { code: lines.join('\n'), imports };
}

/**
 * Generate output type alias
 */
function generateOutputType(
  behaviorName: string,
  successType: import('./ast-types').TypeDefinition
): { code: string; imports: RustImport[] } {
  const rustType = mapType(successType);
  const errorName = `${behaviorName}Error`;
  const resultName = `${behaviorName}Result`;
  
  const code = `/// Result type for ${behaviorName} operation
pub type ${resultName} = Result<${rustType.type}, ${errorName}>;`;
  
  return { code, imports: rustType.imports };
}

/**
 * Generate the trait definition
 */
function generateTrait(behaviorName: string, description?: string): string {
  const lines: string[] = [];
  const methodName = toSnakeCase(behaviorName);
  const inputType = `${behaviorName}Input`;
  const resultType = `${behaviorName}Result`;
  
  // Documentation
  if (description) {
    lines.push(`/// ${description}`);
  } else {
    lines.push(`/// Trait for ${behaviorName} operation`);
  }
  
  // Async trait attribute
  lines.push('#[async_trait]');
  
  // Trait definition
  lines.push(`pub trait ${behaviorName}Service: Send + Sync {`);
  lines.push(`    /// Execute the ${behaviorName} operation`);
  lines.push(`    async fn ${methodName}(&self, input: ${inputType}) -> ${resultType};`);
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Generate a service trait that combines multiple behaviors
 */
export function generateCombinedServiceTrait(
  serviceName: string,
  behaviors: Behavior[]
): string {
  const lines: string[] = [];
  
  // Documentation
  lines.push(`/// Combined service trait for ${serviceName}`);
  lines.push('#[async_trait]');
  lines.push(`pub trait ${serviceName}Service: Send + Sync {`);
  
  for (const behavior of behaviors) {
    const methodName = toSnakeCase(behavior.name.name);
    const inputType = `${behavior.name.name}Input`;
    const resultType = `${behavior.name.name}Result`;
    
    if (behavior.description) {
      lines.push(`    /// ${behavior.description.value}`);
    }
    lines.push(`    async fn ${methodName}(&self, input: ${inputType}) -> ${resultType};`);
    lines.push('');
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Generate mock implementation for testing
 */
export function generateMockImplementation(behavior: Behavior): string {
  const name = behavior.name.name;
  const methodName = toSnakeCase(name);
  const lines: string[] = [];
  
  lines.push(`/// Mock implementation of ${name}Service for testing`);
  lines.push('#[derive(Debug, Default)]');
  lines.push(`pub struct Mock${name}Service {`);
  lines.push(`    pub call_count: std::sync::atomic::AtomicUsize,`);
  lines.push('}');
  lines.push('');
  lines.push('#[async_trait]');
  lines.push(`impl ${name}Service for Mock${name}Service {`);
  lines.push(`    async fn ${methodName}(&self, _input: ${name}Input) -> ${name}Result {`);
  lines.push('        self.call_count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);');
  lines.push('        todo!("Implement mock response")');
  lines.push('    }');
  lines.push('}');
  
  return lines.join('\n');
}
