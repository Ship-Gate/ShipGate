// ============================================================================
// Custom Proto Options Generation
// ============================================================================

import type { Behavior, SecuritySpec } from '../types';
// toPascalCase and toSnakeCase removed - not currently used

// ==========================================================================
// CUSTOM OPTIONS
// ==========================================================================

export interface CustomProtoOptions {
  /** Generate custom options for ISL metadata */
  generateIslOptions?: boolean;
  /** Generate audit options */
  generateAuditOptions?: boolean;
  /** Generate security options */
  generateSecurityOptions?: boolean;
  /** Extension number range start */
  extensionStart?: number;
}

// ==========================================================================
// OPTIONS FILE GENERATOR
// ==========================================================================

/**
 * Generate custom options proto file
 */
export function generateProtoOptions(options: CustomProtoOptions = {}): string {
  const extensionStart = options.extensionStart ?? 50000;
  let currentExt = extensionStart;
  
  const lines: string[] = [
    'syntax = "proto3";',
    '',
    'package isl.options;',
    '',
    'import "google/protobuf/descriptor.proto";',
    '',
  ];
  
  // ISL behavior options
  if (options.generateIslOptions) {
    lines.push('// ISL Behavior metadata options');
    lines.push('extend google.protobuf.MethodOptions {');
    lines.push(`  IslBehaviorOptions isl_behavior = ${currentExt++};`);
    lines.push('}');
    lines.push('');
    lines.push('message IslBehaviorOptions {');
    lines.push('  string behavior_name = 1;');
    lines.push('  string description = 2;');
    lines.push('  repeated string preconditions = 3;');
    lines.push('  repeated string postconditions = 4;');
    lines.push('  repeated string invariants = 5;');
    lines.push('}');
    lines.push('');
  }
  
  // Audit options
  if (options.generateAuditOptions) {
    lines.push('// Audit trail options');
    lines.push('extend google.protobuf.MethodOptions {');
    lines.push(`  AuditOptions audit = ${currentExt++};`);
    lines.push('}');
    lines.push('');
    lines.push('message AuditOptions {');
    lines.push('  bool enabled = 1;');
    lines.push('  string log_level = 2;');
    lines.push('  repeated string include_fields = 3;');
    lines.push('  repeated string exclude_fields = 4;');
    lines.push('}');
    lines.push('');
  }
  
  // Security options
  if (options.generateSecurityOptions) {
    lines.push('// Security options');
    lines.push('extend google.protobuf.MethodOptions {');
    lines.push(`  SecurityOptions security = ${currentExt++};`);
    lines.push('}');
    lines.push('');
    lines.push('message SecurityOptions {');
    lines.push('  bool requires_authentication = 1;');
    lines.push('  repeated string required_permissions = 2;');
    lines.push('  RateLimitConfig rate_limit = 3;');
    lines.push('}');
    lines.push('');
    lines.push('message RateLimitConfig {');
    lines.push('  int32 requests_per_minute = 1;');
    lines.push('  string key = 2;  // e.g., "user_id", "ip_address"');
    lines.push('}');
    lines.push('');
    
    // Field-level security
    lines.push('// Field-level security options');
    lines.push('extend google.protobuf.FieldOptions {');
    lines.push(`  FieldSecurityOptions field_security = ${currentExt++};`);
    lines.push('}');
    lines.push('');
    lines.push('message FieldSecurityOptions {');
    lines.push('  bool sensitive = 1;');
    lines.push('  bool pii = 2;');
    lines.push('  bool encrypted = 3;');
    lines.push('  string mask_pattern = 4;');
    lines.push('}');
    lines.push('');
  }
  
  return lines.join('\n');
}

// ==========================================================================
// BUF.YAML GENERATOR
// ==========================================================================

export interface BufYamlOptions {
  /** Organization name for buf.build */
  organization: string;
  /** Module name */
  moduleName: string;
  /** Additional dependencies */
  deps?: string[];
  /** Breaking change rules */
  breakingRules?: string[];
  /** Lint rules */
  lintRules?: string[];
  /** Disable lint rules */
  disableLintRules?: string[];
}

/**
 * Generate buf.yaml configuration
 */
export function generateBufYaml(options: BufYamlOptions): string {
  const lines: string[] = [
    'version: v1',
    `name: buf.build/${options.organization}/${options.moduleName}`,
  ];
  
  // Dependencies
  const deps = [
    'buf.build/envoyproxy/protoc-gen-validate',
    ...(options.deps ?? []),
  ];
  
  lines.push('deps:');
  for (const dep of deps) {
    lines.push(`  - ${dep}`);
  }
  
  // Breaking change detection
  lines.push('breaking:');
  lines.push('  use:');
  for (const rule of options.breakingRules ?? ['FILE']) {
    lines.push(`    - ${rule}`);
  }
  
  // Linting
  lines.push('lint:');
  lines.push('  use:');
  for (const rule of options.lintRules ?? ['DEFAULT']) {
    lines.push(`    - ${rule}`);
  }
  
  if (options.disableLintRules && options.disableLintRules.length > 0) {
    lines.push('  except:');
    for (const rule of options.disableLintRules) {
      lines.push(`    - ${rule}`);
    }
  }
  
  return lines.join('\n');
}

// ==========================================================================
// BUF.GEN.YAML GENERATOR
// ==========================================================================

export interface BufGenYamlOptions {
  /** Include Go generation */
  includeGo?: boolean;
  /** Go module path */
  goModule?: string;
  /** Include TypeScript generation */
  includeTypeScript?: boolean;
  /** TypeScript output path */
  tsOutPath?: string;
  /** Include Connect-RPC */
  includeConnect?: boolean;
  /** Include gRPC-Web */
  includeGrpcWeb?: boolean;
  /** Include validation */
  includeValidation?: boolean;
}

/**
 * Generate buf.gen.yaml configuration
 */
export function generateBufGenYaml(options: BufGenYamlOptions): string {
  const lines: string[] = [
    'version: v1',
    'plugins:',
  ];
  
  // Go generation
  if (options.includeGo) {
    lines.push('  - plugin: buf.build/protocolbuffers/go');
    lines.push(`    out: ${options.goModule ?? 'gen/go'}`);
    lines.push('    opt: paths=source_relative');
    lines.push('');
    lines.push('  - plugin: buf.build/grpc/go');
    lines.push(`    out: ${options.goModule ?? 'gen/go'}`);
    lines.push('    opt: paths=source_relative');
    
    if (options.includeValidation) {
      lines.push('');
      lines.push('  - plugin: buf.build/envoyproxy/protoc-gen-validate');
      lines.push(`    out: ${options.goModule ?? 'gen/go'}`);
      lines.push('    opt:');
      lines.push('      - paths=source_relative');
      lines.push('      - lang=go');
    }
  }
  
  // TypeScript generation
  if (options.includeTypeScript) {
    const tsOut = options.tsOutPath ?? 'gen/ts';
    
    if (options.includeConnect) {
      lines.push('');
      lines.push('  - plugin: buf.build/connectrpc/es');
      lines.push(`    out: ${tsOut}`);
      lines.push('    opt: target=ts');
      lines.push('');
      lines.push('  - plugin: buf.build/bufbuild/es');
      lines.push(`    out: ${tsOut}`);
      lines.push('    opt: target=ts');
    } else {
      lines.push('');
      lines.push('  - plugin: buf.build/protocolbuffers/es');
      lines.push(`    out: ${tsOut}`);
      lines.push('    opt: target=ts');
    }
    
    if (options.includeGrpcWeb) {
      lines.push('');
      lines.push('  - plugin: buf.build/grpc/web');
      lines.push(`    out: ${tsOut}`);
      lines.push('    opt:');
      lines.push('      - import_style=typescript');
      lines.push('      - mode=grpcwebtext');
    }
  }
  
  return lines.join('\n');
}

// ==========================================================================
// METHOD OPTIONS GENERATOR
// ==========================================================================

/**
 * Generate method options from ISL behavior
 */
export function generateMethodOptions(
  behavior: Behavior,
  options: CustomProtoOptions = {}
): string[] {
  const methodOptions: string[] = [];
  
  // ISL behavior metadata
  if (options.generateIslOptions) {
    methodOptions.push('option (isl.options.isl_behavior) = {');
    methodOptions.push(`  behavior_name: "${behavior.name.name}"`);
    if (behavior.description) {
      methodOptions.push(`  description: "${behavior.description.value}"`);
    }
    methodOptions.push('};');
  }
  
  // Security options
  if (options.generateSecurityOptions && behavior.security && behavior.security.requirements.length > 0) {
    const securityOpts = extractSecurityOptions(behavior.security.requirements);
    if (securityOpts) {
      methodOptions.push('option (isl.options.security) = {');
      methodOptions.push(`  requires_authentication: ${securityOpts.requiresAuth}`);
      if (securityOpts.rateLimit) {
        methodOptions.push('  rate_limit: {');
        methodOptions.push(`    requests_per_minute: ${securityOpts.rateLimit.rpm}`);
        methodOptions.push(`    key: "${securityOpts.rateLimit.key}"`);
        methodOptions.push('  }');
      }
      methodOptions.push('};');
    }
  }
  
  // Audit options - based on behavior having security requirements
  // (observability is not part of BehaviorDeclaration)
  if (options.generateAuditOptions) {
    methodOptions.push('option (isl.options.audit) = {');
    methodOptions.push('  enabled: true');
    methodOptions.push('};');
  }
  
  return methodOptions;
}

interface SecurityOptions {
  requiresAuth: boolean;
  rateLimit?: {
    rpm: number;
    key: string;
  };
}

function extractSecurityOptions(specs: SecuritySpec[]): SecurityOptions | null {
  let requiresAuth = false;
  let rateLimit: { rpm: number; key: string } | undefined;
  
  for (const spec of specs) {
    if (spec.type === 'requires') {
      requiresAuth = true;
    } else if (spec.type === 'rate_limit') {
      // Parse rate limit expression
      // This is a simplified extraction
      rateLimit = { rpm: 100, key: 'user_id' };
    }
  }
  
  if (!requiresAuth && !rateLimit) return null;
  return { requiresAuth, rateLimit };
}
