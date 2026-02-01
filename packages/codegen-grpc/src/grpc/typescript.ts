// ============================================================================
// TypeScript gRPC Stub Generation
// ============================================================================

import type { Domain, Behavior, Entity } from '@isl-lang/isl-core';
import type { GeneratedFile } from '../generator';
import { toPascalCase, toCamelCase, toSnakeCase } from '../utils';

// ==========================================================================
// OPTIONS
// ==========================================================================

export interface TypeScriptStubOptions {
  /** Proto package for imports */
  protoPackage: string;
  /** Output directory */
  outputPath?: string;
  /** Generate client stubs */
  generateClient?: boolean;
  /** Generate server stubs */
  generateServer?: boolean;
  /** Include validation */
  includeValidation?: boolean;
  /** Use native gRPC or gRPC-web */
  grpcVariant?: 'native' | 'web';
}

// ==========================================================================
// GENERATOR
// ==========================================================================

/**
 * Generate TypeScript gRPC client and server stubs
 */
export function generateTypeScriptStubs(
  domain: Domain,
  options: TypeScriptStubOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const outPath = options.outputPath ?? 'gen/ts';
  const domainName = domain.name.name.toLowerCase();
  
  // Generate client
  if (options.generateClient !== false) {
    files.push({
      path: `${outPath}/${domainName}_client.ts`,
      content: generateClientStub(domain, options),
      type: 'typescript',
    });
  }
  
  // Generate server
  if (options.generateServer !== false) {
    files.push({
      path: `${outPath}/${domainName}_server.ts`,
      content: generateServerStub(domain, options),
      type: 'typescript',
    });
  }
  
  // Generate types
  files.push({
    path: `${outPath}/${domainName}_types.ts`,
    content: generateTypeDefinitions(domain, options),
    type: 'typescript',
  });
  
  // Generate index
  files.push({
    path: `${outPath}/index.ts`,
    content: generateIndexFile(domainName),
    type: 'typescript',
  });
  
  return files;
}

// ==========================================================================
// CLIENT STUB GENERATION
// ==========================================================================

function generateClientStub(domain: Domain, options: TypeScriptStubOptions): string {
  const domainName = toPascalCase(domain.name.name);
  const serviceName = `${domainName}Service`;
  
  const lines: string[] = [
    '// ==========================================================================',
    `// ${serviceName} Client`,
    '// Auto-generated from ISL domain definition',
    '// ==========================================================================',
    '',
    'import * as grpc from \'@grpc/grpc-js\';',
    `import type { ${serviceName}Client as I${serviceName}Client } from './${domain.name.name.toLowerCase()}_grpc_pb';`,
    `import * as pb from './${domain.name.name.toLowerCase()}_pb';`,
    '',
  ];
  
  // Client interface
  lines.push(`export interface ${serviceName}ClientConfig {`);
  lines.push('  address: string;');
  lines.push('  credentials?: grpc.ChannelCredentials;');
  lines.push('  options?: grpc.ClientOptions;');
  lines.push('}');
  lines.push('');
  
  // Client class
  lines.push(`export class ${serviceName}Client {`);
  lines.push('  private client: grpc.Client;');
  lines.push('');
  lines.push(`  constructor(config: ${serviceName}ClientConfig) {`);
  lines.push('    const credentials = config.credentials ?? grpc.credentials.createInsecure();');
  lines.push('    this.client = new grpc.Client(config.address, credentials, config.options);');
  lines.push('  }');
  lines.push('');
  
  // Generate method for each behavior
  for (const behavior of domain.behaviors) {
    const methodCode = generateClientMethod(behavior);
    lines.push(methodCode);
    lines.push('');
  }
  
  // Generate CRUD methods for entities
  for (const entity of domain.entities) {
    const crudMethods = generateCrudClientMethods(entity);
    lines.push(crudMethods);
    lines.push('');
  }
  
  lines.push('  close(): void {');
  lines.push('    this.client.close();');
  lines.push('  }');
  lines.push('}');
  
  return lines.join('\n');
}

function generateClientMethod(behavior: Behavior): string {
  const methodName = toCamelCase(behavior.name.name);
  const pascalName = toPascalCase(behavior.name.name);
  
  const lines: string[] = [];
  
  // Add JSDoc
  if (behavior.description) {
    lines.push(`  /**`);
    lines.push(`   * ${behavior.description.value}`);
    lines.push(`   */`);
  }
  
  lines.push(`  async ${methodName}(`);
  lines.push(`    request: pb.${pascalName}Request`);
  lines.push(`  ): Promise<pb.${pascalName}Response> {`);
  lines.push('    return new Promise((resolve, reject) => {');
  lines.push('      this.client.makeUnaryRequest(');
  lines.push(`        '/${pascalName}Service/${pascalName}',`);
  lines.push(`        (req: pb.${pascalName}Request) => Buffer.from(req.serializeBinary()),`);
  lines.push(`        (buf: Buffer) => pb.${pascalName}Response.deserializeBinary(new Uint8Array(buf)),`);
  lines.push('        request,');
  lines.push('        (err, response) => {');
  lines.push('          if (err) reject(err);');
  lines.push('          else resolve(response!);');
  lines.push('        }');
  lines.push('      );');
  lines.push('    });');
  lines.push('  }');
  
  return lines.join('\n');
}

function generateCrudClientMethods(entity: Entity): string {
  const entityName = toPascalCase(entity.name.name);
  const varName = toCamelCase(entity.name.name);
  
  return `
  async create${entityName}(
    request: pb.Create${entityName}Request
  ): Promise<pb.Create${entityName}Response> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/${entityName}Service/Create${entityName}',
        (req: pb.Create${entityName}Request) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.Create${entityName}Response.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }

  async get${entityName}(
    request: pb.Get${entityName}Request
  ): Promise<pb.Get${entityName}Response> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/${entityName}Service/Get${entityName}',
        (req: pb.Get${entityName}Request) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.Get${entityName}Response.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }

  async update${entityName}(
    request: pb.Update${entityName}Request
  ): Promise<pb.Update${entityName}Response> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/${entityName}Service/Update${entityName}',
        (req: pb.Update${entityName}Request) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.Update${entityName}Response.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }

  async delete${entityName}(
    request: pb.Delete${entityName}Request
  ): Promise<pb.Delete${entityName}Response> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/${entityName}Service/Delete${entityName}',
        (req: pb.Delete${entityName}Request) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.Delete${entityName}Response.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }

  async list${entityName}s(
    request: pb.List${entityName}sRequest
  ): Promise<pb.List${entityName}sResponse> {
    return new Promise((resolve, reject) => {
      this.client.makeUnaryRequest(
        '/${entityName}Service/List${entityName}s',
        (req: pb.List${entityName}sRequest) => Buffer.from(req.serializeBinary()),
        (buf: Buffer) => pb.List${entityName}sResponse.deserializeBinary(new Uint8Array(buf)),
        request,
        (err, response) => {
          if (err) reject(err);
          else resolve(response!);
        }
      );
    });
  }`;
}

// ==========================================================================
// SERVER STUB GENERATION
// ==========================================================================

function generateServerStub(domain: Domain, options: TypeScriptStubOptions): string {
  const domainName = toPascalCase(domain.name.name);
  const serviceName = `${domainName}Service`;
  
  const lines: string[] = [
    '// ==========================================================================',
    `// ${serviceName} Server`,
    '// Auto-generated from ISL domain definition',
    '// ==========================================================================',
    '',
    'import * as grpc from \'@grpc/grpc-js\';',
    `import * as pb from './${domain.name.name.toLowerCase()}_pb';`,
    '',
  ];
  
  // Service interface
  lines.push(`export interface I${serviceName} {`);
  
  for (const behavior of domain.behaviors) {
    const methodName = toCamelCase(behavior.name.name);
    const pascalName = toPascalCase(behavior.name.name);
    lines.push(`  ${methodName}(`);
    lines.push(`    call: grpc.ServerUnaryCall<pb.${pascalName}Request, pb.${pascalName}Response>,`);
    lines.push(`    callback: grpc.sendUnaryData<pb.${pascalName}Response>`);
    lines.push('  ): void;');
  }
  
  // CRUD methods for entities
  for (const entity of domain.entities) {
    const entityName = toPascalCase(entity.name.name);
    lines.push(`  create${entityName}(`);
    lines.push(`    call: grpc.ServerUnaryCall<pb.Create${entityName}Request, pb.Create${entityName}Response>,`);
    lines.push(`    callback: grpc.sendUnaryData<pb.Create${entityName}Response>`);
    lines.push('  ): void;');
    lines.push(`  get${entityName}(`);
    lines.push(`    call: grpc.ServerUnaryCall<pb.Get${entityName}Request, pb.Get${entityName}Response>,`);
    lines.push(`    callback: grpc.sendUnaryData<pb.Get${entityName}Response>`);
    lines.push('  ): void;');
    lines.push(`  update${entityName}(`);
    lines.push(`    call: grpc.ServerUnaryCall<pb.Update${entityName}Request, pb.Update${entityName}Response>,`);
    lines.push(`    callback: grpc.sendUnaryData<pb.Update${entityName}Response>`);
    lines.push('  ): void;');
    lines.push(`  delete${entityName}(`);
    lines.push(`    call: grpc.ServerUnaryCall<pb.Delete${entityName}Request, pb.Delete${entityName}Response>,`);
    lines.push(`    callback: grpc.sendUnaryData<pb.Delete${entityName}Response>`);
    lines.push('  ): void;');
    lines.push(`  list${entityName}s(`);
    lines.push(`    call: grpc.ServerUnaryCall<pb.List${entityName}sRequest, pb.List${entityName}sResponse>,`);
    lines.push(`    callback: grpc.sendUnaryData<pb.List${entityName}sResponse>`);
    lines.push('  ): void;');
  }
  
  lines.push('}');
  lines.push('');
  
  // Server builder
  lines.push(`export function create${serviceName}Server(`);
  lines.push(`  implementation: I${serviceName}`);
  lines.push('): grpc.Server {');
  lines.push('  const server = new grpc.Server();');
  lines.push('');
  lines.push('  const serviceDefinition: grpc.ServiceDefinition<grpc.UntypedServiceImplementation> = {');
  
  // Add service definition entries
  for (const behavior of domain.behaviors) {
    const methodName = toCamelCase(behavior.name.name);
    const pascalName = toPascalCase(behavior.name.name);
    lines.push(`    ${methodName}: {`);
    lines.push(`      path: '/${serviceName}/${pascalName}',`);
    lines.push(`      requestStream: false,`);
    lines.push(`      responseStream: false,`);
    lines.push(`      requestSerialize: (req: pb.${pascalName}Request) => Buffer.from(req.serializeBinary()),`);
    lines.push(`      requestDeserialize: (buf: Buffer) => pb.${pascalName}Request.deserializeBinary(new Uint8Array(buf)),`);
    lines.push(`      responseSerialize: (res: pb.${pascalName}Response) => Buffer.from(res.serializeBinary()),`);
    lines.push(`      responseDeserialize: (buf: Buffer) => pb.${pascalName}Response.deserializeBinary(new Uint8Array(buf)),`);
    lines.push('    },');
  }
  
  lines.push('  };');
  lines.push('');
  lines.push('  server.addService(serviceDefinition, implementation as grpc.UntypedServiceImplementation);');
  lines.push('');
  lines.push('  return server;');
  lines.push('}');
  
  return lines.join('\n');
}

// ==========================================================================
// TYPE DEFINITIONS
// ==========================================================================

function generateTypeDefinitions(domain: Domain, _options: TypeScriptStubOptions): string {
  const domainName = toPascalCase(domain.name.name);
  
  const lines: string[] = [
    '// ==========================================================================',
    `// ${domainName} TypeScript Types`,
    '// Auto-generated from ISL domain definition',
    '// ==========================================================================',
    '',
  ];
  
  // Generate interfaces for entities
  for (const entity of domain.entities) {
    const entityName = toPascalCase(entity.name.name);
    lines.push(`export interface ${entityName} {`);
    
    for (const field of entity.fields) {
      const fieldName = toCamelCase(field.name.name);
      const tsType = islTypeToTs(field.type);
      const optional = field.optional ? '?' : '';
      lines.push(`  ${fieldName}${optional}: ${tsType};`);
    }
    
    lines.push('}');
    lines.push('');
  }
  
  // Generate types for behaviors
  for (const behavior of domain.behaviors) {
    const behaviorName = toPascalCase(behavior.name.name);
    
    // Request type
    lines.push(`export interface ${behaviorName}Request {`);
    for (const field of behavior.input.fields) {
      const fieldName = toCamelCase(field.name.name);
      const tsType = islTypeToTs(field.type);
      const optional = field.optional ? '?' : '';
      lines.push(`  ${fieldName}${optional}: ${tsType};`);
    }
    lines.push('}');
    lines.push('');
    
    // Response type
    lines.push(`export type ${behaviorName}Response =`);
    lines.push(`  | { success: true; data: ${islTypeToTs(behavior.output.success)} }`);
    if (behavior.output.errors.length > 0) {
      lines.push(`  | { success: false; error: ${behaviorName}Error };`);
      lines.push('');
      lines.push(`export interface ${behaviorName}Error {`);
      lines.push(`  code: ${behaviorName}ErrorCode;`);
      lines.push('  message: string;');
      lines.push('  retriable: boolean;');
      lines.push('  retryAfterSeconds?: number;');
      lines.push('}');
      lines.push('');
      lines.push(`export enum ${behaviorName}ErrorCode {`);
      for (const error of behavior.output.errors) {
        const errorName = error.name.name.toUpperCase();
        lines.push(`  ${errorName} = '${errorName}',`);
      }
      lines.push('}');
    } else {
      lines.push(';');
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

function islTypeToTs(type: { kind: string; name?: string | { parts?: Array<{ name: string }> }; element?: unknown; inner?: unknown }): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String':
        case 'UUID':
          return 'string';
        case 'Int':
        case 'Decimal':
          return 'number';
        case 'Boolean':
          return 'boolean';
        case 'Timestamp':
          return 'Date';
        case 'Duration':
          return 'number';
        default:
          return 'unknown';
      }
    case 'ReferenceType':
      if (typeof type.name === 'object' && type.name?.parts) {
        return type.name.parts.map(p => p.name).join('.');
      }
      return 'unknown';
    case 'ListType':
      return `${islTypeToTs(type.element as { kind: string })}[]`;
    case 'OptionalType':
      return `${islTypeToTs(type.inner as { kind: string })} | null`;
    case 'MapType':
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

// ==========================================================================
// INDEX FILE
// ==========================================================================

function generateIndexFile(domainName: string): string {
  return `// ==========================================================================
// ${toPascalCase(domainName)} gRPC Exports
// ==========================================================================

export * from './${domainName}_client';
export * from './${domainName}_server';
export * from './${domainName}_types';
`;
}
