/**
 * ISL Migration Tools
 * 
 * Convert existing API specifications to ISL format.
 */

export {
  OpenAPIConverter,
  convertOpenAPI,
  type OpenAPISpec,
  type OpenAPIConversionOptions,
} from './converters/openapi.js';

export {
  GraphQLConverter,
  convertGraphQL,
  type GraphQLSchema,
  type GraphQLConversionOptions,
} from './converters/graphql.js';

export {
  ProtobufConverter,
  convertProtobuf,
  type ProtobufDefinition,
  type ProtobufConversionOptions,
} from './converters/protobuf.js';

export {
  JSONSchemaConverter,
  convertJSONSchema,
  type JSONSchema,
  type JSONSchemaConversionOptions,
} from './converters/json-schema.js';

export {
  AsyncAPIConverter,
  convertAsyncAPI,
  type AsyncAPISpec,
  type AsyncAPIConversionOptions,
} from './converters/asyncapi.js';

export {
  MigrationEngine,
  detectFormat,
  type MigrationOptions,
  type MigrationResult,
  type DetectedFormat,
} from './engine.js';

export {
  ISLEmitter,
  emitISL,
  type EmitterOptions,
} from './emitter.js';
