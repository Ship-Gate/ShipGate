/**
 * ISL Contract Migration
 * 
 * Converts existing contract sources (OpenAPI, Zod, TypeScript) into
 * a starter ISL AST with conservative handling of unknowns.
 */

import type {
  Domain,
  TypeDeclaration,
  TypeDefinition,
  Behavior,
  Entity,
  Field,
  InputSpec,
  OutputSpec,
  ErrorSpec,
  PostconditionBlock,
  Identifier,
  StringLiteral,
  PrimitiveType,
  StructType,
  ListType,
  EnumType,
  EnumVariant,
  UnionType,
  UnionVariant,
  OptionalType,
  ReferenceType,
  ConstrainedType,
  Constraint,
  Expression,
  BooleanLiteral,
  SourceLocation,
} from '@isl-lang/parser';

import type {
  ApiContract,
  MigrationResult,
  MigrationNote,
  MigrationConfig,
  MigrationStats,
  ExtractedType,
  ExtractedOperation,
  ExtractedField,
  TypeMappingResult,
  NoteCategory,
  NotePriority,
  ContractSourceType,
} from './migrateTypes.js';

import {
  DEFAULT_MIGRATION_CONFIG,
  createMigrationLocation,
  generateNoteId,
} from './migrateTypes.js';

import { openAPIAdapter } from './sources/openapi.js';
import { zodAdapter } from './sources/zod.js';
import { typescriptAdapter } from './sources/typescript.js';

/**
 * Migrate contracts to ISL AST
 * 
 * @param contracts Array of API contracts to migrate
 * @param config Migration configuration
 * @returns Migration result with AST and notes
 * 
 * @example
 * ```typescript
 * const result = migrateContracts([
 *   { id: '1', sourceType: 'openapi', name: 'API', sourcePath: 'api.json', content: '...' }
 * ]);
 * 
 * console.log(result.ast);      // Partial<Domain>
 * console.log(result.notes);    // MigrationNote[] (open questions)
 * console.log(result.stats);    // Migration statistics
 * ```
 */
export function migrateContracts(
  contracts: ApiContract[],
  config: MigrationConfig = {}
): MigrationResult {
  const startTime = performance.now();
  const mergedConfig = { ...DEFAULT_MIGRATION_CONFIG, ...config };
  
  const context: MigrationContext = {
    config: mergedConfig,
    notes: [],
    noteCounter: 0,
    typeRegistry: new Map(),
    stats: {
      typesExtracted: 0,
      behaviorsExtracted: 0,
      entitiesInferred: 0,
      openQuestions: 0,
      typeFallbacks: 0,
      durationMs: 0,
    },
  };
  
  const allTypes: ExtractedType[] = [];
  const allOperations: ExtractedOperation[] = [];
  const processedContracts: string[] = [];
  
  // Extract types and operations from all contracts
  for (const contract of contracts) {
    const adapter = getAdapter(contract.sourceType);
    if (!adapter) {
      addNote(context, {
        category: 'general',
        priority: 'high',
        description: `Unknown source type: ${contract.sourceType}`,
        sourceLocation: { file: contract.sourcePath },
      });
      continue;
    }
    
    try {
      // Type assertion needed because the adapter is matched to contract type at runtime
      const types = adapter.extractTypes(contract as never);
      const operations = adapter.extractOperations(contract as never);
      
      allTypes.push(...types);
      allOperations.push(...operations);
      processedContracts.push(contract.id);
    } catch (error) {
      addNote(context, {
        category: 'general',
        priority: 'critical',
        description: `Failed to process contract ${contract.name}: ${error instanceof Error ? error.message : String(error)}`,
        sourceLocation: { file: contract.sourcePath },
      });
    }
  }
  
  // Convert extracted types to ISL TypeDeclarations
  const typeDeclarations: TypeDeclaration[] = [];
  for (const extracted of allTypes) {
    if (extracted.name) {
      const declaration = extractedTypeToDeclaration(context, extracted, contracts[0]?.sourcePath ?? 'unknown');
      typeDeclarations.push(declaration);
      context.stats.typesExtracted++;
    }
  }
  
  // Convert operations to ISL Behaviors
  const behaviors: Behavior[] = [];
  for (const operation of allOperations) {
    const behavior = operationToBehavior(context, operation, contracts[0]?.sourcePath ?? 'unknown');
    behaviors.push(behavior);
    context.stats.behaviorsExtracted++;
  }
  
  // Infer entities from types if enabled
  const entities: Entity[] = [];
  if (mergedConfig.inferEntities) {
    for (const type of allTypes) {
      if (shouldInferEntity(type)) {
        const entity = inferEntity(context, type, contracts[0]?.sourcePath ?? 'unknown');
        entities.push(entity);
        context.stats.entitiesInferred++;
      }
    }
  }
  
  // Build partial Domain AST
  const domainName = mergedConfig.domainName || inferDomainName(contracts);
  const location = createMigrationLocation(contracts[0]?.sourcePath ?? 'migrated.isl');
  
  const ast: Partial<Domain> = {
    kind: 'Domain',
    name: createIdentifier(domainName, location),
    version: createStringLiteral(mergedConfig.version, location),
    imports: [],
    types: typeDeclarations,
    entities,
    behaviors,
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    location,
  };
  
  context.stats.openQuestions = context.notes.length;
  context.stats.durationMs = Math.round(performance.now() - startTime);
  
  return {
    ast,
    notes: context.notes,
    stats: context.stats,
    processedContracts,
  };
}

// ============================================================================
// Internal Types
// ============================================================================

interface MigrationContext {
  config: Required<MigrationConfig>;
  notes: MigrationNote[];
  noteCounter: number;
  typeRegistry: Map<string, TypeDefinition>;
  stats: MigrationStats;
}

// ============================================================================
// Adapter Selection
// ============================================================================

function getAdapter(sourceType: ContractSourceType) {
  switch (sourceType) {
    case 'openapi': return openAPIAdapter;
    case 'zod': return zodAdapter;
    case 'typescript': return typescriptAdapter;
    default: return null;
  }
}

// ============================================================================
// Type Conversion
// ============================================================================

function extractedTypeToDeclaration(
  context: MigrationContext,
  extracted: ExtractedType,
  sourcePath: string
): TypeDeclaration {
  const location = createMigrationLocation(sourcePath);
  const { type, note } = mapExtractedToISLType(context, extracted, sourcePath);
  
  if (note) {
    context.notes.push(note);
  }
  
  const declaration: TypeDeclaration = {
    kind: 'TypeDeclaration',
    name: createIdentifier(formatTypeName(extracted.name ?? 'Unknown', context.config.namingConvention), location),
    definition: type,
    annotations: [],
    location,
  };
  
  // Register type for reference resolution
  if (extracted.name) {
    context.typeRegistry.set(extracted.name, type);
  }
  
  return declaration;
}

function mapExtractedToISLType(
  context: MigrationContext,
  extracted: ExtractedType,
  sourcePath: string
): TypeMappingResult {
  const location = createMigrationLocation(sourcePath);
  
  switch (extracted.kind) {
    case 'primitive':
      return mapPrimitiveType(context, extracted, location);
      
    case 'object':
      return mapObjectType(context, extracted, sourcePath);
      
    case 'array':
      return mapArrayType(context, extracted, sourcePath);
      
    case 'enum':
      return mapEnumType(context, extracted, location);
      
    case 'union':
      return mapUnionType(context, extracted, sourcePath);
      
    case 'reference':
      return mapReferenceType(context, extracted, location);
      
    case 'unknown':
    default:
      return mapUnknownType(context, extracted, location);
  }
}

function mapPrimitiveType(
  context: MigrationContext,
  extracted: ExtractedType,
  location: SourceLocation
): TypeMappingResult {
  const primitiveMap: Record<string, PrimitiveType['name']> = {
    'String': 'String',
    'string': 'String',
    'Int': 'Int',
    'integer': 'Int',
    'int': 'Int',
    'Decimal': 'Decimal',
    'number': 'Decimal',
    'float': 'Decimal',
    'double': 'Decimal',
    'Boolean': 'Boolean',
    'boolean': 'Boolean',
    'bool': 'Boolean',
    'Timestamp': 'Timestamp',
    'Date': 'Timestamp',
    'date': 'Timestamp',
    'datetime': 'Timestamp',
    'UUID': 'UUID',
    'uuid': 'UUID',
    'Duration': 'Duration',
    'duration': 'Duration',
  };
  
  const islPrimitive = primitiveMap[extracted.primitiveType ?? 'String'];
  
  if (!islPrimitive) {
    context.stats.typeFallbacks++;
    return {
      type: createPrimitiveType('String', location),
      isFallback: true,
      note: createNote(context, {
        category: 'type_mapping',
        priority: 'medium',
        description: `Unknown primitive type '${extracted.primitiveType}' mapped to String`,
        targetElement: extracted.name,
        suggestion: `Review and update type for '${extracted.name ?? 'unknown'}'`,
      }),
    };
  }
  
  let type: TypeDefinition = createPrimitiveType(islPrimitive, location);
  
  // Apply constraints if present
  if (extracted.constraints && Object.keys(extracted.constraints).length > 0) {
    const constraints = mapConstraints(extracted.constraints, location);
    if (constraints.length > 0) {
      type = {
        kind: 'ConstrainedType',
        base: type,
        constraints,
        location,
      } as ConstrainedType;
    }
  }
  
  // Wrap in Optional if nullable
  if (extracted.nullable) {
    type = {
      kind: 'OptionalType',
      inner: type,
      location,
    } as OptionalType;
  }
  
  return { type, isFallback: false };
}

function mapObjectType(
  context: MigrationContext,
  extracted: ExtractedType,
  sourcePath: string
): TypeMappingResult {
  const location = createMigrationLocation(sourcePath);
  const fields: Field[] = [];
  
  for (const prop of extracted.properties ?? []) {
    const { type, note } = mapExtractedToISLType(context, prop.type, sourcePath);
    if (note) context.notes.push(note);
    
    fields.push({
      kind: 'Field',
      name: createIdentifier(prop.name, location),
      type,
      optional: !prop.required,
      annotations: [],
      location,
    });
  }
  
  let type: TypeDefinition = {
    kind: 'StructType',
    fields,
    location,
  } as StructType;
  
  if (extracted.nullable) {
    type = {
      kind: 'OptionalType',
      inner: type,
      location,
    } as OptionalType;
  }
  
  return { type, isFallback: false };
}

function mapArrayType(
  context: MigrationContext,
  extracted: ExtractedType,
  sourcePath: string
): TypeMappingResult {
  const location = createMigrationLocation(sourcePath);
  const { type: elementType, note } = extracted.itemType
    ? mapExtractedToISLType(context, extracted.itemType, sourcePath)
    : { type: createPrimitiveType('String', location), note: undefined };
  
  let type: TypeDefinition = {
    kind: 'ListType',
    element: elementType,
    location,
  } as ListType;
  
  if (extracted.nullable) {
    type = {
      kind: 'OptionalType',
      inner: type,
      location,
    } as OptionalType;
  }
  
  return { type, isFallback: false, note };
}

function mapEnumType(
  context: MigrationContext,
  extracted: ExtractedType,
  location: SourceLocation
): TypeMappingResult {
  const variants: EnumVariant[] = (extracted.enumValues ?? []).map((value, i) => ({
    kind: 'EnumVariant' as const,
    name: createIdentifier(
      typeof value === 'string' ? formatTypeName(value, context.config.namingConvention) : `Value${i}`,
      location
    ),
    location,
  }));
  
  const type: EnumType = {
    kind: 'EnumType',
    variants,
    location,
  };
  
  return { type, isFallback: false };
}

function mapUnionType(
  context: MigrationContext,
  extracted: ExtractedType,
  sourcePath: string
): TypeMappingResult {
  const location = createMigrationLocation(sourcePath);
  const variants: UnionVariant[] = [];
  
  for (let i = 0; i < (extracted.unionTypes ?? []).length; i++) {
    const variant = extracted.unionTypes![i];
    const variantName = variant.name ?? `Variant${i + 1}`;
    
    if (variant.kind === 'object' && variant.properties) {
      const fields: Field[] = variant.properties.map(prop => {
        const { type } = mapExtractedToISLType(context, prop.type, sourcePath);
        return {
          kind: 'Field' as const,
          name: createIdentifier(prop.name, location),
          type,
          optional: !prop.required,
          annotations: [],
          location,
        };
      });
      
      variants.push({
        kind: 'UnionVariant',
        name: createIdentifier(formatTypeName(variantName, context.config.namingConvention), location),
        fields,
        location,
      });
    } else {
      // Non-object variant - create empty variant with note
      variants.push({
        kind: 'UnionVariant',
        name: createIdentifier(formatTypeName(variantName, context.config.namingConvention), location),
        fields: [],
        location,
      });
    }
  }
  
  // If we couldn't create proper variants, add a note
  let note: MigrationNote | undefined;
  if (variants.length === 0) {
    context.stats.typeFallbacks++;
    note = createNote(context, {
      category: 'type_mapping',
      priority: 'high',
      description: `Union type '${extracted.name}' could not be fully converted`,
      targetElement: extracted.name,
      suggestion: 'Manually define union variants in ISL',
    });
  }
  
  const type: UnionType = {
    kind: 'UnionType',
    variants,
    location,
  };
  
  return { type, isFallback: variants.length === 0, note };
}

function mapReferenceType(
  context: MigrationContext,
  extracted: ExtractedType,
  location: SourceLocation
): TypeMappingResult {
  const refName = extracted.refName ?? 'Unknown';
  
  const type: ReferenceType = {
    kind: 'ReferenceType',
    name: {
      kind: 'QualifiedName',
      parts: [createIdentifier(formatTypeName(refName, context.config.namingConvention), location)],
      location,
    },
    location,
  };
  
  return { type, isFallback: false };
}

function mapUnknownType(
  context: MigrationContext,
  extracted: ExtractedType,
  location: SourceLocation
): TypeMappingResult {
  context.stats.typeFallbacks++;
  
  const note = createNote(context, {
    category: 'type_mapping',
    priority: 'high',
    description: `Unknown type '${extracted.name ?? 'anonymous'}' - requires manual definition`,
    targetElement: extracted.name,
    suggestion: 'Define the type structure manually in ISL',
  });
  
  // Return String as fallback
  return {
    type: createPrimitiveType('String', location),
    isFallback: true,
    note,
  };
}

function mapConstraints(
  constraints: Record<string, unknown>,
  location: SourceLocation
): Constraint[] {
  const result: Constraint[] = [];
  
  for (const [name, value] of Object.entries(constraints)) {
    if (value === undefined) continue;
    
    result.push({
      kind: 'Constraint',
      name,
      value: {
        kind: 'NumberLiteral',
        value: typeof value === 'number' ? value : 0,
        isFloat: typeof value === 'number' && !Number.isInteger(value),
        location,
      },
      location,
    });
  }
  
  return result;
}

// ============================================================================
// Behavior Conversion
// ============================================================================

function operationToBehavior(
  context: MigrationContext,
  operation: ExtractedOperation,
  sourcePath: string
): Behavior {
  const location = createMigrationLocation(sourcePath);
  const behaviorName = formatTypeName(operation.name, context.config.namingConvention);
  
  // Convert inputs
  const inputFields: Field[] = operation.inputs.map(input => {
    const { type, note } = mapExtractedToISLType(context, input.type, sourcePath);
    if (note) context.notes.push(note);
    
    return {
      kind: 'Field' as const,
      name: createIdentifier(input.name, location),
      type,
      optional: !input.required,
      annotations: [],
      location,
    };
  });
  
  // Convert output
  let successType: TypeDefinition;
  if (operation.output) {
    const { type, note } = mapExtractedToISLType(context, operation.output, sourcePath);
    if (note) context.notes.push(note);
    successType = type;
  } else {
    successType = createPrimitiveType('Boolean', location);
  }
  
  // Convert errors
  const errors: ErrorSpec[] = operation.errors.map(err => ({
    kind: 'ErrorSpec' as const,
    name: createIdentifier(err.name, location),
    when: err.description ? createStringLiteral(err.description, location) : undefined,
    retriable: false,
    location,
  }));
  
  // Generate placeholder conditions if configured
  const preconditions: Expression[] = [];
  const postconditions: PostconditionBlock[] = [];
  
  if (context.config.generatePlaceholderPreconditions) {
    // Add note for precondition review
    context.notes.push(createNote(context, {
      category: 'behavior_gap',
      priority: 'medium',
      description: `Behavior '${behaviorName}' has no preconditions - add validation rules`,
      targetElement: behaviorName,
      suggestion: 'Define input validation preconditions',
    }));
  }
  
  if (context.config.generatePlaceholderPostconditions) {
    // Add success postcondition with true placeholder
    postconditions.push({
      kind: 'PostconditionBlock',
      condition: 'success',
      predicates: [createBooleanLiteral(true, location)],
      location,
    });
    
    context.notes.push(createNote(context, {
      category: 'behavior_gap',
      priority: 'medium',
      description: `Behavior '${behaviorName}' needs postconditions - currently placeholder`,
      targetElement: behaviorName,
      suggestion: 'Define expected outcomes as postconditions',
    }));
  }
  
  // Add security note if security requirements exist
  if (operation.security && operation.security.length > 0) {
    context.notes.push(createNote(context, {
      category: 'security_unknown',
      priority: 'high',
      description: `Behavior '${behaviorName}' has security requirements: ${operation.security.join(', ')}`,
      targetElement: behaviorName,
      suggestion: 'Add ISL security blocks for authentication/authorization',
    }));
  }
  
  const behavior: Behavior = {
    kind: 'Behavior',
    name: createIdentifier(behaviorName, location),
    description: operation.description 
      ? createStringLiteral(operation.description, location) 
      : undefined,
    input: {
      kind: 'InputSpec',
      fields: inputFields,
      location,
    } as InputSpec,
    output: {
      kind: 'OutputSpec',
      success: successType,
      errors,
      location,
    } as OutputSpec,
    preconditions,
    postconditions,
    invariants: [],
    temporal: [],
    security: [],
    compliance: [],
    location,
  };
  
  return behavior;
}

// ============================================================================
// Entity Inference
// ============================================================================

function shouldInferEntity(type: ExtractedType): boolean {
  if (type.kind !== 'object') return false;
  if (!type.name) return false;
  
  // Heuristics for entity detection:
  // - Has an 'id' field
  // - Has timestamp fields (createdAt, updatedAt)
  // - Name ends with common entity suffixes
  const hasIdField = type.properties?.some(p => 
    p.name.toLowerCase() === 'id' || p.name.toLowerCase().endsWith('id')
  );
  
  const hasTimestamps = type.properties?.some(p =>
    ['createdat', 'updatedat', 'created_at', 'updated_at'].includes(p.name.toLowerCase())
  );
  
  const entitySuffixes = ['User', 'Account', 'Order', 'Product', 'Item', 'Record', 'Entity'];
  const hasEntitySuffix = entitySuffixes.some(s => type.name?.endsWith(s));
  
  return hasIdField || hasTimestamps || hasEntitySuffix;
}

function inferEntity(
  context: MigrationContext,
  type: ExtractedType,
  sourcePath: string
): Entity {
  const location = createMigrationLocation(sourcePath);
  const entityName = formatTypeName(type.name ?? 'Entity', context.config.namingConvention);
  
  const fields: Field[] = (type.properties ?? []).map(prop => {
    const { type: fieldType, note } = mapExtractedToISLType(context, prop.type, sourcePath);
    if (note) context.notes.push(note);
    
    return {
      kind: 'Field' as const,
      name: createIdentifier(prop.name, location),
      type: fieldType,
      optional: !prop.required,
      annotations: [],
      location,
    };
  });
  
  // Add note for invariant review
  context.notes.push(createNote(context, {
    category: 'relationship',
    priority: 'medium',
    description: `Entity '${entityName}' inferred from type - verify fields and add invariants`,
    targetElement: entityName,
    suggestion: 'Add entity invariants and lifecycle if applicable',
  }));
  
  return {
    kind: 'Entity',
    name: createIdentifier(entityName, location),
    fields,
    invariants: [],
    location,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function createIdentifier(name: string, location: SourceLocation): Identifier {
  return { kind: 'Identifier', name, location };
}

function createStringLiteral(value: string, location: SourceLocation): StringLiteral {
  return { kind: 'StringLiteral', value, location };
}

function createBooleanLiteral(value: boolean, location: SourceLocation): BooleanLiteral {
  return { kind: 'BooleanLiteral', value, location };
}

function createPrimitiveType(name: PrimitiveType['name'], location: SourceLocation): PrimitiveType {
  return { kind: 'PrimitiveType', name, location };
}

function formatTypeName(name: string, convention: 'camelCase' | 'PascalCase' | 'preserve'): string {
  if (convention === 'preserve') return name;
  
  // Clean the name first
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '_');
  const words = cleaned.split('_').filter(Boolean);
  
  if (convention === 'PascalCase') {
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  }
  
  // camelCase
  return words.map((w, i) => {
    if (i === 0) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join('');
}

function inferDomainName(contracts: ApiContract[]): string {
  if (contracts.length === 0) return 'MigratedAPI';
  
  // Try to extract from first contract name
  const firstName = contracts[0].name;
  return formatTypeName(firstName.replace(/[^a-zA-Z0-9]/g, ''), 'PascalCase') || 'MigratedAPI';
}

function addNote(context: MigrationContext, params: Omit<MigrationNote, 'id'>): void {
  context.notes.push(createNote(context, params));
}

function createNote(
  context: MigrationContext,
  params: Omit<MigrationNote, 'id'>
): MigrationNote {
  context.noteCounter++;
  return {
    id: generateNoteId(params.category, context.noteCounter),
    ...params,
  };
}

// Re-export for convenience
export type { ApiContract, MigrationResult, MigrationNote, MigrationConfig };
