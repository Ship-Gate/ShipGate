/**
 * Serialization types and interfaces
 */

import type { Serializer, Schema, SchemaCompatibility } from '../types.js';

// ============================================================================
// SERIALIZER REGISTRY
// ============================================================================

export interface SerializerRegistry {
  /**
   * Register a serializer for a content type
   */
  register(contentType: string, serializer: Serializer): void;
  
  /**
   * Get a serializer for a content type
   */
  get(contentType: string): Serializer | undefined;
  
  /**
   * Get all registered content types
   */
  getContentTypes(): string[];
}

// ============================================================================
// SCHEMA REGISTRY
// ============================================================================

export interface SchemaRegistry {
  /**
   * Register a schema
   */
  register(schema: Schema): Promise<void>;
  
  /**
   * Get a schema by ID
   */
  get(schemaId: string): Promise<Schema | null>;
  
  /**
   * Get a specific version of a schema
   */
  getVersion(schemaId: string, version: string): Promise<Schema | null>;
  
  /**
   * List all versions of a schema
   */
  listVersions(schemaId: string): Promise<string[]>;
  
  /**
   * Validate data against a schema
   */
  validate(schemaId: string, data: any, version?: string): Promise<ValidationResult>;
  
  /**
   * Check compatibility between schema versions
   */
  checkCompatibility(
    schemaId: string,
    fromVersion: string,
    toVersion: string
  ): Promise<CompatibilityResult>;
  
  /**
   * Evolve a schema to a new version
   */
  evolve(schemaId: string, newSchema: Schema): Promise<void>;
}

export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  
  /** Validation errors if any */
  errors: ValidationError[];
}

export interface ValidationError {
  /** Error message */
  message: string;
  
  /** Path to the error in the data */
  path: string;
  
  /** Error code */
  code: string;
}

export interface CompatibilityResult {
  /** Whether schemas are compatible */
  compatible: boolean;
  
  /** Type of compatibility */
  compatibility: SchemaCompatibility;
  
  /** Compatibility issues if any */
  issues: CompatibilityIssue[];
}

export interface CompatibilityIssue {
  /** Issue description */
  description: string;
  
  /** Severity level */
  severity: 'error' | 'warning';
  
  /** Field affected */
  field?: string;
}

// ============================================================================
// SCHEMA STORE
// ============================================================================

export interface SchemaStore {
  /**
   * Store a schema
   */
  store(schema: Schema): Promise<void>;
  
  /**
   * Retrieve a schema
   */
  retrieve(schemaId: string, version?: string): Promise<Schema | null>;
  
  /**
   * List all schemas
   */
  list(): Promise<SchemaInfo[]>;
  
  /**
   * Delete a schema
   */
  delete(schemaId: string, version?: string): Promise<void>;
}

export interface SchemaInfo {
  /** Schema ID */
  id: string;
  
  /** Schema version */
  version: string;
  
  /** Creation timestamp */
  createdAt: number;
  
  /** Schema description */
  description?: string;
}

// ============================================================================
// SERIALIZATION FORMAT
// ============================================================================

export enum SerializationFormat {
  /** JSON format */
  JSON = 'application/json',
  
  /** Binary format */
  BINARY = 'application/octet-stream',
  
  /** Protocol Buffers */
  PROTOBUF = 'application/x-protobuf',
  
  /** Avro */
  AVRO = 'avro/binary',
  
  /** MessagePack */
  MSGPACK = 'application/x-msgpack',
  
  /** CBOR */
  CBOR = 'application/cbor',
}

// ============================================================================
// ENCODING OPTIONS
// ============================================================================

export interface EncodingOptions {
  /** Pretty print JSON */
  pretty?: boolean;
  
  /** Compression */
  compression?: CompressionType;
  
  /** Custom encoding parameters */
  custom?: Record<string, any>;
}

export enum CompressionType {
  /** No compression */
  NONE = 'none',
  
  /** Gzip compression */
  GZIP = 'gzip',
  
  /** Brotli compression */
  BROTLI = 'brotli',
  
  /** LZ4 compression */
  LZ4 = 'lz4',
}

// ============================================================================
// DECODING OPTIONS
// ============================================================================

export interface DecodingOptions {
  /** Allow trailing commas in JSON */
  allowTrailingCommas?: boolean;
  
  /** Allow comments in JSON */
  allowComments?: boolean;
  
  /** Custom decoding parameters */
  custom?: Record<string, any>;
}

// ============================================================================
// SCHEMA MIGRATION
// ============================================================================

export interface SchemaMigration {
  /** Source version */
  fromVersion: string;
  
  /** Target version */
  toVersion: string;
  
  /** Migration function */
  migrate: (data: any) => any;
  
  /** Migration description */
  description?: string;
}

export interface SchemaMigrator {
  /**
   * Register a migration
   */
  register(schemaId: string, migration: SchemaMigration): void;
  
  /**
   * Migrate data to a target version
   */
  migrate(
    schemaId: string,
    data: any,
    fromVersion: string,
    toVersion: string
  ): Promise<any>;
  
  /**
   * Get migration path between versions
   */
  getMigrationPath(
    schemaId: string,
    fromVersion: string,
    toVersion: string
  ): SchemaMigration[];
}
