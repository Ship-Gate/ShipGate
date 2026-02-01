/**
 * Migration Engine
 * 
 * Unified interface for converting various API specifications to ISL.
 */

import { OpenAPIConverter, type OpenAPISpec } from './converters/openapi.js';
import { GraphQLConverter, type GraphQLSchema } from './converters/graphql.js';
import { ProtobufConverter, type ProtobufDefinition } from './converters/protobuf.js';
import { JSONSchemaConverter, type JSONSchema } from './converters/json-schema.js';
import { AsyncAPIConverter, type AsyncAPISpec } from './converters/asyncapi.js';
import { ISLEmitter } from './emitter.js';

export type DetectedFormat = 
  | 'openapi'
  | 'graphql'
  | 'protobuf'
  | 'json-schema'
  | 'asyncapi'
  | 'unknown';

export interface MigrationOptions {
  /** Source format (auto-detected if not provided) */
  format?: DetectedFormat;
  /** Domain name for generated ISL */
  domainName?: string;
  /** Include descriptions */
  includeDescriptions?: boolean;
  /** Generate preconditions */
  generatePreconditions?: boolean;
  /** Generate postconditions */
  generatePostconditions?: boolean;
  /** Output format options */
  output?: {
    /** Format output with indentation */
    pretty?: boolean;
    /** Include comments */
    includeComments?: boolean;
  };
}

export interface MigrationResult {
  /** Generated ISL code */
  isl: string;
  /** Source format detected/used */
  format: DetectedFormat;
  /** Statistics */
  stats: MigrationStats;
  /** Warnings during conversion */
  warnings: string[];
  /** Domain metadata */
  metadata: {
    name: string;
    entityCount: number;
    behaviorCount: number;
    typeCount: number;
    enumCount: number;
  };
}

export interface MigrationStats {
  /** Number of entities generated */
  entities: number;
  /** Number of behaviors generated */
  behaviors: number;
  /** Number of types generated */
  types: number;
  /** Number of enums generated */
  enums: number;
  /** Source elements that couldn't be converted */
  skipped: number;
  /** Conversion duration (ms) */
  duration: number;
}

/**
 * Migration Engine
 */
export class MigrationEngine {
  private options: MigrationOptions;
  private warnings: string[] = [];

  constructor(options: MigrationOptions = {}) {
    this.options = options;
  }

  /**
   * Migrate source to ISL
   */
  async migrate(source: string | object): Promise<MigrationResult> {
    const startTime = Date.now();
    this.warnings = [];

    // Parse source if string
    let parsed = source;
    if (typeof source === 'string') {
      parsed = this.parseSource(source);
    }

    // Detect or use provided format
    const format = this.options.format ?? detectFormat(parsed);

    if (format === 'unknown') {
      throw new Error('Unable to detect source format. Please specify format option.');
    }

    // Convert based on format
    let domain: ReturnType<typeof this.convertOpenAPI>;

    switch (format) {
      case 'openapi':
        domain = this.convertOpenAPI(parsed as OpenAPISpec);
        break;
      case 'graphql':
        domain = this.convertGraphQL(parsed);
        break;
      case 'protobuf':
        domain = this.convertProtobuf(parsed);
        break;
      case 'json-schema':
        domain = this.convertJSONSchema(parsed as JSONSchema);
        break;
      case 'asyncapi':
        domain = this.convertAsyncAPI(parsed as AsyncAPISpec);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Emit ISL
    const emitter = new ISLEmitter({
      pretty: this.options.output?.pretty ?? true,
      includeComments: this.options.output?.includeComments ?? true,
    });

    const isl = emitter.emit(domain);

    const duration = Date.now() - startTime;

    return {
      isl,
      format,
      stats: {
        entities: domain.entities.length,
        behaviors: domain.behaviors.length,
        types: domain.types.length,
        enums: domain.enums.length,
        skipped: 0,
        duration,
      },
      warnings: this.warnings,
      metadata: {
        name: domain.name,
        entityCount: domain.entities.length,
        behaviorCount: domain.behaviors.length,
        typeCount: domain.types.length,
        enumCount: domain.enums.length,
      },
    };
  }

  /**
   * Parse source string based on content
   */
  private parseSource(source: string): object {
    // Try JSON first
    try {
      return JSON.parse(source);
    } catch {
      // Not JSON
    }

    // Try YAML-like (simplified - production would use yaml parser)
    if (source.includes('openapi:') || source.includes('asyncapi:')) {
      // Would parse YAML here
      throw new Error('YAML parsing not implemented. Please convert to JSON first.');
    }

    // Check for GraphQL SDL
    if (source.includes('type ') && (source.includes('Query') || source.includes('schema'))) {
      return { __graphql_sdl: source };
    }

    // Check for Protobuf
    if (source.includes('message ') && source.includes('syntax')) {
      return { __protobuf_source: source };
    }

    throw new Error('Unable to parse source. Unsupported format.');
  }

  /**
   * Convert OpenAPI
   */
  private convertOpenAPI(spec: OpenAPISpec) {
    const converter = new OpenAPIConverter({
      domainName: this.options.domainName,
      includeDescriptions: this.options.includeDescriptions,
      inferPreconditions: this.options.generatePreconditions,
      inferPostconditions: this.options.generatePostconditions,
    });

    return converter.convert(spec);
  }

  /**
   * Convert GraphQL
   */
  private convertGraphQL(source: unknown) {
    const converter = new GraphQLConverter({
      domainName: this.options.domainName,
      includeDescriptions: this.options.includeDescriptions,
    });

    if (typeof source === 'object' && source !== null && '__graphql_sdl' in source) {
      const schema = GraphQLConverter.parseSDL((source as { __graphql_sdl: string }).__graphql_sdl);
      return converter.convert(schema);
    }

    return converter.convert(source as GraphQLSchema);
  }

  /**
   * Convert Protobuf
   */
  private convertProtobuf(source: unknown) {
    const converter = new ProtobufConverter({
      domainName: this.options.domainName,
    });

    if (typeof source === 'object' && source !== null && '__protobuf_source' in source) {
      const proto = ProtobufConverter.parseProto((source as { __protobuf_source: string }).__protobuf_source);
      return converter.convert(proto);
    }

    return converter.convert(source as ProtobufDefinition);
  }

  /**
   * Convert JSON Schema
   */
  private convertJSONSchema(schema: JSONSchema) {
    const converter = new JSONSchemaConverter({
      domainName: this.options.domainName,
      includeConstraints: true,
      generateValidation: this.options.generatePreconditions,
    });

    return converter.convert(schema);
  }

  /**
   * Convert AsyncAPI
   */
  private convertAsyncAPI(spec: AsyncAPISpec) {
    const converter = new AsyncAPIConverter({
      domainName: this.options.domainName,
    });

    return converter.convert(spec);
  }
}

/**
 * Detect format from source object
 */
export function detectFormat(source: unknown): DetectedFormat {
  if (!source || typeof source !== 'object') {
    return 'unknown';
  }

  const obj = source as Record<string, unknown>;

  // OpenAPI
  if ('openapi' in obj && typeof obj.openapi === 'string') {
    return 'openapi';
  }
  if ('swagger' in obj) {
    return 'openapi';
  }

  // AsyncAPI
  if ('asyncapi' in obj && typeof obj.asyncapi === 'string') {
    return 'asyncapi';
  }

  // GraphQL
  if ('__graphql_sdl' in obj || ('types' in obj && 'queries' in obj)) {
    return 'graphql';
  }

  // Protobuf
  if ('__protobuf_source' in obj || ('messages' in obj && 'services' in obj)) {
    return 'protobuf';
  }

  // JSON Schema
  if ('$schema' in obj || ('type' in obj && 'properties' in obj)) {
    return 'json-schema';
  }

  return 'unknown';
}

/**
 * Quick migration helper
 */
export async function migrate(
  source: string | object,
  options?: MigrationOptions
): Promise<MigrationResult> {
  const engine = new MigrationEngine(options);
  return engine.migrate(source);
}
