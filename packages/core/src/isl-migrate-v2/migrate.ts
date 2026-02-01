/**
 * ISL Migration V2
 *
 * Converts existing contract sources (OpenAPI, Zod, TypeScript) into
 * starter ISL AST with openQuestions for unknowns.
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
  BooleanLiteral,
  SourceLocation,
} from '@isl-lang/parser';

import type {
  MigrationSource,
  MigrationResult,
  MigrationConfig,
  MigrationStats,
  OpenQuestion,
  QuestionCategory,
  ExtractedType,
  ExtractedOperation,
  ExtractedProperty,
  ISLPrimitive,
  SourceAdapter,
} from './types.js';

import {
  DEFAULT_CONFIG,
  createLocation,
  generateQuestionId,
  PRIMITIVE_MAP,
} from './types.js';

import { openAPIAdapter } from './sources/openapi.js';
import { zodAdapter } from './sources/zod.js';
import { typescriptAdapter } from './sources/typescript.js';

// ============================================================================
// Main Migration Function
// ============================================================================

/**
 * Migrate contract sources to ISL AST
 *
 * @param sources - Array of migration sources
 * @param config - Migration configuration
 * @returns Migration result with AST, openQuestions, and stats
 *
 * @example
 * ```typescript
 * const result = migrateToISL([
 *   { id: '1', sourceType: 'openapi', name: 'API', filePath: 'api.json', content: '...' }
 * ]);
 *
 * console.log(result.ast);           // Partial<Domain>
 * console.log(result.openQuestions); // OpenQuestion[]
 * console.log(result.islOutput);     // Canonical ISL string
 * ```
 */
export function migrateToISL(
  sources: MigrationSource[],
  config: MigrationConfig = {}
): MigrationResult {
  const startTime = performance.now();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const context: MigrationContext = {
    config: mergedConfig,
    openQuestions: [],
    questionCounter: 0,
    typeRegistry: new Map(),
    stats: {
      typesExtracted: 0,
      behaviorsCreated: 0,
      entitiesInferred: 0,
      openQuestionsCount: 0,
      fallbacksUsed: 0,
      durationMs: 0,
    },
  };

  const allTypes: ExtractedType[] = [];
  const allOperations: ExtractedOperation[] = [];
  const processedSources: string[] = [];

  // Extract types and operations from all sources
  for (const source of sources) {
    const adapter = getAdapter(source.sourceType);
    if (!adapter) {
      addQuestion(context, 'semantics', 'high', {
        question: `Unknown source type: ${source.sourceType}`,
        sourceContext: { file: source.filePath },
      });
      continue;
    }

    try {
      const types = adapter.extractTypes(source);
      const operations = adapter.extractOperations(source);

      allTypes.push(...types);
      allOperations.push(...operations);
      processedSources.push(source.id);
    } catch (error) {
      addQuestion(context, 'semantics', 'critical', {
        question: `Failed to process source ${source.name}: ${error instanceof Error ? error.message : String(error)}`,
        sourceContext: { file: source.filePath },
      });
    }
  }

  // Convert extracted types to ISL TypeDeclarations
  const typeDeclarations: TypeDeclaration[] = [];
  for (const extracted of allTypes) {
    if (extracted.name) {
      const declaration = extractedTypeToDeclaration(
        context,
        extracted,
        sources[0]?.filePath ?? 'unknown'
      );
      typeDeclarations.push(declaration);
      context.stats.typesExtracted++;
    }
  }

  // Convert operations to ISL Behaviors
  const behaviors: Behavior[] = [];
  for (const operation of allOperations) {
    const behavior = operationToBehavior(
      context,
      operation,
      sources[0]?.filePath ?? 'unknown'
    );
    behaviors.push(behavior);
    context.stats.behaviorsCreated++;
  }

  // Infer entities from types if enabled
  const entities: Entity[] = [];
  if (mergedConfig.inferEntities) {
    for (const type of allTypes) {
      if (shouldInferEntity(type)) {
        const entity = inferEntity(context, type, sources[0]?.filePath ?? 'unknown');
        entities.push(entity);
        context.stats.entitiesInferred++;
      }
    }
  }

  // Build partial Domain AST
  const domainName = mergedConfig.domainName || inferDomainName(sources);
  const location = createLocation(sources[0]?.filePath ?? 'migrated.isl');

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

  context.stats.openQuestionsCount = context.openQuestions.length;
  context.stats.durationMs = Math.round(performance.now() - startTime);

  // Generate canonical ISL output
  const islOutput = generateCanonicalISL(ast);

  return {
    ast,
    openQuestions: context.openQuestions,
    stats: context.stats,
    processedSources,
    islOutput,
  };
}

// ============================================================================
// Internal Types
// ============================================================================

interface MigrationContext {
  config: Required<MigrationConfig>;
  openQuestions: OpenQuestion[];
  questionCounter: number;
  typeRegistry: Map<string, TypeDefinition>;
  stats: MigrationStats;
}

// ============================================================================
// Adapter Selection
// ============================================================================

function getAdapter(sourceType: string): SourceAdapter | null {
  switch (sourceType) {
    case 'openapi':
      return openAPIAdapter;
    case 'zod':
      return zodAdapter;
    case 'typescript':
      return typescriptAdapter;
    default:
      return null;
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
  const location = createLocation(sourcePath);
  const { type, isFallback } = mapExtractedToISLType(context, extracted, sourcePath);

  if (isFallback) {
    context.stats.fallbacksUsed++;
  }

  const declaration: TypeDeclaration = {
    kind: 'TypeDeclaration',
    name: createIdentifier(
      formatTypeName(extracted.name ?? 'Unknown', context.config.naming),
      location
    ),
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

interface TypeMappingResult {
  type: TypeDefinition;
  isFallback: boolean;
}

function mapExtractedToISLType(
  context: MigrationContext,
  extracted: ExtractedType,
  sourcePath: string
): TypeMappingResult {
  const location = createLocation(sourcePath);

  switch (extracted.kind) {
    case 'primitive':
      return mapPrimitiveType(context, extracted, location, sourcePath);

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
      return mapUnknownType(context, extracted, location, sourcePath);
  }
}

function mapPrimitiveType(
  context: MigrationContext,
  extracted: ExtractedType,
  location: SourceLocation,
  sourcePath: string
): TypeMappingResult {
  const islPrimitive = PRIMITIVE_MAP[extracted.primitiveType ?? 'String'] as ISLPrimitive;

  if (!islPrimitive) {
    addQuestion(context, 'type_mapping', 'medium', {
      question: `Unknown primitive type '${extracted.primitiveType}' - mapped to String`,
      targetElement: extracted.name,
      suggestion: `Review type mapping for '${extracted.name ?? 'unknown'}'`,
      sourceContext: { file: sourcePath },
    });

    return {
      type: createPrimitiveType('String', location),
      isFallback: true,
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
  const location = createLocation(sourcePath);
  const fields: Field[] = [];

  for (const prop of extracted.properties ?? []) {
    const { type } = mapExtractedToISLType(context, prop.type, sourcePath);

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
  const location = createLocation(sourcePath);
  const { type: elementType } = extracted.itemType
    ? mapExtractedToISLType(context, extracted.itemType, sourcePath)
    : { type: createPrimitiveType('String', location) };

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

  return { type, isFallback: false };
}

function mapEnumType(
  context: MigrationContext,
  extracted: ExtractedType,
  location: SourceLocation
): TypeMappingResult {
  const variants: EnumVariant[] = (extracted.enumValues ?? []).map((value, i) => ({
    kind: 'EnumVariant' as const,
    name: createIdentifier(
      typeof value === 'string'
        ? formatTypeName(value, context.config.naming)
        : `Value${i}`,
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
  const location = createLocation(sourcePath);
  const variants: UnionVariant[] = [];

  for (let i = 0; i < (extracted.unionTypes ?? []).length; i++) {
    const variant = extracted.unionTypes![i];
    const variantName = variant.name ?? `Variant${i + 1}`;

    if (variant.kind === 'object' && variant.properties) {
      const fields: Field[] = variant.properties.map((prop) => {
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
        name: createIdentifier(
          formatTypeName(variantName, context.config.naming),
          location
        ),
        fields,
        location,
      });
    } else {
      variants.push({
        kind: 'UnionVariant',
        name: createIdentifier(
          formatTypeName(variantName, context.config.naming),
          location
        ),
        fields: [],
        location,
      });
    }
  }

  if (variants.length === 0) {
    addQuestion(context, 'type_mapping', 'high', {
      question: `Union type '${extracted.name}' could not be fully converted`,
      targetElement: extracted.name,
      suggestion: 'Manually define union variants in ISL',
      sourceContext: { file: sourcePath },
    });
  }

  const type: UnionType = {
    kind: 'UnionType',
    variants,
    location,
  };

  return { type, isFallback: variants.length === 0 };
}

function mapReferenceType(
  _context: MigrationContext,
  extracted: ExtractedType,
  location: SourceLocation
): TypeMappingResult {
  const refName = extracted.refName ?? 'Unknown';

  const type: ReferenceType = {
    kind: 'ReferenceType',
    name: {
      kind: 'QualifiedName',
      parts: [createIdentifier(refName, location)],
      location,
    },
    location,
  };

  return { type, isFallback: false };
}

function mapUnknownType(
  context: MigrationContext,
  extracted: ExtractedType,
  location: SourceLocation,
  sourcePath: string
): TypeMappingResult {
  addQuestion(context, 'type_mapping', 'high', {
    question: `Unknown type '${extracted.name ?? 'anonymous'}' - requires manual definition`,
    targetElement: extracted.name,
    suggestion: 'Define the type structure manually in ISL',
    sourceContext: { file: sourcePath },
  });

  return {
    type: createPrimitiveType('String', location),
    isFallback: true,
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
  const location = createLocation(sourcePath);
  const behaviorName = formatTypeName(operation.name, context.config.naming);

  // Convert inputs
  const inputFields: Field[] = operation.inputs.map((input) => {
    const { type } = mapExtractedToISLType(context, input.type, sourcePath);

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
    const { type } = mapExtractedToISLType(context, operation.output, sourcePath);
    successType = type;
  } else {
    successType = createPrimitiveType('Boolean', location);
  }

  // Convert errors
  const errors: ErrorSpec[] = operation.errors.map((err) => ({
    kind: 'ErrorSpec' as const,
    name: createIdentifier(err.name, location),
    when: err.description ? createStringLiteral(err.description, location) : undefined,
    retriable: false,
    location,
  }));

  // Generate placeholder conditions
  const postconditions: PostconditionBlock[] = [];

  if (context.config.generatePreconditions) {
    addQuestion(context, 'behavior_contract', 'medium', {
      question: `Behavior '${behaviorName}' has no preconditions - what validation rules apply?`,
      targetElement: behaviorName,
      suggestion: 'Define input validation preconditions',
      sourceContext: { file: sourcePath },
    });
  }

  if (context.config.generatePostconditions) {
    postconditions.push({
      kind: 'PostconditionBlock',
      condition: 'success',
      predicates: [createBooleanLiteral(true, location)],
      location,
    });

    addQuestion(context, 'behavior_contract', 'medium', {
      question: `Behavior '${behaviorName}' needs postconditions - what are the expected outcomes?`,
      targetElement: behaviorName,
      suggestion: 'Define expected outcomes as postconditions',
      sourceContext: { file: sourcePath },
    });
  }

  // Add security note if security requirements exist
  if (operation.security && operation.security.length > 0) {
    addQuestion(context, 'security', 'high', {
      question: `Behavior '${behaviorName}' has security requirements: ${operation.security.join(', ')} - how should these be enforced?`,
      targetElement: behaviorName,
      suggestion: 'Add ISL security blocks for authentication/authorization',
      sourceContext: { file: sourcePath },
    });
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
    preconditions: [],
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

  // Heuristics for entity detection
  const hasIdField = type.properties?.some(
    (p) => p.name.toLowerCase() === 'id' || p.name.toLowerCase().endsWith('id')
  );

  const hasTimestamps = type.properties?.some((p) =>
    ['createdat', 'updatedat', 'created_at', 'updated_at'].includes(p.name.toLowerCase())
  );

  const entitySuffixes = ['User', 'Account', 'Order', 'Product', 'Item', 'Record', 'Entity'];
  const hasEntitySuffix = entitySuffixes.some((s) => type.name?.endsWith(s));

  return Boolean(hasIdField || hasTimestamps || hasEntitySuffix);
}

function inferEntity(
  context: MigrationContext,
  type: ExtractedType,
  sourcePath: string
): Entity {
  const location = createLocation(sourcePath);
  const entityName = formatTypeName(type.name ?? 'Entity', context.config.naming);

  const fields: Field[] = (type.properties ?? []).map((prop) => {
    const { type: fieldType } = mapExtractedToISLType(context, prop.type, sourcePath);

    return {
      kind: 'Field' as const,
      name: createIdentifier(prop.name, location),
      type: fieldType,
      optional: !prop.required,
      annotations: [],
      location,
    };
  });

  addQuestion(context, 'relationship', 'medium', {
    question: `Entity '${entityName}' inferred from type - are there any invariants or relationships?`,
    targetElement: entityName,
    suggestion: 'Add entity invariants and lifecycle if applicable',
    sourceContext: { file: sourcePath },
  });

  return {
    kind: 'Entity',
    name: createIdentifier(entityName, location),
    fields,
    invariants: [],
    location,
  };
}

// ============================================================================
// ISL Output Generation
// ============================================================================

function generateCanonicalISL(ast: Partial<Domain>): string {
  const lines: string[] = [];

  // Domain header
  lines.push(`domain ${ast.name?.name ?? 'MigratedAPI'} version "${ast.version?.value ?? '1.0.0'}" {`);
  lines.push('');

  // Types
  for (const type of ast.types ?? []) {
    lines.push(generateTypeDeclaration(type));
    lines.push('');
  }

  // Entities
  for (const entity of ast.entities ?? []) {
    lines.push(generateEntity(entity));
    lines.push('');
  }

  // Behaviors
  for (const behavior of ast.behaviors ?? []) {
    lines.push(generateBehavior(behavior));
    lines.push('');
  }

  lines.push('}');

  return lines.join('\n');
}

function generateTypeDeclaration(type: TypeDeclaration): string {
  return `  type ${type.name.name} = ${generateTypeDefinition(type.definition)}`;
}

function generateTypeDefinition(typeDef: TypeDefinition): string {
  switch (typeDef.kind) {
    case 'PrimitiveType':
      return typeDef.name;

    case 'StructType':
      if (typeDef.fields.length === 0) return '{}';
      const fields = typeDef.fields.map((f) => {
        const opt = f.optional ? '?' : '';
        return `    ${f.name.name}${opt}: ${generateTypeDefinition(f.type)}`;
      });
      return `{\n${fields.join(',\n')}\n  }`;

    case 'ListType':
      return `List<${generateTypeDefinition(typeDef.element)}>`;

    case 'EnumType':
      const variants = typeDef.variants.map((v) => v.name.name);
      return `enum { ${variants.join(' | ')} }`;

    case 'UnionType':
      const unionVariants = typeDef.variants.map((v) => v.name.name);
      return `union { ${unionVariants.join(' | ')} }`;

    case 'OptionalType':
      return `${generateTypeDefinition(typeDef.inner)}?`;

    case 'ReferenceType':
      return typeDef.name.parts.map((p) => p.name).join('.');

    case 'ConstrainedType':
      const base = generateTypeDefinition(typeDef.base);
      const constraints = typeDef.constraints.map((c) => `${c.name}=${c.value}`).join(', ');
      return `${base}(${constraints})`;

    default:
      return 'Unknown';
  }
}

function generateEntity(entity: Entity): string {
  const lines: string[] = [];
  lines.push(`  entity ${entity.name.name} {`);

  for (const field of entity.fields) {
    const opt = field.optional ? '?' : '';
    lines.push(`    ${field.name.name}${opt}: ${generateTypeDefinition(field.type)}`);
  }

  lines.push('  }');
  return lines.join('\n');
}

function generateBehavior(behavior: Behavior): string {
  const lines: string[] = [];
  lines.push(`  behavior ${behavior.name.name} {`);

  if (behavior.description) {
    lines.push(`    "${behavior.description.value}"`);
  }

  // Input
  lines.push('    input {');
  for (const field of behavior.input.fields) {
    const opt = field.optional ? '?' : '';
    lines.push(`      ${field.name.name}${opt}: ${generateTypeDefinition(field.type)}`);
  }
  lines.push('    }');

  // Output
  lines.push('    output {');
  lines.push(`      success: ${generateTypeDefinition(behavior.output.success)}`);
  if (behavior.output.errors.length > 0) {
    lines.push('      errors {');
    for (const err of behavior.output.errors) {
      const when = err.when ? ` when "${err.when.value}"` : '';
      lines.push(`        ${err.name.name}${when}`);
    }
    lines.push('      }');
  }
  lines.push('    }');

  // Postconditions
  for (const post of behavior.postconditions) {
    lines.push(`    post ${post.condition} {`);
    lines.push('      true // TODO: Define actual postconditions');
    lines.push('    }');
  }

  lines.push('  }');
  return lines.join('\n');
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

function createPrimitiveType(
  name: PrimitiveType['name'],
  location: SourceLocation
): PrimitiveType {
  return { kind: 'PrimitiveType', name, location };
}

function formatTypeName(
  name: string,
  convention: 'camelCase' | 'PascalCase' | 'preserve'
): string {
  if (convention === 'preserve') return name;

  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '_');
  const words = cleaned.split('_').filter(Boolean);

  if (convention === 'PascalCase') {
    return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  }

  // camelCase
  return words
    .map((w, i) => {
      if (i === 0) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join('');
}

function inferDomainName(sources: MigrationSource[]): string {
  if (sources.length === 0) return 'MigratedAPI';

  const firstName = sources[0].name;
  return formatTypeName(firstName.replace(/[^a-zA-Z0-9]/g, ''), 'PascalCase') || 'MigratedAPI';
}

function addQuestion(
  context: MigrationContext,
  category: QuestionCategory,
  priority: OpenQuestion['priority'],
  params: Omit<OpenQuestion, 'id' | 'category' | 'priority'>
): void {
  context.questionCounter++;
  context.openQuestions.push({
    id: generateQuestionId(category, context.questionCounter),
    category,
    priority,
    ...params,
  });
}

// Re-export types
export type { MigrationSource, MigrationResult, MigrationConfig, OpenQuestion };
