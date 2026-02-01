// ============================================================================
// Go gRPC Stub Generation
// ============================================================================

import type { Domain, Behavior, Entity, Field } from '@intentos/isl-core';
import type { GeneratedFile } from '../generator';
import { toPascalCase, toCamelCase, toSnakeCase } from '../utils';

// ==========================================================================
// OPTIONS
// ==========================================================================

export interface GoStubOptions {
  /** Go package path */
  goPackage: string;
  /** Proto package for imports */
  protoPackage: string;
  /** Output directory */
  outputPath?: string;
  /** Generate client */
  generateClient?: boolean;
  /** Generate server */
  generateServer?: boolean;
}

// ==========================================================================
// GENERATOR
// ==========================================================================

/**
 * Generate Go gRPC client and server stubs
 */
export function generateGoStubs(
  domain: Domain,
  options: GoStubOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const outPath = options.outputPath ?? 'gen/go';
  const domainName = domain.name.name.toLowerCase();
  
  // Generate client
  if (options.generateClient !== false) {
    files.push({
      path: `${outPath}/${domainName}_client.go`,
      content: generateGoClient(domain, options),
      type: 'go',
    });
  }
  
  // Generate server
  if (options.generateServer !== false) {
    files.push({
      path: `${outPath}/${domainName}_server.go`,
      content: generateGoServer(domain, options),
      type: 'go',
    });
  }
  
  // Generate types
  files.push({
    path: `${outPath}/${domainName}_types.go`,
    content: generateGoTypes(domain, options),
    type: 'go',
  });
  
  return files;
}

// ==========================================================================
// GO CLIENT GENERATION
// ==========================================================================

function generateGoClient(domain: Domain, options: GoStubOptions): string {
  const domainName = toPascalCase(domain.name.name);
  const serviceName = `${domainName}Service`;
  const packageName = extractPackageName(options.goPackage);
  
  const lines: string[] = [
    `package ${packageName}`,
    '',
    'import (',
    '	"context"',
    '',
    '	"google.golang.org/grpc"',
    '	"google.golang.org/grpc/credentials/insecure"',
    ')',
    '',
  ];
  
  // Client struct
  lines.push(`// ${serviceName}Client provides client methods for ${domainName} operations`);
  lines.push(`type ${serviceName}Client struct {`);
  lines.push('	conn   *grpc.ClientConn');
  lines.push(`	client ${serviceName}Client`);
  lines.push('}');
  lines.push('');
  
  // Client options
  lines.push(`// ${serviceName}ClientOptions configures the client`);
  lines.push(`type ${serviceName}ClientOptions struct {`);
  lines.push('	Address     string');
  lines.push('	DialOptions []grpc.DialOption');
  lines.push('}');
  lines.push('');
  
  // Constructor
  lines.push(`// New${serviceName}Client creates a new ${serviceName} client`);
  lines.push(`func New${serviceName}Client(opts ${serviceName}ClientOptions) (*${serviceName}Client, error) {`);
  lines.push('	dialOpts := opts.DialOptions');
  lines.push('	if len(dialOpts) == 0 {');
  lines.push('		dialOpts = []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}');
  lines.push('	}');
  lines.push('');
  lines.push('	conn, err := grpc.Dial(opts.Address, dialOpts...)');
  lines.push('	if err != nil {');
  lines.push('		return nil, err');
  lines.push('	}');
  lines.push('');
  lines.push(`	return &${serviceName}Client{`);
  lines.push('		conn:   conn,');
  lines.push(`		client: New${serviceName}Client(conn),`);
  lines.push('	}, nil');
  lines.push('}');
  lines.push('');
  
  // Close method
  lines.push(`// Close closes the client connection`);
  lines.push(`func (c *${serviceName}Client) Close() error {`);
  lines.push('	return c.conn.Close()');
  lines.push('}');
  lines.push('');
  
  // Generate methods for behaviors
  for (const behavior of domain.behaviors) {
    lines.push(generateGoClientMethod(behavior, serviceName));
    lines.push('');
  }
  
  // Generate CRUD methods for entities
  for (const entity of domain.entities) {
    lines.push(generateGoCrudClientMethods(entity, serviceName));
    lines.push('');
  }
  
  return lines.join('\n');
}

function generateGoClientMethod(behavior: Behavior, serviceName: string): string {
  const methodName = toPascalCase(behavior.name.name);
  
  const lines: string[] = [];
  
  // Add comment
  if (behavior.description) {
    lines.push(`// ${methodName} ${behavior.description.value}`);
  }
  
  lines.push(`func (c *${serviceName}Client) ${methodName}(ctx context.Context, req *${methodName}Request) (*${methodName}Response, error) {`);
  lines.push(`	return c.client.${methodName}(ctx, req)`);
  lines.push('}');
  
  return lines.join('\n');
}

function generateGoCrudClientMethods(entity: Entity, serviceName: string): string {
  const entityName = toPascalCase(entity.name.name);
  
  return `// Create${entityName} creates a new ${entityName}
func (c *${serviceName}Client) Create${entityName}(ctx context.Context, req *Create${entityName}Request) (*Create${entityName}Response, error) {
	return c.client.Create${entityName}(ctx, req)
}

// Get${entityName} retrieves a ${entityName} by ID
func (c *${serviceName}Client) Get${entityName}(ctx context.Context, req *Get${entityName}Request) (*Get${entityName}Response, error) {
	return c.client.Get${entityName}(ctx, req)
}

// Update${entityName} updates an existing ${entityName}
func (c *${serviceName}Client) Update${entityName}(ctx context.Context, req *Update${entityName}Request) (*Update${entityName}Response, error) {
	return c.client.Update${entityName}(ctx, req)
}

// Delete${entityName} deletes a ${entityName}
func (c *${serviceName}Client) Delete${entityName}(ctx context.Context, req *Delete${entityName}Request) (*Delete${entityName}Response, error) {
	return c.client.Delete${entityName}(ctx, req)
}

// List${entityName}s lists ${entityName}s with pagination
func (c *${serviceName}Client) List${entityName}s(ctx context.Context, req *List${entityName}sRequest) (*List${entityName}sResponse, error) {
	return c.client.List${entityName}s(ctx, req)
}`;
}

// ==========================================================================
// GO SERVER GENERATION
// ==========================================================================

function generateGoServer(domain: Domain, options: GoStubOptions): string {
  const domainName = toPascalCase(domain.name.name);
  const serviceName = `${domainName}Service`;
  const packageName = extractPackageName(options.goPackage);
  
  const lines: string[] = [
    `package ${packageName}`,
    '',
    'import (',
    '	"context"',
    '',
    '	"google.golang.org/grpc"',
    '	"google.golang.org/grpc/codes"',
    '	"google.golang.org/grpc/status"',
    ')',
    '',
  ];
  
  // Server interface
  lines.push(`// ${serviceName}Handler defines the interface for ${domainName} operations`);
  lines.push(`type ${serviceName}Handler interface {`);
  
  for (const behavior of domain.behaviors) {
    const methodName = toPascalCase(behavior.name.name);
    lines.push(`	${methodName}(ctx context.Context, req *${methodName}Request) (*${methodName}Response, error)`);
  }
  
  for (const entity of domain.entities) {
    const entityName = toPascalCase(entity.name.name);
    lines.push(`	Create${entityName}(ctx context.Context, req *Create${entityName}Request) (*Create${entityName}Response, error)`);
    lines.push(`	Get${entityName}(ctx context.Context, req *Get${entityName}Request) (*Get${entityName}Response, error)`);
    lines.push(`	Update${entityName}(ctx context.Context, req *Update${entityName}Request) (*Update${entityName}Response, error)`);
    lines.push(`	Delete${entityName}(ctx context.Context, req *Delete${entityName}Request) (*Delete${entityName}Response, error)`);
    lines.push(`	List${entityName}s(ctx context.Context, req *List${entityName}sRequest) (*List${entityName}sResponse, error)`);
  }
  
  lines.push('}');
  lines.push('');
  
  // Server struct
  lines.push(`// ${serviceName}Server implements the gRPC server`);
  lines.push(`type ${serviceName}Server struct {`);
  lines.push(`	Unimplemented${serviceName}Server`);
  lines.push(`	handler ${serviceName}Handler`);
  lines.push('}');
  lines.push('');
  
  // Constructor
  lines.push(`// New${serviceName}Server creates a new ${serviceName} server`);
  lines.push(`func New${serviceName}Server(handler ${serviceName}Handler) *${serviceName}Server {`);
  lines.push(`	return &${serviceName}Server{handler: handler}`);
  lines.push('}');
  lines.push('');
  
  // Register function
  lines.push(`// Register${serviceName} registers the service with a gRPC server`);
  lines.push(`func Register${serviceName}(s *grpc.Server, handler ${serviceName}Handler) {`);
  lines.push(`	Register${serviceName}Server(s, New${serviceName}Server(handler))`);
  lines.push('}');
  lines.push('');
  
  // Method implementations
  for (const behavior of domain.behaviors) {
    lines.push(generateGoServerMethod(behavior, serviceName));
    lines.push('');
  }
  
  for (const entity of domain.entities) {
    lines.push(generateGoCrudServerMethods(entity, serviceName));
    lines.push('');
  }
  
  return lines.join('\n');
}

function generateGoServerMethod(behavior: Behavior, serviceName: string): string {
  const methodName = toPascalCase(behavior.name.name);
  
  return `func (s *${serviceName}Server) ${methodName}(ctx context.Context, req *${methodName}Request) (*${methodName}Response, error) {
	if s.handler == nil {
		return nil, status.Error(codes.Unimplemented, "method ${methodName} not implemented")
	}
	return s.handler.${methodName}(ctx, req)
}`;
}

function generateGoCrudServerMethods(entity: Entity, serviceName: string): string {
  const entityName = toPascalCase(entity.name.name);
  
  return `func (s *${serviceName}Server) Create${entityName}(ctx context.Context, req *Create${entityName}Request) (*Create${entityName}Response, error) {
	if s.handler == nil {
		return nil, status.Error(codes.Unimplemented, "method Create${entityName} not implemented")
	}
	return s.handler.Create${entityName}(ctx, req)
}

func (s *${serviceName}Server) Get${entityName}(ctx context.Context, req *Get${entityName}Request) (*Get${entityName}Response, error) {
	if s.handler == nil {
		return nil, status.Error(codes.Unimplemented, "method Get${entityName} not implemented")
	}
	return s.handler.Get${entityName}(ctx, req)
}

func (s *${serviceName}Server) Update${entityName}(ctx context.Context, req *Update${entityName}Request) (*Update${entityName}Response, error) {
	if s.handler == nil {
		return nil, status.Error(codes.Unimplemented, "method Update${entityName} not implemented")
	}
	return s.handler.Update${entityName}(ctx, req)
}

func (s *${serviceName}Server) Delete${entityName}(ctx context.Context, req *Delete${entityName}Request) (*Delete${entityName}Response, error) {
	if s.handler == nil {
		return nil, status.Error(codes.Unimplemented, "method Delete${entityName} not implemented")
	}
	return s.handler.Delete${entityName}(ctx, req)
}

func (s *${serviceName}Server) List${entityName}s(ctx context.Context, req *List${entityName}sRequest) (*List${entityName}sResponse, error) {
	if s.handler == nil {
		return nil, status.Error(codes.Unimplemented, "method List${entityName}s not implemented")
	}
	return s.handler.List${entityName}s(ctx, req)
}`;
}

// ==========================================================================
// GO TYPES GENERATION
// ==========================================================================

function generateGoTypes(domain: Domain, options: GoStubOptions): string {
  const domainName = toPascalCase(domain.name.name);
  const packageName = extractPackageName(options.goPackage);
  
  const lines: string[] = [
    `package ${packageName}`,
    '',
    'import (',
    '	"time"',
    ')',
    '',
    `// ${domainName} domain types`,
    '',
  ];
  
  // Generate structs for entities
  for (const entity of domain.entities) {
    lines.push(generateGoStruct(entity));
    lines.push('');
  }
  
  return lines.join('\n');
}

function generateGoStruct(entity: Entity): string {
  const structName = toPascalCase(entity.name.name);
  const lines: string[] = [];
  
  lines.push(`// ${structName} represents the ${entity.name.name} entity`);
  lines.push(`type ${structName} struct {`);
  
  for (const field of entity.fields) {
    const fieldName = toPascalCase(field.name.name);
    const goType = islTypeToGo(field.type);
    const jsonTag = toSnakeCase(field.name.name);
    const tags = `\`json:"${jsonTag}${field.optional ? ',omitempty' : ''}"\``;
    lines.push(`	${fieldName} ${goType} ${tags}`);
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

function islTypeToGo(type: { kind: string; name?: string | { parts?: Array<{ name: string }> }; element?: unknown; inner?: unknown; key?: unknown; value?: unknown }): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String':
        case 'UUID':
          return 'string';
        case 'Int':
          return 'int64';
        case 'Decimal':
          return 'float64';
        case 'Boolean':
          return 'bool';
        case 'Timestamp':
          return 'time.Time';
        case 'Duration':
          return 'time.Duration';
        default:
          return 'interface{}';
      }
    case 'ReferenceType':
      if (typeof type.name === 'object' && type.name?.parts) {
        return '*' + type.name.parts.map(p => toPascalCase(p.name)).join('');
      }
      return 'interface{}';
    case 'ListType':
      return `[]${islTypeToGo(type.element as { kind: string })}`;
    case 'OptionalType':
      return `*${islTypeToGo(type.inner as { kind: string })}`;
    case 'MapType':
      return `map[${islTypeToGo(type.key as { kind: string })}]${islTypeToGo(type.value as { kind: string })}`;
    default:
      return 'interface{}';
  }
}

// ==========================================================================
// HELPERS
// ==========================================================================

function extractPackageName(goPackage: string): string {
  const parts = goPackage.split('/');
  return parts[parts.length - 1];
}
