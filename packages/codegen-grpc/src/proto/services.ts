// ============================================================================
// ISL Behavior to Proto Service Generation
// ============================================================================

import type {
  Behavior,
  Entity,
  Field,
  ErrorSpec,
  InputSpec,
  OutputSpec,
} from '@isl-lang/isl-core';
import {
  toSnakeCase,
  toPascalCase,
  toScreamingSnakeCase,
  fieldNumbers,
  protoComment,
} from '../utils';
import { resolveType, type ProtoTypeOptions } from './types';

// ==========================================================================
// SERVICE OPTIONS
// ==========================================================================

export interface ProtoServiceOptions extends ProtoTypeOptions {
  /** Generate streaming RPCs for Watch behaviors */
  generateStreaming?: boolean;
  /** Add idempotency options to applicable RPCs */
  addIdempotencyOptions?: boolean;
  /** Generate separate error messages */
  generateErrorMessages?: boolean;
  /** Service name suffix */
  serviceSuffix?: string;
}

// ==========================================================================
// GENERATED SERVICE
// ==========================================================================

export interface GeneratedProtoService {
  name: string;
  definition: string;
  messages: string[];
  imports: Set<string>;
}

// ==========================================================================
// SERVICE GENERATOR
// ==========================================================================

/**
 * Generate proto services from ISL behaviors
 */
export function generateProtoServices(
  behaviors: Behavior[],
  entities: Entity[],
  options: ProtoServiceOptions = {}
): GeneratedProtoService[] {
  // Group behaviors by entity they operate on (heuristic based on name)
  const entityBehaviors = groupBehaviorsByEntity(behaviors, entities);
  const results: GeneratedProtoService[] = [];
  
  for (const [entityName, entityBehavs] of entityBehaviors) {
    const service = generateService(entityName, entityBehavs, options);
    results.push(service);
  }
  
  return results;
}

/**
 * Group behaviors by related entity
 */
function groupBehaviorsByEntity(
  behaviors: Behavior[],
  entities: Entity[]
): Map<string, Behavior[]> {
  const entityNames = new Set(entities.map(e => e.name.name));
  const grouped = new Map<string, Behavior[]>();
  
  for (const behavior of behaviors) {
    const behaviorName = behavior.name.name;
    
    // Try to match behavior to entity by name prefix
    let matchedEntity: string | null = null;
    for (const entityName of entityNames) {
      if (
        behaviorName.includes(entityName) ||
        behaviorName.startsWith('Create') ||
        behaviorName.startsWith('Get') ||
        behaviorName.startsWith('Update') ||
        behaviorName.startsWith('Delete') ||
        behaviorName.startsWith('List')
      ) {
        // Extract entity name from behavior
        const patterns = ['Create', 'Get', 'Update', 'Delete', 'List', 'Watch'];
        for (const pattern of patterns) {
          if (behaviorName.startsWith(pattern)) {
            const extractedEntity = behaviorName.slice(pattern.length);
            if (entityNames.has(extractedEntity)) {
              matchedEntity = extractedEntity;
              break;
            }
          }
        }
        if (!matchedEntity && entityNames.has(entityName)) {
          matchedEntity = entityName;
          break;
        }
      }
    }
    
    // Default to first entity or "Default" service
    if (!matchedEntity) {
      matchedEntity = entities[0]?.name.name ?? 'Default';
    }
    
    if (!grouped.has(matchedEntity)) {
      grouped.set(matchedEntity, []);
    }
    grouped.get(matchedEntity)!.push(behavior);
  }
  
  return grouped;
}

/**
 * Generate a single service
 */
function generateService(
  entityName: string,
  behaviors: Behavior[],
  options: ProtoServiceOptions
): GeneratedProtoService {
  const serviceName = `${toPascalCase(entityName)}${options.serviceSuffix ?? 'Service'}`;
  const imports = new Set<string>();
  const messages: string[] = [];
  const rpcDefs: string[] = [];
  
  for (const behavior of behaviors) {
    const { requestMsg, responseMsg, rpc, rpcImports } = generateBehaviorRpc(
      behavior,
      options
    );
    
    messages.push(requestMsg);
    messages.push(responseMsg);
    rpcDefs.push(rpc);
    rpcImports.forEach(i => imports.add(i));
    
    // Generate error message if needed
    if (options.generateErrorMessages && behavior.output.errors.length > 0) {
      const errorMsg = generateErrorMessage(behavior.name.name, behavior.output.errors);
      messages.push(errorMsg);
    }
  }
  
  // Build service definition
  const lines: string[] = [
    `// ${serviceName} - RPC service for ${entityName} operations`,
    `service ${serviceName} {`,
  ];
  
  for (const rpc of rpcDefs) {
    lines.push(rpc);
  }
  
  lines.push('}');
  
  // Combine messages and service
  const definition = [...messages, '', lines.join('\n')].join('\n\n');
  
  return {
    name: serviceName,
    definition,
    messages,
    imports,
  };
}

// ==========================================================================
// RPC GENERATION
// ==========================================================================

interface GeneratedRpc {
  requestMsg: string;
  responseMsg: string;
  rpc: string;
  rpcImports: Set<string>;
}

function generateBehaviorRpc(
  behavior: Behavior,
  options: ProtoServiceOptions
): GeneratedRpc {
  const rpcImports = new Set<string>();
  const behaviorName = toPascalCase(behavior.name.name);
  
  // Generate request message
  const requestMsg = generateRequestMessage(behavior.name.name, behavior.input, options, rpcImports);
  
  // Generate response message
  const responseMsg = generateResponseMessage(
    behavior.name.name,
    behavior.output,
    options,
    rpcImports
  );
  
  // Determine if this should be streaming
  const isStreaming = options.generateStreaming && 
    (behavior.name.name.startsWith('Watch') || 
     behavior.name.name.startsWith('Stream') ||
     behavior.name.name.includes('Subscribe'));
  
  // Build RPC definition
  let rpc = '';
  const desc = behavior.description?.value ? `  // ${behavior.description.value}\n` : '';
  
  if (isStreaming) {
    rpc = `${desc}  rpc ${behaviorName}(${behaviorName}Request) returns (stream ${behaviorName}Response);`;
  } else {
    rpc = `${desc}  rpc ${behaviorName}(${behaviorName}Request) returns (${behaviorName}Response)`;
    
    // Add options
    const rpcOptions: string[] = [];
    
    if (options.addIdempotencyOptions && isIdempotentBehavior(behavior)) {
      rpcOptions.push('option idempotency_level = IDEMPOTENT');
    }
    
    if (rpcOptions.length > 0) {
      rpc += ` {\n    ${rpcOptions.join(';\n    ')};\n  }`;
    } else {
      rpc += ';';
    }
  }
  
  return { requestMsg, responseMsg, rpc, rpcImports };
}

/**
 * Check if behavior should be marked idempotent
 */
function isIdempotentBehavior(behavior: Behavior): boolean {
  // Check for idempotency_key in input
  for (const field of behavior.input.fields) {
    if (
      field.name.name === 'idempotency_key' ||
      field.name.name === 'idempotencyKey'
    ) {
      return true;
    }
  }
  
  // Check for Create/Update patterns with idempotency
  const name = behavior.name.name;
  return name.startsWith('Create') || name.startsWith('Update');
}

// ==========================================================================
// REQUEST MESSAGE GENERATION
// ==========================================================================

function generateRequestMessage(
  behaviorName: string,
  input: InputSpec,
  options: ProtoServiceOptions,
  imports: Set<string>
): string {
  const msgName = `${toPascalCase(behaviorName)}Request`;
  const lines: string[] = [`message ${msgName} {`];
  const fieldNums = fieldNumbers();
  
  for (const field of input.fields) {
    const fieldNum = fieldNums.next().value;
    const { protoType, fieldImports } = resolveType(field.type, options);
    fieldImports.forEach(i => imports.add(i));
    
    const fieldName = toSnakeCase(field.name.name);
    let fieldDef = `  ${protoType} ${fieldName} = ${fieldNum}`;
    
    // Add validation
    if (options.includeValidation) {
      const rules = getFieldValidationRules(field);
      if (rules) {
        fieldDef += ` ${rules}`;
        imports.add('validate/validate.proto');
      }
    }
    
    fieldDef += ';';
    lines.push(fieldDef);
  }
  
  lines.push('}');
  return lines.join('\n');
}

function getFieldValidationRules(field: Field): string | null {
  const rules: string[] = [];
  
  // Check annotations
  for (const ann of field.annotations) {
    if (ann.name.name === 'sensitive') {
      // Could add custom option
    }
  }
  
  // Required check
  if (!field.optional) {
    if (field.type.kind === 'PrimitiveType' && field.type.name === 'String') {
      rules.push('string.min_len = 1');
    } else if (field.type.kind === 'ReferenceType') {
      rules.push('message.required = true');
    }
  }
  
  if (rules.length === 0) return null;
  return `[(validate.rules).${rules.join(', ')}]`;
}

// ==========================================================================
// RESPONSE MESSAGE GENERATION
// ==========================================================================

function generateResponseMessage(
  behaviorName: string,
  output: OutputSpec,
  options: ProtoServiceOptions,
  imports: Set<string>
): string {
  const msgName = `${toPascalCase(behaviorName)}Response`;
  const lines: string[] = [`message ${msgName} {`];
  
  // Use oneof for result (success or error)
  lines.push('  oneof result {');
  
  // Success case
  const { protoType: successType, fieldImports } = resolveType(output.success, options);
  fieldImports.forEach(i => imports.add(i));
  const successFieldName = toSnakeCase(getSuccessFieldName(output.success));
  lines.push(`    ${successType} ${successFieldName} = 1;`);
  
  // Error case
  if (output.errors.length > 0) {
    const errorMsgName = `${toPascalCase(behaviorName)}Error`;
    lines.push(`    ${errorMsgName} error = 2;`);
  }
  
  lines.push('  }');
  lines.push('}');
  
  return lines.join('\n');
}

function getSuccessFieldName(successType: { kind: string; name?: { parts?: Array<{ name: string }> } }): string {
  if (successType.kind === 'ReferenceType' && successType.name?.parts) {
    return successType.name.parts[successType.name.parts.length - 1].name;
  }
  return 'data';
}

// ==========================================================================
// ERROR MESSAGE GENERATION
// ==========================================================================

function generateErrorMessage(
  behaviorName: string,
  errors: ErrorSpec[]
): string {
  const msgName = `${toPascalCase(behaviorName)}Error`;
  const enumName = `${msgName}Code`;
  const prefix = toScreamingSnakeCase(enumName);
  
  const lines: string[] = [];
  
  // Generate error code enum
  lines.push(`enum ${enumName} {`);
  lines.push(`  ${prefix}_UNSPECIFIED = 0;`);
  
  let value = 1;
  for (const error of errors) {
    const codeName = `${prefix}_${toScreamingSnakeCase(error.name.name)}`;
    lines.push(`  ${codeName} = ${value};`);
    value++;
  }
  lines.push('}');
  lines.push('');
  
  // Generate error message
  lines.push(`message ${msgName} {`);
  lines.push(`  ${enumName} code = 1;`);
  lines.push('  string message = 2;');
  lines.push('  bool retriable = 3;');
  lines.push('  int32 retry_after_seconds = 4;');
  lines.push('  map<string, string> details = 5;');
  lines.push('}');
  
  return lines.join('\n');
}

// ==========================================================================
// CRUD SERVICE GENERATION
// ==========================================================================

/**
 * Generate standard CRUD service for an entity
 */
export function generateCrudService(
  entity: Entity,
  options: ProtoServiceOptions = {}
): GeneratedProtoService {
  const entityName = toPascalCase(entity.name.name);
  const serviceName = `${entityName}${options.serviceSuffix ?? 'Service'}`;
  const imports = new Set<string>();
  const messages: string[] = [];
  
  imports.add('validate/validate.proto');
  imports.add('google/protobuf/timestamp.proto');
  imports.add('google/protobuf/field_mask.proto');
  
  // Create request/response
  messages.push(generateCreateRequestMessage(entity, options, imports));
  messages.push(generateCreateResponseMessage(entityName));
  
  // Get request/response
  messages.push(generateGetRequestMessage(entityName));
  messages.push(generateGetResponseMessage(entityName));
  
  // Update request/response
  messages.push(generateUpdateRequestMessage(entity, options, imports));
  messages.push(generateUpdateResponseMessage(entityName));
  
  // Delete request/response
  messages.push(generateDeleteRequestMessage(entityName));
  messages.push(generateDeleteResponseMessage(entityName));
  
  // List request/response
  messages.push(generateListRequestMessage(entityName));
  messages.push(generateListResponseMessage(entityName));
  
  // Build service
  const serviceLines: string[] = [
    `service ${serviceName} {`,
    `  // Create a new ${entityName}`,
    `  rpc Create${entityName}(Create${entityName}Request) returns (Create${entityName}Response) {`,
    '    option idempotency_level = IDEMPOTENT;',
    '  }',
    '',
    `  // Get ${entityName} by ID`,
    `  rpc Get${entityName}(Get${entityName}Request) returns (Get${entityName}Response);`,
    '',
    `  // Update an existing ${entityName}`,
    `  rpc Update${entityName}(Update${entityName}Request) returns (Update${entityName}Response) {`,
    '    option idempotency_level = IDEMPOTENT;',
    '  }',
    '',
    `  // Delete a ${entityName}`,
    `  rpc Delete${entityName}(Delete${entityName}Request) returns (Delete${entityName}Response);`,
    '',
    `  // List ${entityName}s with pagination`,
    `  rpc List${entityName}s(List${entityName}sRequest) returns (List${entityName}sResponse);`,
  ];
  
  // Add Watch if streaming enabled
  if (options.generateStreaming) {
    messages.push(generateWatchRequestMessage(entityName));
    messages.push(generateEventMessage(entityName));
    
    serviceLines.push('');
    serviceLines.push(`  // Watch ${entityName} changes`);
    serviceLines.push(`  rpc Watch${entityName}(Watch${entityName}Request) returns (stream ${entityName}Event);`);
  }
  
  serviceLines.push('}');
  
  const definition = [...messages, '', serviceLines.join('\n')].join('\n\n');
  
  return {
    name: serviceName,
    definition,
    messages,
    imports,
  };
}

function generateCreateRequestMessage(
  entity: Entity,
  options: ProtoServiceOptions,
  imports: Set<string>
): string {
  const entityName = toPascalCase(entity.name.name);
  const lines: string[] = [`message Create${entityName}Request {`];
  const fieldNums = fieldNumbers();
  
  // Skip id and timestamps for create
  const skipFields = new Set(['id', 'created_at', 'createdAt', 'updated_at', 'updatedAt']);
  
  for (const field of entity.fields) {
    if (skipFields.has(field.name.name) || skipFields.has(toSnakeCase(field.name.name))) {
      continue;
    }
    
    const fieldNum = fieldNums.next().value;
    const { protoType, fieldImports } = resolveType(field.type, options);
    fieldImports.forEach(i => imports.add(i));
    
    const fieldName = toSnakeCase(field.name.name);
    lines.push(`  ${protoType} ${fieldName} = ${fieldNum};`);
  }
  
  // Add idempotency key
  const idemNum = fieldNums.next().value;
  lines.push(`  string idempotency_key = ${idemNum};`);
  
  lines.push('}');
  return lines.join('\n');
}

function generateCreateResponseMessage(entityName: string): string {
  return [
    `message Create${entityName}Response {`,
    `  ${entityName} ${toSnakeCase(entityName)} = 1;`,
    '}',
  ].join('\n');
}

function generateGetRequestMessage(entityName: string): string {
  return [
    `message Get${entityName}Request {`,
    '  string id = 1 [(validate.rules).string.uuid = true];',
    '}',
  ].join('\n');
}

function generateGetResponseMessage(entityName: string): string {
  return [
    `message Get${entityName}Response {`,
    `  ${entityName} ${toSnakeCase(entityName)} = 1;`,
    '}',
  ].join('\n');
}

function generateUpdateRequestMessage(
  entity: Entity,
  options: ProtoServiceOptions,
  imports: Set<string>
): string {
  const entityName = toPascalCase(entity.name.name);
  const lines: string[] = [
    `message Update${entityName}Request {`,
    '  string id = 1 [(validate.rules).string.uuid = true];',
  ];
  
  const fieldNums = fieldNumbers(2);
  const skipFields = new Set(['id', 'created_at', 'createdAt']);
  
  for (const field of entity.fields) {
    if (skipFields.has(field.name.name) || skipFields.has(toSnakeCase(field.name.name))) {
      continue;
    }
    
    const fieldNum = fieldNums.next().value;
    const { protoType, fieldImports } = resolveType(field.type, options);
    fieldImports.forEach(i => imports.add(i));
    
    const fieldName = toSnakeCase(field.name.name);
    lines.push(`  optional ${protoType} ${fieldName} = ${fieldNum};`);
  }
  
  const maskNum = fieldNums.next().value;
  lines.push(`  google.protobuf.FieldMask update_mask = ${maskNum};`);
  
  lines.push('}');
  return lines.join('\n');
}

function generateUpdateResponseMessage(entityName: string): string {
  return [
    `message Update${entityName}Response {`,
    `  ${entityName} ${toSnakeCase(entityName)} = 1;`,
    '}',
  ].join('\n');
}

function generateDeleteRequestMessage(entityName: string): string {
  return [
    `message Delete${entityName}Request {`,
    '  string id = 1 [(validate.rules).string.uuid = true];',
    '}',
  ].join('\n');
}

function generateDeleteResponseMessage(_entityName: string): string {
  return [
    `message Delete${_entityName}Response {`,
    '  bool deleted = 1;',
    '}',
  ].join('\n');
}

function generateListRequestMessage(entityName: string): string {
  return [
    `message List${entityName}sRequest {`,
    '  int32 page_size = 1 [(validate.rules).int32 = {gte: 1, lte: 100}];',
    '  string page_token = 2;',
    '}',
  ].join('\n');
}

function generateListResponseMessage(entityName: string): string {
  return [
    `message List${entityName}sResponse {`,
    `  repeated ${entityName} ${toSnakeCase(entityName)}s = 1;`,
    '  string next_page_token = 2;',
    '  int32 total_count = 3;',
    '}',
  ].join('\n');
}

function generateWatchRequestMessage(entityName: string): string {
  return [
    `message Watch${entityName}Request {`,
    '  string id = 1;',
    '  bool include_initial = 2;',
    '}',
  ].join('\n');
}

function generateEventMessage(entityName: string): string {
  const prefix = toScreamingSnakeCase(entityName);
  return [
    `message ${entityName}Event {`,
    '  enum EventType {',
    `    ${prefix}_EVENT_TYPE_UNSPECIFIED = 0;`,
    `    ${prefix}_EVENT_TYPE_CREATED = 1;`,
    `    ${prefix}_EVENT_TYPE_UPDATED = 2;`,
    `    ${prefix}_EVENT_TYPE_DELETED = 3;`,
    '  }',
    '  EventType type = 1;',
    `  ${entityName} ${toSnakeCase(entityName)} = 2;`,
    '  google.protobuf.Timestamp occurred_at = 3;',
    '}',
  ].join('\n');
}
