// ============================================================================
// ISL to Protobuf/gRPC Code Generator
// Generates .proto files, buf.yaml, and client/server stubs
// ============================================================================

export { generate, type GenerateOptions, type GeneratedFile } from './generator';

// Proto generation
export { generateProtoTypes, type ProtoTypeOptions } from './proto/types';
export { generateProtoMessages, type ProtoMessageOptions } from './proto/messages';
export { generateProtoServices, type ProtoServiceOptions } from './proto/services';
export { generateProtoOptions, type CustomProtoOptions } from './proto/options';

// gRPC stub generation
export { generateTypeScriptStubs, type TypeScriptStubOptions } from './grpc/typescript';
export { generateGoStubs, type GoStubOptions } from './grpc/go';

// Connect-RPC generation
export { generateConnectTypeScript, type ConnectOptions } from './connect/typescript';

// Error mapping
export {
  mapErrorToGrpcStatus,
  mapBehaviorErrors,
  generateErrorMappingComment,
  generateStatusCodeMap,
  GrpcStatusCode,
  GRPC_STATUS_NAMES,
  type MappedError,
} from './error-mapping';

// Utilities
export { toProtoCase, toSnakeCase, toPascalCase, toCamelCase } from './utils';
