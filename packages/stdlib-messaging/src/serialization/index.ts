/**
 * Serialization module exports
 */

// Types and interfaces
export type {
  Serializer,
  SerializerRegistry,
  SchemaRegistry,
  ValidationResult,
  ValidationError,
  CompatibilityResult,
  CompatibilityIssue,
  SchemaStore,
  SchemaInfo,
  EncodingOptions,
  DecodingOptions,
  SchemaMigration,
  SchemaMigrator,
} from './types.js';

export { 
  SerializationFormat,
  CompressionType,
  SchemaCompatibility,
} from './types.js';

// Core implementations
export { 
  AbstractSerializer,
  DefaultSerializerRegistry,
  ValidatingSerializer,
  CachingSerializer,
  serializerRegistry,
} from './serializer.js';

export { registerSerializer } from './serializer.js';

// JSON serializer
export { 
  JsonSerializer,
  SafeJsonSerializer,
  StreamingJsonSerializer,
} from './json.js';

// Schema registry
export {
  InMemorySchemaStore,
  JsonSchemaValidator,
  DefaultSchemaRegistry,
  DefaultSchemaMigrator,
} from './schema.js';
