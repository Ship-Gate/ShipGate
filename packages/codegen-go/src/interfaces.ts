// ============================================================================
// Go Interface Generator - Behaviors to Go Interfaces
// ============================================================================

import type {
  Behavior,
  Field,
  OutputSpec,
  ErrorSpec,
  TypeDefinition,
} from './ast-types.js';

import {
  mapType,
  toGoName,
  toSnakeCase,
  generateJsonTag,
  type GoImports,
  mergeImports,
  emptyImports,
} from './types.js';

import { generateValidationTag } from './validation.js';

// Generated interface result
export interface GeneratedInterface {
  name: string;
  code: string;
  imports: GoImports;
}

// Generated input/output structs
export interface GeneratedBehaviorTypes {
  inputStruct: string;
  outputStruct: string;
  errorTypes: string[];
  imports: GoImports;
}

/**
 * Generate Go interface from ISL Behaviors
 */
export function generateServiceInterface(
  serviceName: string,
  behaviors: Behavior[],
  typeRegistry: Map<string, string> = new Map()
): GeneratedInterface {
  const interfaceName = `${toGoName(serviceName)}Service`;
  const imports = emptyImports();
  imports.standard.add('context');

  const lines: string[] = [];

  // Doc comment
  lines.push(`// ${interfaceName} defines the service interface for ${serviceName}.`);
  lines.push(`type ${interfaceName} interface {`);

  for (const behavior of behaviors) {
    const methodResult = generateInterfaceMethod(behavior, typeRegistry);
    mergeInto(imports, methodResult.imports);
    
    // Add method doc comment
    if (behavior.description) {
      lines.push(`\t// ${toGoName(behavior.name.name)} ${behavior.description.value}`);
    }
    lines.push(`\t${methodResult.code}`);
  }

  lines.push('}');

  return {
    name: interfaceName,
    code: lines.join('\n'),
    imports,
  };
}

/**
 * Generate interface method signature
 */
function generateInterfaceMethod(
  behavior: Behavior,
  typeRegistry: Map<string, string>
): { code: string; imports: GoImports } {
  const methodName = toGoName(behavior.name.name);
  const inputType = `${methodName}Input`;
  const outputType = `${methodName}Output`;
  const imports = emptyImports();
  imports.standard.add('context');

  return {
    code: `${methodName}(ctx context.Context, input ${inputType}) (*${outputType}, error)`,
    imports,
  };
}

/**
 * Generate input struct for a behavior
 */
export function generateInputStruct(
  behavior: Behavior,
  typeRegistry: Map<string, string> = new Map()
): { code: string; imports: GoImports } {
  const structName = `${toGoName(behavior.name.name)}Input`;
  const imports = emptyImports();
  const lines: string[] = [];

  // Doc comment
  lines.push(`// ${structName} is the input for ${behavior.name.name}.`);
  lines.push(`type ${structName} struct {`);

  for (const field of behavior.input.fields) {
    const fieldResult = generateStructField(field, typeRegistry);
    mergeInto(imports, fieldResult.imports);
    lines.push(`\t${fieldResult.code}`);
  }

  lines.push('}');

  return {
    code: lines.join('\n'),
    imports,
  };
}

/**
 * Generate output struct for a behavior
 */
export function generateOutputStruct(
  behavior: Behavior,
  typeRegistry: Map<string, string> = new Map()
): { code: string; imports: GoImports } {
  const structName = `${toGoName(behavior.name.name)}Output`;
  const imports = emptyImports();
  const lines: string[] = [];

  // Doc comment
  lines.push(`// ${structName} is the output for ${behavior.name.name}.`);
  lines.push(`type ${structName} struct {`);

  // Success field
  const successType = mapType(behavior.output.success, typeRegistry);
  mergeInto(imports, successType.imports);
  
  const successTypeName = getSuccessTypeName(behavior.output.success, typeRegistry);
  lines.push(`\t${successTypeName} *${successType.typeName} \`json:"${toSnakeCase(successTypeName.toLowerCase())},omitempty"\``);

  // Error field
  const behaviorName = toGoName(behavior.name.name);
  lines.push(`\tError *${behaviorName}Error \`json:"error,omitempty"\``);

  lines.push('}');

  // Success check method
  lines.push('');
  lines.push(`// IsSuccess returns true if the operation was successful.`);
  lines.push(`func (o *${structName}) IsSuccess() bool {`);
  lines.push(`\treturn o.Error == nil && o.${successTypeName} != nil`);
  lines.push('}');

  return {
    code: lines.join('\n'),
    imports,
  };
}

/**
 * Get the success field name based on type
 */
function getSuccessTypeName(typeDef: TypeDefinition, typeRegistry: Map<string, string>): string {
  switch (typeDef.kind) {
    case 'ReferenceType':
      const parts = typeDef.name.parts.map(p => p.name);
      return toGoName(parts[parts.length - 1] ?? 'Result');
    case 'PrimitiveType':
      return 'Result';
    default:
      return 'Result';
  }
}

/**
 * Generate error type for a behavior
 */
export function generateErrorType(
  behavior: Behavior,
  typeRegistry: Map<string, string> = new Map()
): { code: string; imports: GoImports } {
  const behaviorName = toGoName(behavior.name.name);
  const errorTypeName = `${behaviorName}Error`;
  const imports = emptyImports();
  const lines: string[] = [];

  // Error struct
  lines.push(`// ${errorTypeName} represents an error from ${behavior.name.name}.`);
  lines.push(`type ${errorTypeName} struct {`);
  lines.push(`\tCode    ${behaviorName}ErrorCode \`json:"code"\``);
  lines.push(`\tMessage string                   \`json:"message"\``);
  lines.push(`\tDetails interface{}              \`json:"details,omitempty"\``);
  lines.push('}');
  lines.push('');

  // Error method for error interface
  lines.push(`// Error implements the error interface.`);
  lines.push(`func (e *${errorTypeName}) Error() string {`);
  lines.push(`\treturn fmt.Sprintf("%s: %s", e.Code, e.Message)`);
  lines.push('}');
  imports.standard.add('fmt');
  lines.push('');

  // Error code type
  lines.push(`// ${behaviorName}ErrorCode represents error codes for ${behavior.name.name}.`);
  lines.push(`type ${behaviorName}ErrorCode string`);
  lines.push('');

  // Error code constants
  if (behavior.output.errors.length > 0) {
    lines.push('const (');
    for (const errorSpec of behavior.output.errors) {
      const constName = `${behaviorName}Error${toGoName(errorSpec.name.name)}`;
      lines.push(`\t${constName} ${behaviorName}ErrorCode = "${errorSpec.name.name}"`);
    }
    lines.push(')');
    lines.push('');
  }

  // Error constructors
  for (const errorSpec of behavior.output.errors) {
    const errorResult = generateErrorConstructor(behaviorName, errorSpec, typeRegistry);
    mergeInto(imports, errorResult.imports);
    lines.push(errorResult.code);
    lines.push('');
  }

  // IsRetriable method
  lines.push(`// IsRetriable returns true if the error is retriable.`);
  lines.push(`func (e *${errorTypeName}) IsRetriable() bool {`);
  lines.push(`\tswitch e.Code {`);
  
  const retriableErrors = behavior.output.errors.filter(e => e.retriable);
  if (retriableErrors.length > 0) {
    for (const errorSpec of retriableErrors) {
      const constName = `${behaviorName}Error${toGoName(errorSpec.name.name)}`;
      lines.push(`\tcase ${constName}:`);
    }
    lines.push(`\t\treturn true`);
  }
  
  lines.push(`\tdefault:`);
  lines.push(`\t\treturn false`);
  lines.push(`\t}`);
  lines.push('}');

  return {
    code: lines.join('\n'),
    imports,
  };
}

/**
 * Generate error constructor function
 */
function generateErrorConstructor(
  behaviorName: string,
  errorSpec: ErrorSpec,
  typeRegistry: Map<string, string>
): { code: string; imports: GoImports } {
  const errorName = toGoName(errorSpec.name.name);
  const funcName = `New${behaviorName}${errorName}Error`;
  const constName = `${behaviorName}Error${errorName}`;
  const errorTypeName = `${behaviorName}Error`;
  const imports = emptyImports();
  const lines: string[] = [];

  const message = errorSpec.when?.value ?? `${errorSpec.name.name} error`;

  lines.push(`// ${funcName} creates a new ${errorSpec.name.name} error.`);
  lines.push(`func ${funcName}(details interface{}) *${errorTypeName} {`);
  lines.push(`\treturn &${errorTypeName}{`);
  lines.push(`\t\tCode:    ${constName},`);
  lines.push(`\t\tMessage: "${message}",`);
  lines.push(`\t\tDetails: details,`);
  lines.push(`\t}`);
  lines.push('}');

  return {
    code: lines.join('\n'),
    imports,
  };
}

/**
 * Generate all types for a behavior
 */
export function generateBehaviorTypes(
  behavior: Behavior,
  typeRegistry: Map<string, string> = new Map()
): GeneratedBehaviorTypes {
  const imports = emptyImports();
  
  const inputResult = generateInputStruct(behavior, typeRegistry);
  mergeInto(imports, inputResult.imports);
  
  const outputResult = generateOutputStruct(behavior, typeRegistry);
  mergeInto(imports, outputResult.imports);
  
  const errorResult = generateErrorType(behavior, typeRegistry);
  mergeInto(imports, errorResult.imports);

  return {
    inputStruct: inputResult.code,
    outputStruct: outputResult.code,
    errorTypes: [errorResult.code],
    imports,
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
 * Merge imports in place
 */
function mergeInto(target: GoImports, source: GoImports): void {
  source.standard.forEach(i => target.standard.add(i));
  source.external.forEach(i => target.external.add(i));
}
