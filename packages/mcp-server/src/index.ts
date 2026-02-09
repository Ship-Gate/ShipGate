#!/usr/bin/env node
/**
 * ISL MCP Server
 * 
 * Model Context Protocol server that exposes ISL tools to AI assistants.
 * 
 * ── Unified Shipgate API (first-class) ──────────────────────────────────
 * - scan:         Parse + typecheck an ISL spec
 * - verify:       Verify implementation against spec → trust score
 * - proof_pack:   Create deterministic evidence bundle
 * - proof_verify: Verify evidence bundle integrity
 * - gen:          Generate TypeScript from ISL spec
 *
 * ── Legacy Tools (backward-compatible) ──────────────────────────────────
 * - isl_check, isl_generate, isl_constraints, isl_suggest
 * - isl_build, isl_verify, isl_gate
 * - isl_translate, isl_validate_ast, isl_repair_ast, isl_print
 * 
 * Resources:
 * - isl://help/syntax: ISL syntax reference
 * - isl://help/constraints: Constraints guide
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { parse } from '@isl-lang/parser';
import { check } from '@isl-lang/typechecker';
import { generate as generateRuntime } from '@isl-lang/codegen-runtime';

// Unified core operations (single source of truth)
import {
  scan as coreScan,
  verifySpec as coreVerify,
  proofPack as coreProofPack,
  proofVerify as coreProofVerify,
  gen as coreGen,
} from './core.js';
import type {
  VerifyResult as CoreVerifyResult,
} from './core.js';

// Auth guard
import { resolveAuthConfig, createAuthGuard } from './auth.js';

// Pipeline tools
import {
  handleBuild,
  handleVerify,
  handleGate,
  formatMCPResponse,
  PIPELINE_TOOL_SCHEMAS,
  GATE_TOOL_SCHEMA,
} from './tools/pipeline/index.js';
import type { BuildInput, VerifyInput, GateInput } from './tools/pipeline/index.js';

// ============================================================================
// Optional Translator Tools (defensive import)
// ============================================================================

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, { type: string; description: string; enum?: readonly string[] | string[] }>;
    required?: readonly string[] | string[];
  };
}

interface TranslatorToolSchemas {
  isl_translate: ToolDefinition;
  isl_validate_ast: ToolDefinition;
  isl_repair_ast: ToolDefinition;
  isl_print: ToolDefinition;
}

let translatorToolSchemas: TranslatorToolSchemas | undefined;
let translatorToolsAvailable = false;

// Try to load translator tools at startup
async function loadTranslatorTools(): Promise<void> {
  try {
    const module = await import('./tools/translator-tools.js');
    if (module.TRANSLATOR_TOOL_SCHEMAS) {
      translatorToolSchemas = module.TRANSLATOR_TOOL_SCHEMAS;
      translatorToolsAvailable = true;
    }
  } catch {
    // Translator tools not available - this is fine
    translatorToolsAvailable = false;
  }
}

// Try loading from types file as fallback
async function loadTranslatorToolTypes(): Promise<void> {
  if (translatorToolsAvailable) return;
  
  try {
    const module = await import('./tools/translator-tool-types.js');
    if (module.TRANSLATOR_TOOL_SCHEMAS) {
      translatorToolSchemas = module.TRANSLATOR_TOOL_SCHEMAS as TranslatorToolSchemas;
      translatorToolsAvailable = true;
    }
  } catch {
    // Not available - this is fine
  }
}

// ============================================================================
// Server Setup
// ============================================================================

const server = new Server(
  {
    name: 'isl-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ============================================================================
// Tool Handlers
// ============================================================================

// ============================================================================
// Auth Guard
// ============================================================================

const authConfig = resolveAuthConfig();
const authGuard = createAuthGuard(authConfig);

// ============================================================================
// Unified Shipgate Tool Schemas
// ============================================================================

const UNIFIED_TOOL_SCHEMAS: ToolDefinition[] = [
  {
    name: 'scan',
    description: 'Parse and typecheck an ISL specification. Returns domain info, diagnostics, and AST summary. This is the entry point for all spec validation.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'ISL source code' },
        filename: { type: 'string', description: 'Optional filename for diagnostics' },
      },
      required: ['source'],
    },
  },
  {
    name: 'verify',
    description: 'Verify an implementation against an ISL spec. Returns SHIP/NO-SHIP decision, trust score, clause-by-clause results, and blockers.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: { type: 'string', description: 'ISL specification source code' },
        implementation: { type: 'string', description: 'Implementation source code' },
        framework: { type: 'string', enum: ['vitest', 'jest'], description: 'Test framework (default: vitest)' },
        timeout: { type: 'number', description: 'Per-test timeout in ms (default: 30000)' },
        threshold: { type: 'number', description: 'Minimum trust score to SHIP (default: 95)' },
        allowSkipped: { type: 'boolean', description: 'Allow skipped tests to pass (default: false)' },
      },
      required: ['spec', 'implementation'],
    },
  },
  {
    name: 'proof_pack',
    description: 'Create a deterministic evidence bundle from verification results. Produces a fingerprinted manifest with artifact hashes for tamper detection.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: { type: 'string', description: 'ISL specification source code' },
        implementation: { type: 'string', description: 'Implementation source code' },
        verifyResult: { type: 'object', description: 'Result from the verify tool' },
        outputDir: { type: 'string', description: 'Directory to write bundle (omit for in-memory)' },
      },
      required: ['spec', 'implementation', 'verifyResult'],
    },
  },
  {
    name: 'proof_verify',
    description: 'Verify an evidence bundle\'s integrity. Recomputes artifact hashes and fingerprint to detect tampering.',
    inputSchema: {
      type: 'object',
      properties: {
        bundlePath: { type: 'string', description: 'Path to the evidence bundle directory' },
      },
      required: ['bundlePath'],
    },
  },
  {
    name: 'gen',
    description: 'Generate TypeScript types and runtime verification code from an ISL specification.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'ISL source code' },
        mode: { type: 'string', enum: ['development', 'production', 'test'], description: 'Code generation mode (default: development)' },
      },
      required: ['source'],
    },
  },
];

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const coreTools: ToolDefinition[] = [
    // ========================================================================
    // Unified Shipgate API (first-class)
    // ========================================================================
    ...UNIFIED_TOOL_SCHEMAS,

    // ========================================================================
    // Legacy Tools (backward-compatible)
    // ========================================================================
    {
      name: 'isl_check',
      description: 'Parse and type check an ISL specification file. Returns parsing errors and type checking diagnostics.',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'The ISL source code to check',
          },
          filename: {
            type: 'string',
            description: 'Optional filename for error reporting',
          },
        },
        required: ['source'],
      },
    },
    {
      name: 'isl_generate',
      description: 'Generate TypeScript code with runtime verification from an ISL specification.',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'The ISL source code',
          },
          mode: {
            type: 'string',
            enum: ['development', 'production', 'test'],
            description: 'Instrumentation mode for runtime checks',
          },
        },
        required: ['source'],
      },
    },
    {
      name: 'isl_constraints',
      description: 'Extract preconditions, postconditions, and invariants from an ISL behavior.',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'The ISL source code',
          },
          behavior: {
            type: 'string',
            description: 'Name of the behavior to extract constraints from',
          },
        },
        required: ['source', 'behavior'],
      },
    },
    {
      name: 'isl_suggest',
      description: 'Suggest fixes for verification failures or type errors.',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'The ISL source code',
          },
          error: {
            type: 'string',
            description: 'The error message to provide suggestions for',
          },
        },
        required: ['source', 'error'],
      },
    },

    // ========================================================================
    // Pipeline Tools (SHIP/NO-SHIP workflow)
    // ========================================================================
    PIPELINE_TOOL_SCHEMAS.isl_build,
    PIPELINE_TOOL_SCHEMAS.isl_verify,
    GATE_TOOL_SCHEMA,
  ];

  // Add translator tools if available
  const tools: ToolDefinition[] = [...coreTools];
  if (translatorToolsAvailable && translatorToolSchemas) {
    tools.push(translatorToolSchemas.isl_translate);
    tools.push(translatorToolSchemas.isl_validate_ast);
    tools.push(translatorToolSchemas.isl_repair_ast);
    tools.push(translatorToolSchemas.isl_print);
  }

  return { tools };
});

// MCP CallTool result type - compatible with SDK's CallToolResult
interface CallToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Auth guard — reject if token mode is active and token is missing/invalid
  const authCtx = authGuard((args ?? {}) as Record<string, unknown>);
  if (!authCtx.authenticated) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: false, error: authCtx.error }, null, 2),
        },
      ],
      isError: true,
    };
  }

  switch (name) {
    // ==================================================================
    // Unified Shipgate API
    // ==================================================================
    case 'scan':
      return formatMCPResponse(
        coreScan(
          (args as { source: string; filename?: string }).source,
          (args as { source: string; filename?: string }).filename,
        ),
      );

    case 'verify':
      return formatMCPResponse(
        await coreVerify(
          (args as { spec: string }).spec,
          (args as { implementation: string }).implementation,
          {
            framework: (args as Record<string, unknown>).framework as 'vitest' | 'jest' | undefined,
            timeout: (args as Record<string, unknown>).timeout as number | undefined,
            threshold: (args as Record<string, unknown>).threshold as number | undefined,
            allowSkipped: (args as Record<string, unknown>).allowSkipped as boolean | undefined,
          },
        ),
      );

    case 'proof_pack':
      return formatMCPResponse(
        await coreProofPack(
          (args as { spec: string }).spec,
          (args as { implementation: string }).implementation,
          (args as { verifyResult: CoreVerifyResult }).verifyResult,
          (args as { outputDir?: string }).outputDir,
        ),
      );

    case 'proof_verify':
      return formatMCPResponse(
        await coreProofVerify(
          (args as { bundlePath: string }).bundlePath,
        ),
      );

    case 'gen':
      return formatMCPResponse(
        coreGen(
          (args as { source: string }).source,
          { mode: (args as { mode?: string }).mode as 'development' | 'production' | 'test' | undefined },
        ),
      );

    // ==================================================================
    // Legacy tools (backward-compatible)
    // ==================================================================
    case 'isl_check':
      return handleCheck(args as { source: string; filename?: string });
    
    case 'isl_generate':
      return handleGenerate(args as { source: string; mode?: string });
    
    case 'isl_constraints':
      return handleConstraints(args as { source: string; behavior: string });
    
    case 'isl_suggest':
      return handleSuggest(args as { source: string; error: string });
    
    // Pipeline tools (SHIP/NO-SHIP workflow)
    case 'isl_build':
      return formatMCPResponse(await handleBuild(args as unknown as BuildInput));
    
    case 'isl_verify':
      return formatMCPResponse(await handleVerify(args as unknown as VerifyInput));
    
    case 'isl_gate':
      return formatMCPResponse(await handleGate(args as unknown as GateInput));
    
    // Translator tools (defensive - only if module available)
    case 'isl_translate':
    case 'isl_validate_ast':
    case 'isl_repair_ast':
    case 'isl_print':
      return handleTranslatorTool(name, args);
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

/**
 * Wrap translator tool result in MCP-compatible format
 */
function wrapTranslatorResult(result: unknown): CallToolResult {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

/**
 * Handle translator tool calls with defensive loading
 */
async function handleTranslatorTool(name: string, args: unknown): Promise<CallToolResult> {
  if (!translatorToolsAvailable) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: `Tool "${name}" is not available. The translator-tools module is not installed.`,
            hint: 'This is an optional feature. Core ISL tools (isl_check, isl_generate, etc.) are still available.',
          }, null, 2),
        },
      ],
    };
  }

  try {
    // Dynamic import of translator tool handlers
    const handlers = await import('./tools/translator-tools.js');
    
    // Type assertion for args - the schemas ensure correct input types at runtime
    let rawResult: unknown;
    
    switch (name) {
      case 'isl_translate':
        if (handlers.handleTranslate) {
          rawResult = await handlers.handleTranslate(args as unknown as Parameters<typeof handlers.handleTranslate>[0]);
        }
        break;
      case 'isl_validate_ast':
        if (handlers.handleValidateAST) {
          rawResult = await handlers.handleValidateAST(args as unknown as Parameters<typeof handlers.handleValidateAST>[0]);
        }
        break;
      case 'isl_repair_ast':
        if (handlers.handleRepairAST) {
          rawResult = await handlers.handleRepairAST(args as unknown as Parameters<typeof handlers.handleRepairAST>[0]);
        }
        break;
      case 'isl_print':
        if (handlers.handlePrint) {
          rawResult = await handlers.handlePrint(args as unknown as Parameters<typeof handlers.handlePrint>[0]);
        }
        break;
    }

    if (rawResult !== undefined) {
      return wrapTranslatorResult(rawResult);
    }

    // Fallback if handler not found
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: `Handler for "${name}" not implemented yet.`,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: `Failed to execute "${name}": ${error instanceof Error ? error.message : String(error)}`,
          }, null, 2),
        },
      ],
    };
  }
}

// ============================================================================
// Tool Implementations
// ============================================================================

async function handleCheck(args: { source: string; filename?: string }): Promise<CallToolResult> {
  const { domain, errors } = parse(args.source, args.filename);
  
  if (errors.length > 0 || !domain) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            parseErrors: errors.map(e => ({
              message: e.message,
              line: e.location.line,
              column: e.location.column,
            })),
          }, null, 2),
        },
      ],
    };
  }
  
  // Type check
  const typeResult = check(domain);
  const typeErrors = typeResult.diagnostics.filter(d => d.severity === 'error');
  const warnings = typeResult.diagnostics.filter(d => d.severity === 'warning');
  
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          success: typeErrors.length === 0,
          domain: domain.name.name,
          entities: domain.entities.map(e => e.name.name),
          behaviors: domain.behaviors.map(b => b.name.name),
          typeErrors: typeErrors.map(e => ({
            message: e.message,
            line: e.location.line,
            column: e.location.column,
          })),
          warnings: warnings.map(w => ({
            message: w.message,
            line: w.location.line,
          })),
        }, null, 2),
      },
    ],
  };
}

async function handleGenerate(args: { source: string; mode?: string }): Promise<CallToolResult> {
  const { domain, errors } = parse(args.source);
  
  if (errors.length > 0 || !domain) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: 'Failed to parse ISL source',
            parseErrors: errors.map(e => e.message),
          }, null, 2),
        },
      ],
    };
  }
  
  const files = generateRuntime(domain, {
    mode: (args.mode as 'development' | 'production' | 'test') ?? 'development',
    includeComments: true,
    includeHelpers: true,
  });
  
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          domain: domain.name.name,
          files: files.map(f => ({
            path: f.path,
            type: f.type,
            preview: f.content.substring(0, 500) + (f.content.length > 500 ? '...' : ''),
          })),
          fullContent: files.reduce((acc, f) => {
            acc[f.path] = f.content;
            return acc;
          }, {} as Record<string, string>),
        }, null, 2),
      },
    ],
  };
}

async function handleConstraints(args: { source: string; behavior: string }): Promise<CallToolResult> {
  const { domain, errors } = parse(args.source);
  
  if (errors.length > 0 || !domain) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: 'Failed to parse ISL source',
          }, null, 2),
        },
      ],
    };
  }
  
  const behavior = domain.behaviors.find(b => b.name.name === args.behavior);
  
  if (!behavior) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: `Behavior '${args.behavior}' not found. Available: ${domain.behaviors.map(b => b.name.name).join(', ')}`,
          }, null, 2),
        },
      ],
    };
  }
  
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          behavior: behavior.name.name,
          input: behavior.input?.fields?.map(f => ({
            name: f.name.name,
            type: getTypeName(f.type),
            optional: f.optional,
          })) ?? [],
          output: behavior.output?.success ? getTypeName(behavior.output.success) : 'void',
          preconditions: behavior.preconditions?.map(expressionToString) ?? [],
          postconditions: behavior.postconditions?.map(p => ({
            condition: typeof p.condition === 'string' ? p.condition : p.condition.name,
            predicates: p.predicates?.map(expressionToString) ?? [],
          })) ?? [],
          invariants: behavior.invariants?.map(expressionToString) ?? [],
        }, null, 2),
      },
    ],
  };
}

async function handleSuggest(args: { source: string; error: string }): Promise<CallToolResult> {
  const { domain, errors } = parse(args.source);
  
  // Analyze the error and provide suggestions
  const suggestions: string[] = [];
  
  if (args.error.includes('precondition')) {
    suggestions.push('Check that all input values satisfy the preconditions before calling the function.');
    suggestions.push('Add input validation at the call site.');
    suggestions.push('Review the precondition constraints in the ISL spec.');
  }
  
  if (args.error.includes('postcondition')) {
    suggestions.push('Verify that the implementation correctly modifies the expected state.');
    suggestions.push('Check that the return value matches the expected output type.');
    suggestions.push('Ensure all side effects specified in postconditions are performed.');
  }
  
  if (args.error.includes('invariant')) {
    suggestions.push('Ensure the invariant property is maintained throughout the operation.');
    suggestions.push('Check for race conditions that might violate the invariant.');
    suggestions.push('Review the entity state changes in the implementation.');
  }
  
  if (args.error.includes('type') || args.error.includes('Type')) {
    suggestions.push('Check that the type matches the ISL specification.');
    suggestions.push('Ensure all required fields are present.');
    suggestions.push('Verify that optional fields are handled correctly.');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('Review the ISL specification for the expected behavior.');
    suggestions.push('Check the implementation against the pre/postconditions.');
    suggestions.push('Ensure all error cases are handled as specified.');
  }
  
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          error: args.error,
          suggestions,
          parseStatus: errors.length === 0 ? 'valid' : 'invalid',
          domain: domain?.name.name ?? null,
        }, null, 2),
      },
    ],
  };
}

// ============================================================================
// Resources
// ============================================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'isl://help/syntax',
        name: 'ISL Syntax Reference',
        description: 'Quick reference for ISL syntax',
        mimeType: 'text/markdown',
      },
      {
        uri: 'isl://help/constraints',
        name: 'ISL Constraints Guide',
        description: 'How to write preconditions, postconditions, and invariants',
        mimeType: 'text/markdown',
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  if (uri === 'isl://help/syntax') {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: `# ISL Syntax Quick Reference

## Domain Declaration
\`\`\`isl
domain MyDomain version "1.0.0"
\`\`\`

## Entity
\`\`\`isl
entity User {
  id: UUID
  name: String
  email: String
  isActive: Boolean
  
  invariant email.contains("@")
}
\`\`\`

## Behavior
\`\`\`isl
behavior CreateUser {
  input {
    name: String
    email: String
  }
  
  output {
    success: User
    errors {
      InvalidEmail when "email format is invalid"
    }
  }
  
  pre email.contains("@")
  pre name.length > 0
  
  post success {
    result.name == input.name
    result.email == input.email
  }
}
\`\`\`
`,
        },
      ],
    };
  }
  
  if (uri === 'isl://help/constraints') {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: `# ISL Constraints Guide

## Preconditions (pre)
Conditions that must be true before a behavior executes:
\`\`\`isl
pre amount > 0
pre sender.balance >= amount
pre sender.isActive and receiver.isActive
\`\`\`

## Postconditions (post)
Conditions that must be true after successful execution:
\`\`\`isl
post success {
  sender.balance == old(sender.balance) - amount
  receiver.balance == old(receiver.balance) + amount
}
\`\`\`

Use \`old(expr)\` to reference pre-execution state.

## Invariants
Properties that must always hold:
\`\`\`isl
invariant balance >= 0
\`\`\`

## Quantifiers
- \`all items: condition\` - all items satisfy condition
- \`any items: condition\` - at least one item satisfies
- \`none items: condition\` - no items satisfy
`,
        },
      ],
    };
  }
  
  throw new Error(`Resource not found: ${uri}`);
});

// ============================================================================
// Helpers
// ============================================================================

function getTypeName(typeRef: unknown): string {
  if (!typeRef) return 'unknown';
  
  if (typeof typeRef === 'object' && typeRef !== null) {
    const t = typeRef as Record<string, unknown>;
    if ('name' in t) {
      const name = typeof t.name === 'string' ? t.name : (t.name as { name?: string })?.name;
      return name ?? 'unknown';
    }
  }
  
  return 'unknown';
}

function expressionToString(expr: unknown): string {
  if (!expr || typeof expr !== 'object') return String(expr);
  
  const e = expr as Record<string, unknown>;
  
  switch (e.kind) {
    case 'Identifier':
      return e.name as string;
    case 'BinaryExpr':
      return `${expressionToString(e.left)} ${e.operator} ${expressionToString(e.right)}`;
    case 'MemberExpr':
      return `${expressionToString(e.object)}.${(e.property as { name: string })?.name}`;
    case 'CallExpr':
      return `${expressionToString(e.callee)}(...)`;
    case 'OldExpr':
      return `old(${expressionToString(e.expression)})`;
    case 'NumberLiteral':
      return String(e.value);
    case 'StringLiteral':
      return `"${e.value}"`;
    case 'BooleanLiteral':
      return String(e.value);
    default:
      return `[${e.kind}]`;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  // Load optional translator tools (defensive - won't fail if missing)
  await loadTranslatorTools();
  await loadTranslatorToolTypes();
  
  if (translatorToolsAvailable) {
    console.error('ISL MCP Server: Translator tools loaded');
  }
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ISL MCP Server running on stdio');
}

main().catch(console.error);
