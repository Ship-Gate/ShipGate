// ============================================================================
// ISL MCP Server - Translator Tools
// ============================================================================

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { parse, type Domain, type Expression, type TypeDefinition } from '@isl-lang/parser';
import {
  type TranslateInput,
  type TranslateResult,
  type ValidateASTInput,
  type ValidateASTResult,
  type RepairASTInput,
  type RepairASTResult,
  type PrintInput,
  type PrintResult,
  type ValidationIssue,
  type Repair,
  TRANSLATOR_TOOL_SCHEMAS,
} from './translator-tool-types.js';

// ============================================================================
// Tool Registration
// ============================================================================

/**
 * Register translator tools with the MCP server.
 * 
 * Tools registered:
 * - isl_translate: Translate ISL source to different formats
 * - isl_validate_ast: Validate AST structure
 * - isl_repair_ast: Repair malformed AST
 * - isl_print: Pretty print AST back to ISL source
 */
export function registerTranslatorTools(server: Server): void {
  // Store existing handlers to chain them
  const existingToolsHandler = getExistingHandler(server, 'tools/list');
  const existingCallHandler = getExistingHandler(server, 'tools/call');

  // Register tools list handler
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    // Get existing tools if there's an existing handler
    let existingTools: Array<{ name: string; description: string; inputSchema: unknown }> = [];
    if (existingToolsHandler) {
      try {
        const result = await existingToolsHandler(request);
        existingTools = (result as { tools?: Array<{ name: string; description: string; inputSchema: unknown }> })?.tools ?? [];
      } catch {
        // Ignore errors from existing handler
      }
    }

    // Add translator tools
    const translatorTools = Object.values(TRANSLATOR_TOOL_SCHEMAS);

    return {
      tools: [...existingTools, ...translatorTools],
    };
  });

  // Register call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Handle translator tools
    switch (name) {
      case 'isl_translate':
        return formatMCPResponse(await handleTranslate(args as unknown as TranslateInput));
      
      case 'isl_validate_ast':
        return formatMCPResponse(await handleValidateAST(args as unknown as ValidateASTInput));
      
      case 'isl_repair_ast':
        return formatMCPResponse(await handleRepairAST(args as unknown as RepairASTInput));
      
      case 'isl_print':
        return formatMCPResponse(await handlePrint(args as unknown as PrintInput));
    }

    // If not a translator tool, try existing handler
    if (existingCallHandler) {
      return existingCallHandler(request) as unknown as ReturnType<typeof formatMCPResponse>;
    }

    throw new Error(`Unknown tool: ${name}`);
  });
}

// ============================================================================
// Helper: Get Existing Handler
// ============================================================================

function getExistingHandler(_server: Server, _method: string): ((request: unknown) => Promise<unknown>) | undefined {
  // MCP SDK doesn't expose existing handlers, so we return undefined
  // In practice, tools should be registered before this module
  return undefined;
}

// ============================================================================
// Helper: Format MCP Response
// ============================================================================

function formatMCPResponse(result: TranslateResult | ValidateASTResult | RepairASTResult | PrintResult) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

// ============================================================================
// Tool: isl_translate
// ============================================================================

async function handleTranslate(input: TranslateInput): Promise<TranslateResult> {
  const startTime = Date.now();
  
  try {
    const { source, format, includeLocations = false, pretty = true } = input;
    
    // Parse the ISL source
    const parseResult = parse(source);
    
    if (!parseResult.success || !parseResult.domain) {
      return {
        success: false,
        error: 'Failed to parse ISL source',
        errors: parseResult.errors?.map(e => ({
          code: e.code,
          message: e.message,
          location: e.location,
        })) ?? [],
        metadata: {
          processingTimeMs: Date.now() - startTime,
          inputSize: source.length,
        },
      };
    }
    
    const domain = parseResult.domain;
    let output: string;
    
    switch (format) {
      case 'ast':
      case 'json':
        output = formatAST(domain, { includeLocations, pretty });
        break;
      
      case 'yaml':
        output = formatYAML(domain, { includeLocations, pretty });
        break;
      
      case 'compact':
        output = formatCompact(domain);
        break;
      
      default:
        return {
          success: false,
          error: `Unknown format: ${format}`,
          metadata: {
            processingTimeMs: Date.now() - startTime,
            inputSize: source.length,
          },
        };
    }
    
    return {
      success: true,
      data: {
        format,
        output,
        domain: domain.name.name,
        summary: {
          name: domain.name.name,
          version: domain.version.value,
          entityCount: domain.entities.length,
          behaviorCount: domain.behaviors.length,
          typeCount: domain.types.length,
          entities: domain.entities.map(e => e.name.name),
          behaviors: domain.behaviors.map(b => b.name.name),
        },
      },
      metadata: {
        processingTimeMs: Date.now() - startTime,
        inputSize: source.length,
        outputSize: output.length,
        nodeCount: countNodes(domain),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during translation',
      metadata: {
        processingTimeMs: Date.now() - startTime,
        inputSize: input.source?.length ?? 0,
      },
    };
  }
}

// ============================================================================
// Tool: isl_validate_ast
// ============================================================================

async function handleValidateAST(input: ValidateASTInput): Promise<ValidateASTResult> {
  const startTime = Date.now();
  
  try {
    const { ast, strict = false, nodeKinds } = input;
    
    // Parse the AST JSON
    let astObj: unknown;
    try {
      astObj = JSON.parse(ast);
    } catch (e) {
      return {
        success: false,
        error: 'Invalid JSON in AST input',
        errors: [{
          code: 'V001',
          message: `JSON parse error: ${e instanceof Error ? e.message : 'unknown'}`,
        }],
        metadata: {
          processingTimeMs: Date.now() - startTime,
          inputSize: ast.length,
        },
      };
    }
    
    // Validate the AST structure
    const issues: ValidationIssue[] = [];
    const nodeTypes: Record<string, number> = {};
    let nodeCount = 0;
    let maxDepth = 0;
    
    function validateNode(node: unknown, path: string[], depth: number): void {
      if (!node || typeof node !== 'object') return;
      
      maxDepth = Math.max(maxDepth, depth);
      nodeCount++;
      
      const n = node as Record<string, unknown>;
      
      // Check for kind field
      if (!('kind' in n) || typeof n.kind !== 'string') {
        issues.push({
          severity: 'error',
          code: 'V002',
          message: 'Node missing "kind" field',
          path,
        });
        return;
      }
      
      const kind = n.kind as string;
      nodeTypes[kind] = (nodeTypes[kind] ?? 0) + 1;
      
      // Skip if filtering by node kinds
      if (nodeKinds && nodeKinds.length > 0 && !nodeKinds.includes(kind)) {
        return;
      }
      
      // Validate based on node kind
      const validation = NODE_VALIDATORS[kind];
      if (validation) {
        const nodeIssues = validation(n, path, strict);
        issues.push(...nodeIssues);
      } else if (strict) {
        issues.push({
          severity: 'warning',
          code: 'V003',
          message: `Unknown node kind: ${kind}`,
          path,
        });
      }
      
      // Recursively validate children
      for (const [key, value] of Object.entries(n)) {
        if (key === 'kind' || key === 'location') continue;
        
        if (Array.isArray(value)) {
          value.forEach((item, i) => {
            if (item && typeof item === 'object') {
              validateNode(item, [...path, key, String(i)], depth + 1);
            }
          });
        } else if (value && typeof value === 'object') {
          validateNode(value, [...path, key], depth + 1);
        }
      }
    }
    
    validateNode(astObj, [], 0);
    
    const rootKind = (astObj as Record<string, unknown>)?.kind as string ?? 'unknown';
    const valid = issues.filter(i => i.severity === 'error').length === 0;
    
    return {
      success: true,
      data: {
        valid,
        nodeCount,
        issues,
        structure: {
          rootKind,
          depth: maxDepth,
          nodeTypes,
        },
      },
      metadata: {
        processingTimeMs: Date.now() - startTime,
        inputSize: ast.length,
        nodeCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during validation',
      metadata: {
        processingTimeMs: Date.now() - startTime,
        inputSize: input.ast?.length ?? 0,
      },
    };
  }
}

// ============================================================================
// Tool: isl_repair_ast
// ============================================================================

async function handleRepairAST(input: RepairASTInput): Promise<RepairASTResult> {
  const startTime = Date.now();
  
  try {
    const { ast, strategy = 'auto', maxIterations = 10 } = input;
    
    // Parse the AST JSON
    let astObj: unknown;
    try {
      astObj = JSON.parse(ast);
    } catch (e) {
      return {
        success: false,
        error: 'Invalid JSON in AST input',
        errors: [{
          code: 'R001',
          message: `JSON parse error: ${e instanceof Error ? e.message : 'unknown'}`,
        }],
        metadata: {
          processingTimeMs: Date.now() - startTime,
          inputSize: ast.length,
        },
      };
    }
    
    const repairs: Repair[] = [];
    let iterations = 0;
    let hasChanges = true;
    
    // Iteratively repair until no more changes or max iterations
    while (hasChanges && iterations < maxIterations) {
      hasChanges = false;
      iterations++;
      
      const iterationRepairs = repairNode(astObj, [], strategy);
      if (iterationRepairs.length > 0) {
        repairs.push(...iterationRepairs);
        hasChanges = true;
      }
    }
    
    // Validate the repaired AST
    const validationResult = await handleValidateAST({ ast: JSON.stringify(astObj), strict: false });
    const remainingIssues = validationResult.data?.issues ?? [];
    
    return {
      success: true,
      data: {
        repaired: repairs.length > 0,
        repairedAST: JSON.stringify(astObj, null, 2),
        repairs,
        remainingIssues,
      },
      metadata: {
        processingTimeMs: Date.now() - startTime,
        inputSize: ast.length,
        outputSize: JSON.stringify(astObj).length,
        repairCount: repairs.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during repair',
      metadata: {
        processingTimeMs: Date.now() - startTime,
        inputSize: input.ast?.length ?? 0,
      },
    };
  }
}

// ============================================================================
// Tool: isl_print
// ============================================================================

async function handlePrint(input: PrintInput): Promise<PrintResult> {
  const startTime = Date.now();
  
  try {
    const { ast, indent = 2, preserveComments = false, style = 'standard' } = input;
    
    // Parse the AST JSON
    let astObj: unknown;
    try {
      astObj = JSON.parse(ast);
    } catch (e) {
      return {
        success: false,
        error: 'Invalid JSON in AST input',
        errors: [{
          code: 'P001',
          message: `JSON parse error: ${e instanceof Error ? e.message : 'unknown'}`,
        }],
        metadata: {
          processingTimeMs: Date.now() - startTime,
          inputSize: ast.length,
        },
      };
    }
    
    // Check if it's a Domain
    if ((astObj as Record<string, unknown>)?.kind !== 'Domain') {
      return {
        success: false,
        error: 'AST root must be a Domain node',
        metadata: {
          processingTimeMs: Date.now() - startTime,
          inputSize: ast.length,
        },
      };
    }
    
    const domain = astObj as Domain;
    const source = printDomain(domain, { indent, style, preserveComments });
    
    return {
      success: true,
      data: {
        source,
        lineCount: source.split('\n').length,
        characterCount: source.length,
      },
      metadata: {
        processingTimeMs: Date.now() - startTime,
        inputSize: ast.length,
        outputSize: source.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during printing',
      metadata: {
        processingTimeMs: Date.now() - startTime,
        inputSize: input.ast?.length ?? 0,
      },
    };
  }
}

// ============================================================================
// Format Helpers
// ============================================================================

function formatAST(
  domain: Domain,
  options: { includeLocations: boolean; pretty: boolean }
): string {
  const ast = options.includeLocations ? domain : stripLocations(domain);
  return options.pretty ? JSON.stringify(ast, null, 2) : JSON.stringify(ast);
}

function formatYAML(
  domain: Domain,
  options: { includeLocations: boolean; pretty: boolean }
): string {
  const ast = options.includeLocations ? domain : stripLocations(domain);
  return toYAML(ast, options.pretty ? 0 : -1);
}

function formatCompact(domain: Domain): string {
  const lines: string[] = [];
  
  lines.push(`domain: ${domain.name.name} v${domain.version.value}`);
  
  if (domain.entities.length > 0) {
    lines.push(`entities: [${domain.entities.map(e => e.name.name).join(', ')}]`);
  }
  
  if (domain.behaviors.length > 0) {
    lines.push(`behaviors: [${domain.behaviors.map(b => b.name.name).join(', ')}]`);
  }
  
  if (domain.types.length > 0) {
    lines.push(`types: [${domain.types.map(t => t.name.name).join(', ')}]`);
  }
  
  return lines.join('\n');
}

function stripLocations(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(stripLocations);
  }
  
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key === 'location') continue;
    result[key] = stripLocations(value);
  }
  return result;
}

function toYAML(obj: unknown, indent: number): string {
  const prefix = indent >= 0 ? '  '.repeat(indent) : '';
  const newline = indent >= 0 ? '\n' : '';
  
  if (obj === null) return 'null';
  if (obj === undefined) return 'null';
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  if (typeof obj === 'number') return String(obj);
  if (typeof obj === 'string') {
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#')) {
      return `"${obj.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const items = obj.map(item => {
      const itemYaml = toYAML(item, indent >= 0 ? indent + 1 : -1);
      return `${prefix}- ${itemYaml.trimStart()}`;
    });
    return newline + items.join(newline);
  }
  
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([key, value]) => {
      const valueYaml = toYAML(value, indent >= 0 ? indent + 1 : -1);
      const valueStr = valueYaml.startsWith('\n') ? valueYaml : ` ${valueYaml}`;
      return `${prefix}${key}:${valueStr}`;
    });
    return newline + lines.join(newline);
  }
  
  return String(obj);
}

function countNodes(obj: unknown): number {
  if (!obj || typeof obj !== 'object') return 0;
  
  let count = 0;
  if ('kind' in (obj as Record<string, unknown>)) count++;
  
  for (const value of Object.values(obj as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        count += countNodes(item);
      }
    } else if (value && typeof value === 'object') {
      count += countNodes(value);
    }
  }
  
  return count;
}

// ============================================================================
// Validation Helpers
// ============================================================================

type NodeValidator = (
  node: Record<string, unknown>,
  path: string[],
  strict: boolean
) => ValidationIssue[];

const NODE_VALIDATORS: Record<string, NodeValidator> = {
  Domain: (node, path, strict) => {
    const issues: ValidationIssue[] = [];
    
    if (!node.name) {
      issues.push({
        severity: 'error',
        code: 'V010',
        message: 'Domain missing "name" field',
        path,
        expected: 'Identifier',
      });
    }
    
    if (!node.version) {
      issues.push({
        severity: 'error',
        code: 'V011',
        message: 'Domain missing "version" field',
        path,
        expected: 'StringLiteral',
      });
    }
    
    if (strict && !Array.isArray(node.entities)) {
      issues.push({
        severity: 'warning',
        code: 'V012',
        message: 'Domain should have "entities" array',
        path,
      });
    }
    
    return issues;
  },
  
  Entity: (node, path, _strict) => {
    const issues: ValidationIssue[] = [];
    
    if (!node.name) {
      issues.push({
        severity: 'error',
        code: 'V020',
        message: 'Entity missing "name" field',
        path,
        expected: 'Identifier',
      });
    }
    
    if (!Array.isArray(node.fields)) {
      issues.push({
        severity: 'error',
        code: 'V021',
        message: 'Entity missing "fields" array',
        path,
      });
    }
    
    return issues;
  },
  
  Behavior: (node, path, _strict) => {
    const issues: ValidationIssue[] = [];
    
    if (!node.name) {
      issues.push({
        severity: 'error',
        code: 'V030',
        message: 'Behavior missing "name" field',
        path,
        expected: 'Identifier',
      });
    }
    
    return issues;
  },
  
  Identifier: (node, path, _strict) => {
    const issues: ValidationIssue[] = [];
    
    if (typeof node.name !== 'string') {
      issues.push({
        severity: 'error',
        code: 'V040',
        message: 'Identifier missing "name" string field',
        path,
      });
    }
    
    return issues;
  },
  
  StringLiteral: (node, path, _strict) => {
    const issues: ValidationIssue[] = [];
    
    if (typeof node.value !== 'string') {
      issues.push({
        severity: 'error',
        code: 'V041',
        message: 'StringLiteral missing "value" string field',
        path,
      });
    }
    
    return issues;
  },
  
  Field: (node, path, _strict) => {
    const issues: ValidationIssue[] = [];
    
    if (!node.name) {
      issues.push({
        severity: 'error',
        code: 'V050',
        message: 'Field missing "name" field',
        path,
      });
    }
    
    if (!node.type) {
      issues.push({
        severity: 'error',
        code: 'V051',
        message: 'Field missing "type" field',
        path,
      });
    }
    
    return issues;
  },
};

// ============================================================================
// Repair Helpers
// ============================================================================

function repairNode(
  node: unknown,
  path: string[],
  strategy: 'minimal' | 'aggressive' | 'auto'
): Repair[] {
  if (!node || typeof node !== 'object') return [];
  
  const repairs: Repair[] = [];
  const n = node as Record<string, unknown>;
  
  // Ensure kind field exists
  if (!('kind' in n) || typeof n.kind !== 'string') {
    n.kind = 'Unknown';
    repairs.push({
      type: 'added',
      path,
      description: 'Added missing "kind" field',
      after: 'Unknown',
    });
  }
  
  const kind = n.kind as string;
  
  // Apply kind-specific repairs
  switch (kind) {
    case 'Domain':
      if (!n.name) {
        n.name = { kind: 'Identifier', name: 'UnnamedDomain', location: createDefaultLocation() };
        repairs.push({ type: 'added', path: [...path, 'name'], description: 'Added default domain name' });
      }
      if (!n.version) {
        n.version = { kind: 'StringLiteral', value: '1.0.0', location: createDefaultLocation() };
        repairs.push({ type: 'added', path: [...path, 'version'], description: 'Added default version' });
      }
      if (!Array.isArray(n.entities)) {
        n.entities = [];
        repairs.push({ type: 'added', path: [...path, 'entities'], description: 'Added entities array' });
      }
      if (!Array.isArray(n.behaviors)) {
        n.behaviors = [];
        repairs.push({ type: 'added', path: [...path, 'behaviors'], description: 'Added behaviors array' });
      }
      if (!Array.isArray(n.types)) {
        n.types = [];
        repairs.push({ type: 'added', path: [...path, 'types'], description: 'Added types array' });
      }
      if (!Array.isArray(n.imports)) {
        n.imports = [];
        repairs.push({ type: 'added', path: [...path, 'imports'], description: 'Added imports array' });
      }
      if (!Array.isArray(n.invariants)) {
        n.invariants = [];
        repairs.push({ type: 'added', path: [...path, 'invariants'], description: 'Added invariants array' });
      }
      if (!Array.isArray(n.policies)) {
        n.policies = [];
        repairs.push({ type: 'added', path: [...path, 'policies'], description: 'Added policies array' });
      }
      if (!Array.isArray(n.views)) {
        n.views = [];
        repairs.push({ type: 'added', path: [...path, 'views'], description: 'Added views array' });
      }
      if (!Array.isArray(n.scenarios)) {
        n.scenarios = [];
        repairs.push({ type: 'added', path: [...path, 'scenarios'], description: 'Added scenarios array' });
      }
      if (!Array.isArray(n.chaos)) {
        n.chaos = [];
        repairs.push({ type: 'added', path: [...path, 'chaos'], description: 'Added chaos array' });
      }
      break;
    
    case 'Entity':
      if (!n.name) {
        n.name = { kind: 'Identifier', name: 'UnnamedEntity', location: createDefaultLocation() };
        repairs.push({ type: 'added', path: [...path, 'name'], description: 'Added default entity name' });
      }
      if (!Array.isArray(n.fields)) {
        n.fields = [];
        repairs.push({ type: 'added', path: [...path, 'fields'], description: 'Added fields array' });
      }
      if (!Array.isArray(n.invariants)) {
        n.invariants = [];
        repairs.push({ type: 'added', path: [...path, 'invariants'], description: 'Added invariants array' });
      }
      break;
    
    case 'Behavior':
      if (!n.name) {
        n.name = { kind: 'Identifier', name: 'UnnamedBehavior', location: createDefaultLocation() };
        repairs.push({ type: 'added', path: [...path, 'name'], description: 'Added default behavior name' });
      }
      if (!n.input) {
        n.input = { kind: 'InputSpec', fields: [], location: createDefaultLocation() };
        repairs.push({ type: 'added', path: [...path, 'input'], description: 'Added input spec' });
      }
      if (!n.output) {
        n.output = { kind: 'OutputSpec', success: { kind: 'ReferenceType', name: { kind: 'QualifiedName', parts: [{ kind: 'Identifier', name: 'Void', location: createDefaultLocation() }], location: createDefaultLocation() }, location: createDefaultLocation() }, errors: [], location: createDefaultLocation() };
        repairs.push({ type: 'added', path: [...path, 'output'], description: 'Added output spec' });
      }
      if (!Array.isArray(n.preconditions)) {
        n.preconditions = [];
        repairs.push({ type: 'added', path: [...path, 'preconditions'], description: 'Added preconditions array' });
      }
      if (!Array.isArray(n.postconditions)) {
        n.postconditions = [];
        repairs.push({ type: 'added', path: [...path, 'postconditions'], description: 'Added postconditions array' });
      }
      if (!Array.isArray(n.invariants)) {
        n.invariants = [];
        repairs.push({ type: 'added', path: [...path, 'invariants'], description: 'Added invariants array' });
      }
      if (!Array.isArray(n.temporal)) {
        n.temporal = [];
        repairs.push({ type: 'added', path: [...path, 'temporal'], description: 'Added temporal array' });
      }
      if (!Array.isArray(n.security)) {
        n.security = [];
        repairs.push({ type: 'added', path: [...path, 'security'], description: 'Added security array' });
      }
      if (!Array.isArray(n.compliance)) {
        n.compliance = [];
        repairs.push({ type: 'added', path: [...path, 'compliance'], description: 'Added compliance array' });
      }
      break;
    
    case 'Field':
      if (!n.name) {
        n.name = { kind: 'Identifier', name: 'unnamedField', location: createDefaultLocation() };
        repairs.push({ type: 'added', path: [...path, 'name'], description: 'Added default field name' });
      }
      if (!n.type) {
        n.type = { kind: 'PrimitiveType', name: 'String', location: createDefaultLocation() };
        repairs.push({ type: 'added', path: [...path, 'type'], description: 'Added default type' });
      }
      if (typeof n.optional !== 'boolean') {
        n.optional = false;
        repairs.push({ type: 'added', path: [...path, 'optional'], description: 'Added optional flag' });
      }
      if (!Array.isArray(n.annotations)) {
        n.annotations = [];
        repairs.push({ type: 'added', path: [...path, 'annotations'], description: 'Added annotations array' });
      }
      break;
    
    case 'Identifier':
      if (typeof n.name !== 'string') {
        n.name = 'unnamed';
        repairs.push({ type: 'added', path: [...path, 'name'], description: 'Added default identifier name' });
      }
      break;
    
    case 'StringLiteral':
      if (typeof n.value !== 'string') {
        n.value = '';
        repairs.push({ type: 'added', path: [...path, 'value'], description: 'Added default string value' });
      }
      break;
  }
  
  // Add location if missing (aggressive or auto)
  if ((strategy === 'aggressive' || strategy === 'auto') && !n.location) {
    n.location = createDefaultLocation();
    repairs.push({ type: 'added', path: [...path, 'location'], description: 'Added default location' });
  }
  
  // Recursively repair children
  for (const [key, value] of Object.entries(n)) {
    if (key === 'kind' || key === 'location') continue;
    
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (value[i] && typeof value[i] === 'object') {
          repairs.push(...repairNode(value[i], [...path, key, String(i)], strategy));
        }
      }
    } else if (value && typeof value === 'object') {
      repairs.push(...repairNode(value, [...path, key], strategy));
    }
  }
  
  return repairs;
}

function createDefaultLocation() {
  return {
    file: '<synthetic>',
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 1,
  };
}

// ============================================================================
// Printer Helpers
// ============================================================================

interface PrintOptions {
  indent: number;
  style: 'standard' | 'compact' | 'verbose';
  preserveComments: boolean;
}

function printDomain(domain: Domain, options: PrintOptions): string {
  const lines: string[] = [];
  
  // Domain declaration
  lines.push(`domain ${domain.name.name} version "${domain.version.value}"`);
  
  if (domain.owner) {
    lines.push(`owner "${domain.owner.value}"`);
  }
  
  // Imports
  if (domain.imports.length > 0) {
    lines.push('');
    for (const imp of domain.imports) {
      const items = imp.items.map(i => 
        i.alias ? `${i.name.name} as ${i.alias.name}` : i.name.name
      ).join(', ');
      lines.push(`imports { ${items} } from "${imp.from.value}"`);
    }
  }
  
  // Types
  for (const type of domain.types) {
    lines.push('');
    lines.push(`type ${type.name.name} = ${printTypeDefinition(type.definition, options)}`);
  }
  
  // Entities
  for (const entity of domain.entities) {
    lines.push('');
    lines.push(printEntity(entity, options));
  }
  
  // Behaviors
  for (const behavior of domain.behaviors) {
    lines.push('');
    lines.push(printBehavior(behavior, options));
  }
  
  return lines.join('\n');
}

function printEntity(entity: { name: { name: string }; fields: Array<{ name: { name: string }; type: TypeDefinition; optional: boolean }>; invariants: Expression[] }, options: PrintOptions): string {
  const lines: string[] = [];
  const ind = ' '.repeat(options.indent);
  
  lines.push(`entity ${entity.name.name} {`);
  
  for (const field of entity.fields) {
    const optional = field.optional ? '?' : '';
    lines.push(`${ind}${field.name.name}${optional}: ${printTypeDefinition(field.type, options)}`);
  }
  
  if (entity.invariants.length > 0) {
    lines.push('');
    for (const inv of entity.invariants) {
      lines.push(`${ind}invariant ${printExpression(inv)}`);
    }
  }
  
  lines.push('}');
  return lines.join('\n');
}

function printBehavior(behavior: { name: { name: string }; input: { fields: Array<{ name: { name: string }; type: TypeDefinition; optional: boolean }> }; output: { success: TypeDefinition; errors: Array<{ name: { name: string }; when?: { value: string } }> }; preconditions: Expression[]; postconditions: Array<{ condition: string | { name: string }; predicates: Expression[] }> }, options: PrintOptions): string {
  const lines: string[] = [];
  const ind = ' '.repeat(options.indent);
  const ind2 = ' '.repeat(options.indent * 2);
  
  lines.push(`behavior ${behavior.name.name} {`);
  
  // Input
  if (behavior.input && behavior.input.fields.length > 0) {
    lines.push(`${ind}input {`);
    for (const field of behavior.input.fields) {
      const optional = field.optional ? '?' : '';
      lines.push(`${ind2}${field.name.name}${optional}: ${printTypeDefinition(field.type, options)}`);
    }
    lines.push(`${ind}}`);
  }
  
  // Output
  if (behavior.output) {
    lines.push('');
    lines.push(`${ind}output {`);
    lines.push(`${ind2}success: ${printTypeDefinition(behavior.output.success, options)}`);
    
    if (behavior.output.errors.length > 0) {
      lines.push(`${ind2}errors {`);
      for (const error of behavior.output.errors) {
        const whenClause = error.when ? ` when "${error.when.value}"` : '';
        lines.push(`${ind2}${ind}${error.name.name}${whenClause}`);
      }
      lines.push(`${ind2}}`);
    }
    lines.push(`${ind}}`);
  }
  
  // Preconditions
  if (behavior.preconditions.length > 0) {
    lines.push('');
    for (const pre of behavior.preconditions) {
      lines.push(`${ind}pre ${printExpression(pre)}`);
    }
  }
  
  // Postconditions
  if (behavior.postconditions.length > 0) {
    lines.push('');
    for (const post of behavior.postconditions) {
      const condName = typeof post.condition === 'string' ? post.condition : post.condition.name;
      lines.push(`${ind}post ${condName} {`);
      for (const pred of post.predicates) {
        lines.push(`${ind2}${printExpression(pred)}`);
      }
      lines.push(`${ind}}`);
    }
  }
  
  lines.push('}');
  return lines.join('\n');
}

function printTypeDefinition(type: TypeDefinition, options: PrintOptions): string {
  if (!type || typeof type !== 'object') return 'unknown';
  
  const t = type as unknown as Record<string, unknown>;
  
  switch (t.kind) {
    case 'PrimitiveType':
      return t.name as string;
    
    case 'ReferenceType': {
      const ref = t.name as { parts?: Array<{ name: string }> };
      return ref.parts?.map(p => p.name).join('.') ?? 'unknown';
    }
    
    case 'ListType':
      return `List<${printTypeDefinition(t.element as TypeDefinition, options)}>`;
    
    case 'MapType':
      return `Map<${printTypeDefinition(t.key as TypeDefinition, options)}, ${printTypeDefinition(t.value as TypeDefinition, options)}>`;
    
    case 'OptionalType':
      return `${printTypeDefinition(t.inner as TypeDefinition, options)}?`;
    
    case 'StructType': {
      const fields = (t.fields as Array<{ name: { name: string }; type: TypeDefinition; optional: boolean }>);
      const fieldStrs = fields.map(f => {
        const opt = f.optional ? '?' : '';
        return `${f.name.name}${opt}: ${printTypeDefinition(f.type, options)}`;
      });
      return `{ ${fieldStrs.join(', ')} }`;
    }
    
    case 'EnumType': {
      const variants = (t.variants as Array<{ name: { name: string } }>);
      return variants.map(v => v.name.name).join(' | ');
    }
    
    case 'UnionType': {
      const variants = (t.variants as Array<{ name: { name: string } }>);
      return variants.map(v => v.name.name).join(' | ');
    }
    
    default:
      return 'unknown';
  }
}

function printExpression(expr: Expression | unknown): string {
  if (!expr || typeof expr !== 'object') return String(expr);
  
  const e = expr as Record<string, unknown>;
  
  switch (e.kind) {
    case 'Identifier':
      return e.name as string;
    
    case 'QualifiedName': {
      const parts = e.parts as Array<{ name: string }>;
      return parts.map(p => p.name).join('.');
    }
    
    case 'StringLiteral':
      return `"${e.value}"`;
    
    case 'NumberLiteral':
      return String(e.value);
    
    case 'BooleanLiteral':
      return e.value ? 'true' : 'false';
    
    case 'NullLiteral':
      return 'null';
    
    case 'BinaryExpr':
      return `${printExpression(e.left)} ${e.operator} ${printExpression(e.right)}`;
    
    case 'UnaryExpr':
      return `${e.operator} ${printExpression(e.operand)}`;
    
    case 'MemberExpr':
      return `${printExpression(e.object)}.${(e.property as { name: string })?.name}`;
    
    case 'CallExpr': {
      const args = (e.arguments as unknown[])?.map(printExpression).join(', ') ?? '';
      return `${printExpression(e.callee)}(${args})`;
    }
    
    case 'OldExpr':
      return `old(${printExpression(e.expression)})`;
    
    case 'ResultExpr':
      return e.property ? `result.${(e.property as { name: string }).name}` : 'result';
    
    case 'InputExpr':
      return `input.${(e.property as { name: string }).name}`;
    
    case 'QuantifierExpr': {
      const variable = (e.variable as { name: string })?.name;
      const collection = printExpression(e.collection);
      const predicate = printExpression(e.predicate);
      return `${e.quantifier} ${variable} in ${collection}: ${predicate}`;
    }
    
    case 'ConditionalExpr':
      return `if ${printExpression(e.condition)} then ${printExpression(e.thenBranch)} else ${printExpression(e.elseBranch)}`;
    
    case 'ListExpr': {
      const elements = (e.elements as unknown[])?.map(printExpression).join(', ') ?? '';
      return `[${elements}]`;
    }
    
    case 'DurationLiteral':
      return `${e.value}${e.unit}`;
    
    default:
      return `[${e.kind}]`;
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  handleTranslate,
  handleValidateAST,
  handleRepairAST,
  handlePrint,
  TRANSLATOR_TOOL_SCHEMAS,
};
