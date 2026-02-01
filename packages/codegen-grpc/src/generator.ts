// ============================================================================
// Main gRPC/Proto Generator
// ============================================================================

import type { Domain } from '@intentos/isl-core';
import { generateProtoTypes, collectTypeImports } from './proto/types';
import { generateProtoMessages } from './proto/messages';
import { generateProtoServices, generateCrudService } from './proto/services';
import { generateProtoOptions, generateBufYaml, generateBufGenYaml } from './proto/options';
import { generateTypeScriptStubs } from './grpc/typescript';
import { generateGoStubs } from './grpc/go';
import { generateConnectTypeScript } from './connect/typescript';
import { toProtoPackage, protoFileHeader } from './utils';

// ==========================================================================
// TYPES
// ==========================================================================

export interface GenerateOptions {
  /** Proto package name (e.g., "domain.users.v1") */
  package: string;
  /** Include protoc-gen-validate validation rules */
  includeValidation?: boolean;
  /** Include Connect-RPC TypeScript generation */
  includeConnect?: boolean;
  /** Go package path for option go_package */
  goPackage?: string;
  /** Generate Go client/server stubs */
  generateGo?: boolean;
  /** Generate TypeScript client/server stubs */
  generateTypeScript?: boolean;
  /** Generate streaming RPCs */
  generateStreaming?: boolean;
  /** Generate CRUD services for entities */
  generateCrud?: boolean;
  /** Buf.build organization name */
  bufOrganization?: string;
  /** Buf.build module name */
  bufModule?: string;
  /** Custom options generation */
  customOptions?: {
    generateIslOptions?: boolean;
    generateAuditOptions?: boolean;
    generateSecurityOptions?: boolean;
  };
}

export interface GeneratedFile {
  /** Relative file path */
  path: string;
  /** File contents */
  content: string;
  /** File type for categorization */
  type: 'proto' | 'yaml' | 'typescript' | 'go';
}

// ==========================================================================
// MAIN GENERATOR
// ==========================================================================

/**
 * Generate Protocol Buffers and gRPC files from an ISL domain
 */
export function generate(domain: Domain, options: GenerateOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const domainName = domain.name.name;
  const protoPackage = options.package || toProtoPackage(domainName, domain.version?.value);
  
  // Collect all imports
  const allImports = new Set<string>();
  
  // Generate types
  const protoTypes = generateProtoTypes(domain.types, {
    includeValidation: options.includeValidation,
  });
  
  collectTypeImports(protoTypes).forEach(i => allImports.add(i));
  
  // Generate entity messages
  const entityMessages = generateProtoMessages(domain.entities, {
    includeValidation: options.includeValidation,
    generateLifecycleEnums: true,
    generateFieldMasks: true,
    addJsonNames: true,
  });
  
  for (const msg of entityMessages) {
    msg.imports.forEach(i => allImports.add(i));
  }
  
  // Generate services from behaviors
  const services = generateProtoServices(domain.behaviors, domain.entities, {
    includeValidation: options.includeValidation,
    generateStreaming: options.generateStreaming,
    addIdempotencyOptions: true,
    generateErrorMessages: true,
  });
  
  for (const svc of services) {
    svc.imports.forEach(i => allImports.add(i));
  }
  
  // Generate CRUD services if requested
  const crudServices: ReturnType<typeof generateCrudService>[] = [];
  if (options.generateCrud) {
    for (const entity of domain.entities) {
      const crudSvc = generateCrudService(entity, {
        includeValidation: options.includeValidation,
        generateStreaming: options.generateStreaming,
      });
      crudSvc.imports.forEach(i => allImports.add(i));
      crudServices.push(crudSvc);
    }
  }
  
  // Add validation import if needed
  if (options.includeValidation) {
    allImports.add('validate/validate.proto');
  }
  
  // Build main proto file
  const mainProto = buildMainProtoFile({
    package: protoPackage,
    goPackage: options.goPackage,
    imports: Array.from(allImports),
    types: protoTypes,
    messages: entityMessages,
    services: services.length > 0 ? services : crudServices,
  });
  
  const protoFileName = `${domainName.toLowerCase()}.proto`;
  files.push({
    path: protoFileName,
    content: mainProto,
    type: 'proto',
  });
  
  // Generate custom options proto if requested
  if (options.customOptions) {
    const optionsProto = generateProtoOptions(options.customOptions);
    files.push({
      path: 'isl_options.proto',
      content: optionsProto,
      type: 'proto',
    });
  }
  
  // Generate buf.yaml
  if (options.bufOrganization) {
    const bufYaml = generateBufYaml({
      organization: options.bufOrganization,
      moduleName: options.bufModule ?? domainName.toLowerCase(),
    });
    files.push({
      path: 'buf.yaml',
      content: bufYaml,
      type: 'yaml',
    });
    
    // Generate buf.gen.yaml
    const bufGenYaml = generateBufGenYaml({
      includeGo: options.generateGo,
      goModule: options.goPackage,
      includeTypeScript: options.generateTypeScript || options.includeConnect,
      includeConnect: options.includeConnect,
      includeValidation: options.includeValidation,
    });
    files.push({
      path: 'buf.gen.yaml',
      content: bufGenYaml,
      type: 'yaml',
    });
  }
  
  // Generate TypeScript stubs
  if (options.generateTypeScript) {
    const tsFiles = generateTypeScriptStubs(domain, {
      protoPackage,
      includeValidation: options.includeValidation,
      generateClient: true,
      generateServer: true,
    });
    files.push(...tsFiles);
  }
  
  // Generate Connect-RPC TypeScript
  if (options.includeConnect) {
    const connectFiles = generateConnectTypeScript(domain, {
      protoPackage,
      outputPath: 'gen/connect',
    });
    files.push(...connectFiles);
  }
  
  // Generate Go stubs
  if (options.generateGo && options.goPackage) {
    const goFiles = generateGoStubs(domain, {
      goPackage: options.goPackage,
      protoPackage,
      generateClient: true,
      generateServer: true,
    });
    files.push(...goFiles);
  }
  
  return files;
}

// ==========================================================================
// PROTO FILE BUILDER
// ==========================================================================

interface ProtoFileParts {
  package: string;
  goPackage?: string;
  imports: string[];
  types: Array<{ name: string; definition: string }>;
  messages: Array<{ name: string; definition: string }>;
  services: Array<{ name: string; definition: string }>;
}

function buildMainProtoFile(parts: ProtoFileParts): string {
  const sections: string[] = [];
  
  // Header
  sections.push(protoFileHeader({
    package: parts.package,
    goPackage: parts.goPackage,
    imports: parts.imports,
  }));
  
  // Types (enums, wrapper messages)
  if (parts.types.length > 0) {
    sections.push('');
    sections.push('// ==========================================================================');
    sections.push('// Types');
    sections.push('// ==========================================================================');
    for (const type of parts.types) {
      sections.push('');
      sections.push(type.definition);
    }
  }
  
  // Entity messages
  if (parts.messages.length > 0) {
    sections.push('');
    sections.push('// ==========================================================================');
    sections.push('// Entities');
    sections.push('// ==========================================================================');
    for (const msg of parts.messages) {
      sections.push('');
      sections.push(msg.definition);
    }
  }
  
  // Services
  if (parts.services.length > 0) {
    sections.push('');
    sections.push('// ==========================================================================');
    sections.push('// Services');
    sections.push('// ==========================================================================');
    for (const svc of parts.services) {
      sections.push('');
      sections.push(svc.definition);
    }
  }
  
  return sections.join('\n');
}

// ==========================================================================
// CONVENIENCE FUNCTIONS
// ==========================================================================

/**
 * Generate only the .proto file content
 */
export function generateProtoOnly(domain: Domain, options: GenerateOptions): string {
  const files = generate(domain, {
    ...options,
    generateGo: false,
    generateTypeScript: false,
    includeConnect: false,
  });
  
  const protoFile = files.find(f => f.type === 'proto' && f.path.endsWith('.proto'));
  return protoFile?.content ?? '';
}

/**
 * Generate proto with validation rules
 */
export function generateValidatedProto(domain: Domain, packageName: string): string {
  return generateProtoOnly(domain, {
    package: packageName,
    includeValidation: true,
    generateCrud: true,
    generateStreaming: true,
  });
}

/**
 * Generate complete buf.build project
 */
export function generateBufProject(
  domain: Domain,
  organization: string,
  moduleName: string,
  options: Partial<GenerateOptions> = {}
): GeneratedFile[] {
  return generate(domain, {
    package: `${organization}.${moduleName}.v1`,
    bufOrganization: organization,
    bufModule: moduleName,
    includeValidation: true,
    generateCrud: true,
    generateStreaming: true,
    generateTypeScript: true,
    includeConnect: true,
    generateGo: true,
    goPackage: `github.com/${organization}/${moduleName}/gen/go`,
    ...options,
  });
}
