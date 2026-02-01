// ============================================================================
// Connect-RPC TypeScript Generation
// ============================================================================

import type { Domain, Behavior, Entity } from '@isl-lang/isl-core';
import type { GeneratedFile } from '../generator';
import { toPascalCase, toCamelCase, toSnakeCase } from '../utils';

// ==========================================================================
// OPTIONS
// ==========================================================================

export interface ConnectOptions {
  /** Proto package for imports */
  protoPackage: string;
  /** Output path */
  outputPath?: string;
  /** Transport type */
  transport?: 'grpc' | 'grpc-web' | 'http';
  /** Base URL for the service */
  baseUrl?: string;
}

// ==========================================================================
// GENERATOR
// ==========================================================================

/**
 * Generate Connect-RPC TypeScript client and types
 */
export function generateConnectTypeScript(
  domain: Domain,
  options: ConnectOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const outPath = options.outputPath ?? 'gen/connect';
  const domainName = domain.name.name.toLowerCase();
  
  // Generate Connect client
  files.push({
    path: `${outPath}/${domainName}_connect.ts`,
    content: generateConnectClient(domain, options),
    type: 'typescript',
  });
  
  // Generate hooks (React integration)
  files.push({
    path: `${outPath}/${domainName}_hooks.ts`,
    content: generateConnectHooks(domain, options),
    type: 'typescript',
  });
  
  // Generate transport configuration
  files.push({
    path: `${outPath}/transport.ts`,
    content: generateTransportConfig(options),
    type: 'typescript',
  });
  
  // Generate example usage
  files.push({
    path: `${outPath}/example.ts`,
    content: generateExampleUsage(domain, options),
    type: 'typescript',
  });
  
  return files;
}

// ==========================================================================
// CONNECT CLIENT GENERATION
// ==========================================================================

function generateConnectClient(domain: Domain, options: ConnectOptions): string {
  const domainName = toPascalCase(domain.name.name);
  const serviceName = `${domainName}Service`;
  const packagePath = options.protoPackage.replace(/\./g, '/');
  
  const lines: string[] = [
    '// ==========================================================================',
    `// ${serviceName} Connect-RPC Client`,
    '// Auto-generated from ISL domain definition',
    '// ==========================================================================',
    '',
    'import { createPromiseClient, type PromiseClient } from "@connectrpc/connect";',
    'import { createGrpcTransport } from "@connectrpc/connect-node";',
    'import { createGrpcWebTransport } from "@connectrpc/connect-web";',
    `import { ${serviceName} } from "./${domain.name.name.toLowerCase()}_connect";`,
    `import type * as pb from "./${domain.name.name.toLowerCase()}_pb";`,
    '',
  ];
  
  // Client factory
  lines.push(`// ${serviceName} client instance type`);
  lines.push(`export type ${serviceName}Client = PromiseClient<typeof ${serviceName}>;`);
  lines.push('');
  
  // Create client function
  lines.push(`export interface Create${serviceName}ClientOptions {`);
  lines.push('  baseUrl: string;');
  lines.push('  /** Use gRPC-Web for browser environments */');
  lines.push('  useBrowser?: boolean;');
  lines.push('  /** Custom fetch implementation */');
  lines.push('  fetch?: typeof fetch;');
  lines.push('  /** Request interceptor */');
  lines.push('  interceptors?: Array<(req: Request) => Request | Promise<Request>>;');
  lines.push('}');
  lines.push('');
  
  lines.push(`/**`);
  lines.push(` * Create a ${serviceName} client`);
  lines.push(` * @example`);
  lines.push(` * const client = create${serviceName}Client({ baseUrl: 'https://api.example.com' });`);
  lines.push(` * const response = await client.createUser({ email: { value: 'user@example.com' } });`);
  lines.push(` */`);
  lines.push(`export function create${serviceName}Client(options: Create${serviceName}ClientOptions): ${serviceName}Client {`);
  lines.push('  const transport = options.useBrowser');
  lines.push('    ? createGrpcWebTransport({');
  lines.push('        baseUrl: options.baseUrl,');
  lines.push('        fetch: options.fetch,');
  lines.push('      })');
  lines.push('    : createGrpcTransport({');
  lines.push('        baseUrl: options.baseUrl,');
  lines.push('        httpVersion: "2",');
  lines.push('      });');
  lines.push('');
  lines.push(`  return createPromiseClient(${serviceName}, transport);`);
  lines.push('}');
  lines.push('');
  
  // Typed wrapper class
  lines.push(`/**`);
  lines.push(` * Typed wrapper for ${serviceName} with result handling`);
  lines.push(` */`);
  lines.push(`export class ${serviceName}TypedClient {`);
  lines.push(`  private client: ${serviceName}Client;`);
  lines.push('');
  lines.push(`  constructor(options: Create${serviceName}ClientOptions) {`);
  lines.push(`    this.client = create${serviceName}Client(options);`);
  lines.push('  }');
  lines.push('');
  
  // Generate typed methods for behaviors
  for (const behavior of domain.behaviors) {
    lines.push(generateConnectTypedMethod(behavior));
    lines.push('');
  }
  
  // Generate CRUD methods for entities
  for (const entity of domain.entities) {
    lines.push(generateConnectCrudMethods(entity));
  }
  
  lines.push('}');
  lines.push('');
  
  // Result type utilities
  lines.push('// ==========================================================================');
  lines.push('// Result Type Utilities');
  lines.push('// ==========================================================================');
  lines.push('');
  lines.push('export type Result<T, E> =');
  lines.push('  | { success: true; data: T }');
  lines.push('  | { success: false; error: E };');
  lines.push('');
  lines.push('export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {');
  lines.push('  return result.success === true;');
  lines.push('}');
  lines.push('');
  lines.push('export function isError<T, E>(result: Result<T, E>): result is { success: false; error: E } {');
  lines.push('  return result.success === false;');
  lines.push('}');
  
  return lines.join('\n');
}

function generateConnectTypedMethod(behavior: Behavior): string {
  const methodName = toCamelCase(behavior.name.name);
  const pascalName = toPascalCase(behavior.name.name);
  
  const lines: string[] = [];
  
  if (behavior.description) {
    lines.push(`  /**`);
    lines.push(`   * ${behavior.description.value}`);
    lines.push(`   */`);
  }
  
  lines.push(`  async ${methodName}(`);
  lines.push(`    request: pb.${pascalName}Request`);
  lines.push(`  ): Promise<Result<pb.${pascalName}Response, Error>> {`);
  lines.push('    try {');
  lines.push(`      const response = await this.client.${methodName}(request);`);
  lines.push('      return { success: true, data: response };');
  lines.push('    } catch (error) {');
  lines.push('      return {');
  lines.push('        success: false,');
  lines.push('        error: error instanceof Error ? error : new Error(String(error)),');
  lines.push('      };');
  lines.push('    }');
  lines.push('  }');
  
  return lines.join('\n');
}

function generateConnectCrudMethods(entity: Entity): string {
  const entityName = toPascalCase(entity.name.name);
  const varName = toCamelCase(entity.name.name);
  
  return `
  async create${entityName}(
    request: pb.Create${entityName}Request
  ): Promise<Result<pb.Create${entityName}Response, Error>> {
    try {
      const response = await this.client.create${entityName}(request);
      return { success: true, data: response };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async get${entityName}(
    request: pb.Get${entityName}Request
  ): Promise<Result<pb.Get${entityName}Response, Error>> {
    try {
      const response = await this.client.get${entityName}(request);
      return { success: true, data: response };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async update${entityName}(
    request: pb.Update${entityName}Request
  ): Promise<Result<pb.Update${entityName}Response, Error>> {
    try {
      const response = await this.client.update${entityName}(request);
      return { success: true, data: response };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async delete${entityName}(
    request: pb.Delete${entityName}Request
  ): Promise<Result<pb.Delete${entityName}Response, Error>> {
    try {
      const response = await this.client.delete${entityName}(request);
      return { success: true, data: response };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async list${entityName}s(
    request: pb.List${entityName}sRequest
  ): Promise<Result<pb.List${entityName}sResponse, Error>> {
    try {
      const response = await this.client.list${entityName}s(request);
      return { success: true, data: response };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }`;
}

// ==========================================================================
// REACT HOOKS GENERATION
// ==========================================================================

function generateConnectHooks(domain: Domain, options: ConnectOptions): string {
  const domainName = toPascalCase(domain.name.name);
  const serviceName = `${domainName}Service`;
  
  const lines: string[] = [
    '// ==========================================================================',
    `// ${serviceName} React Hooks`,
    '// Auto-generated from ISL domain definition',
    '// ==========================================================================',
    '',
    'import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";',
    'import type { UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";',
    `import { ${serviceName}TypedClient, type Create${serviceName}ClientOptions } from "./${domain.name.name.toLowerCase()}_connect";`,
    `import type * as pb from "./${domain.name.name.toLowerCase()}_pb";`,
    '',
  ];
  
  // Context and provider
  lines.push('// ==========================================================================');
  lines.push('// Client Context');
  lines.push('// ==========================================================================');
  lines.push('');
  lines.push('import { createContext, useContext, type ReactNode } from "react";');
  lines.push('');
  lines.push(`const ${serviceName}Context = createContext<${serviceName}TypedClient | null>(null);`);
  lines.push('');
  lines.push(`export function ${serviceName}Provider({`);
  lines.push('  children,');
  lines.push('  options,');
  lines.push('}: {');
  lines.push('  children: ReactNode;');
  lines.push(`  options: Create${serviceName}ClientOptions;`);
  lines.push('}) {');
  lines.push(`  const client = new ${serviceName}TypedClient(options);`);
  lines.push(`  return <${serviceName}Context.Provider value={client}>{children}</${serviceName}Context.Provider>;`);
  lines.push('}');
  lines.push('');
  lines.push(`export function use${serviceName}Client(): ${serviceName}TypedClient {`);
  lines.push(`  const client = useContext(${serviceName}Context);`);
  lines.push('  if (!client) {');
  lines.push(`    throw new Error("use${serviceName}Client must be used within a ${serviceName}Provider");`);
  lines.push('  }');
  lines.push('  return client;');
  lines.push('}');
  lines.push('');
  
  // Generate hooks for entities
  for (const entity of domain.entities) {
    lines.push(generateEntityHooks(entity, serviceName));
    lines.push('');
  }
  
  return lines.join('\n');
}

function generateEntityHooks(entity: Entity, serviceName: string): string {
  const entityName = toPascalCase(entity.name.name);
  const varName = toCamelCase(entity.name.name);
  
  return `// ==========================================================================
// ${entityName} Hooks
// ==========================================================================

export function use${entityName}(id: string) {
  const client = use${serviceName}Client();
  
  return useQuery({
    queryKey: ["${varName}", id],
    queryFn: async () => {
      const result = await client.get${entityName}({ id });
      if (!result.success) throw result.error;
      return result.data.${varName};
    },
  });
}

export function use${entityName}List(options?: { pageSize?: number; pageToken?: string }) {
  const client = use${serviceName}Client();
  
  return useQuery({
    queryKey: ["${varName}s", options?.pageSize, options?.pageToken],
    queryFn: async () => {
      const result = await client.list${entityName}s({
        pageSize: options?.pageSize ?? 20,
        pageToken: options?.pageToken ?? "",
      });
      if (!result.success) throw result.error;
      return result.data;
    },
  });
}

export function useCreate${entityName}() {
  const client = use${serviceName}Client();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: pb.Create${entityName}Request) => {
      const result = await client.create${entityName}(request);
      if (!result.success) throw result.error;
      return result.data.${varName};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${varName}s"] });
    },
  });
}

export function useUpdate${entityName}() {
  const client = use${serviceName}Client();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: pb.Update${entityName}Request) => {
      const result = await client.update${entityName}(request);
      if (!result.success) throw result.error;
      return result.data.${varName};
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["${varName}s"] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ["${varName}", data.id] });
      }
    },
  });
}

export function useDelete${entityName}() {
  const client = use${serviceName}Client();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await client.delete${entityName}({ id });
      if (!result.success) throw result.error;
      return result.data.deleted;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${varName}s"] });
    },
  });
}`;
}

// ==========================================================================
// TRANSPORT CONFIGURATION
// ==========================================================================

function generateTransportConfig(options: ConnectOptions): string {
  return `// ==========================================================================
// Transport Configuration
// Auto-generated from ISL domain definition
// ==========================================================================

import { createGrpcTransport } from "@connectrpc/connect-node";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import type { Transport } from "@connectrpc/connect";

export interface TransportConfig {
  baseUrl: string;
  /** Use gRPC-Web transport (for browsers) */
  useBrowser?: boolean;
  /** Custom fetch implementation */
  fetch?: typeof fetch;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom headers */
  headers?: Record<string, string>;
}

/**
 * Create a Connect transport
 */
export function createTransport(config: TransportConfig): Transport {
  const baseConfig = {
    baseUrl: config.baseUrl,
    fetch: config.fetch,
  };

  if (config.useBrowser) {
    return createGrpcWebTransport(baseConfig);
  }

  return createGrpcTransport({
    ...baseConfig,
    httpVersion: "2",
  });
}

/**
 * Default transport configuration
 */
export const defaultTransportConfig: Partial<TransportConfig> = {
  timeout: 30000,
  useBrowser: typeof window !== "undefined",
};
`;
}

// ==========================================================================
// EXAMPLE USAGE
// ==========================================================================

function generateExampleUsage(domain: Domain, options: ConnectOptions): string {
  const domainName = toPascalCase(domain.name.name);
  const serviceName = `${domainName}Service`;
  const firstEntity = domain.entities[0];
  const entityName = firstEntity ? toPascalCase(firstEntity.name.name) : 'Entity';
  const varName = firstEntity ? toCamelCase(firstEntity.name.name) : 'entity';
  
  return `// ==========================================================================
// Example Usage - ${serviceName}
// Auto-generated from ISL domain definition
// ==========================================================================

import { create${serviceName}Client, ${serviceName}TypedClient } from "./${domain.name.name.toLowerCase()}_connect";

// Basic client usage
async function example() {
  // Create a client
  const client = create${serviceName}Client({
    baseUrl: "${options.baseUrl ?? 'https://api.example.com'}",
    useBrowser: true, // Use gRPC-Web for browser
  });

  // Or use the typed wrapper
  const typedClient = new ${serviceName}TypedClient({
    baseUrl: "${options.baseUrl ?? 'https://api.example.com'}",
  });

  // Create a ${entityName}
  const createResult = await typedClient.create${entityName}({
    // Add required fields here
    idempotencyKey: "unique-key-123",
  });

  if (createResult.success) {
    console.log("Created ${entityName}:", createResult.data.${varName});
  } else {
    console.error("Failed to create:", createResult.error.message);
  }

  // Get a ${entityName}
  const getResult = await typedClient.get${entityName}({
    id: "some-uuid",
  });

  if (getResult.success) {
    console.log("Got ${entityName}:", getResult.data.${varName});
  }

  // List ${entityName}s
  const listResult = await typedClient.list${entityName}s({
    pageSize: 20,
    pageToken: "",
  });

  if (listResult.success) {
    console.log("Total:", listResult.data.totalCount);
    for (const item of listResult.data.${varName}s) {
      console.log("Item:", item);
    }
  }
}

// React example with hooks
/*
import { ${serviceName}Provider, use${entityName}, useCreate${entityName} } from "./${domain.name.name.toLowerCase()}_hooks";

function App() {
  return (
    <${serviceName}Provider options={{ baseUrl: "${options.baseUrl ?? 'https://api.example.com'}" }}>
      <${entityName}List />
    </${serviceName}Provider>
  );
}

function ${entityName}List() {
  const { data: ${varName}s, isLoading } = use${entityName}List();
  const createMutation = useCreate${entityName}();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {${varName}s?.${varName}s.map((item) => (
        <div key={item.id}>{item.id}</div>
      ))}
      <button onClick={() => createMutation.mutate({ ... })}>
        Create New
      </button>
    </div>
  );
}
*/

export { example };
`;
}
