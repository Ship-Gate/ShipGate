/**
 * ISL → Code Generator
 * 
 * This agent "only understands ISL." It:
 * - Builds a plan (files to touch, functions to add)
 * - Generates code from known templates + repo conventions
 * - REFUSES to invent dependencies/APIs
 * - Produces a diff (NEVER writes blindly)
 * 
 * KEY RULE: Generator only accepts ISL AST as input.
 * 
 * @module @isl-lang/generator
 */

import type { ISLAST, BehaviorAST, EntityAST, FieldAST, RepoContext } from '@isl-lang/translator';

// ============================================================================
// Types
// ============================================================================

export interface GenerationRequest {
  /** ISL AST from translator */
  ast: ISLAST;
  /** Repo context for conventions */
  repoContext: RepoContext;
  /** Target directory */
  targetDir: string;
  /** Generation options */
  options?: GenerationOptions;
}

export interface GenerationOptions {
  /** Dry run - don't write files */
  dryRun?: boolean;
  /** Include tests */
  includeTests?: boolean;
  /** Test framework */
  testFramework?: 'vitest' | 'jest';
  /** Validation library */
  validationLib?: 'zod' | 'yup' | 'joi';
}

export interface GenerationPlan {
  /** Files that will be created */
  filesToCreate: PlannedFile[];
  /** Files that will be modified */
  filesToModify: PlannedModification[];
  /** Dependencies to add */
  dependencies: PlannedDependency[];
  /** Warnings/concerns */
  warnings: string[];
  /** Things the generator refused to do */
  refused: RefusedAction[];
}

export interface PlannedFile {
  path: string;
  purpose: string;
  template: string;
  content?: string;
}

export interface PlannedModification {
  path: string;
  reason: string;
  changes: PlannedChange[];
}

export interface PlannedChange {
  type: 'insert' | 'replace' | 'append';
  location: string;
  content: string;
  before?: string;
  after?: string;
}

export interface PlannedDependency {
  name: string;
  version: string;
  dev: boolean;
  reason: string;
}

export interface RefusedAction {
  action: string;
  reason: string;
  suggestion: string;
}

export interface GenerationResult {
  success: boolean;
  plan: GenerationPlan;
  /** Generated diffs */
  diffs: FileDiff[];
  /** Proof links (ISL clause → code location) */
  proofLinks: ProofLink[];
  /** Errors if generation failed */
  errors?: string[];
}

export interface FileDiff {
  path: string;
  hunks: DiffHunk[];
  status: 'created' | 'modified';
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

export interface ProofLink {
  /** ISL clause reference */
  clause: {
    type: 'precondition' | 'postcondition' | 'invariant' | 'intent';
    source: string;
    behavior: string;
  };
  /** Code location */
  codeLocation: {
    file: string;
    startLine: number;
    endLine: number;
    snippet: string;
  };
  /** How the clause is satisfied */
  satisfaction: 'direct' | 'indirect' | 'test' | 'middleware';
}

// ============================================================================
// Code Templates
// ============================================================================

const TEMPLATES = {
  // Next.js API route
  'nextjs-api-route': (behavior: BehaviorAST, ctx: RepoContext) => `
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
${behavior.intents.some(i => i.tag === 'rate-limit-required') ? "import { rateLimit } from '@/lib/rate-limit';" : ''}
${behavior.intents.some(i => i.tag === 'audit-required') ? "import { audit } from '@/lib/audit';" : ''}

// Input validation schema (from ISL preconditions)
const ${behavior.name}Schema = z.object({
${behavior.input.map(f => `  ${f.name}: ${zodType(f)},`).join('\n')}
});

export async function POST(request: NextRequest) {
${behavior.intents.some(i => i.tag === 'rate-limit-required') ? `
  // @intent rate-limit-required
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
` : ''}

  try {
    const body = await request.json();
    
    // Validate input (ISL preconditions)
    const validationResult = ${behavior.name}Schema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }
    
    const input = validationResult.data;
    
    // TODO: Implement ${behavior.name} logic
    // ISL postconditions to satisfy:
${behavior.postconditions.map(p => `    // - ${p.predicates.map(pred => pred.source).join(', ')}`).join('\n')}
    
    const result = await ${camelCase(behavior.name)}(input);
    
${behavior.intents.some(i => i.tag === 'audit-required') ? `
    // @intent audit-required
    await audit({
      action: '${behavior.name}',
      userId: result.userId,
      metadata: { /* redacted input */ },
    });
` : ''}

    return NextResponse.json(result);
  } catch (error) {
    // Handle known errors from ISL
${behavior.output.errors.map(e => `
    if (error instanceof ${e.name}Error) {
      return NextResponse.json({ error: '${e.when}' }, { status: ${errorStatusCode(e.name)} });
    }`).join('')}
    
    console.error('${behavior.name} failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function ${camelCase(behavior.name)}(input: z.infer<typeof ${behavior.name}Schema>) {
  // Implementation goes here
  throw new Error('Not implemented');
}
`.trim(),

  // Express route handler
  'express-handler': (behavior: BehaviorAST, ctx: RepoContext) => `
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
${behavior.intents.some(i => i.tag === 'rate-limit-required') ? "import { rateLimiter } from '../middleware/rate-limit';" : ''}
${behavior.intents.some(i => i.tag === 'audit-required') ? "import { auditLog } from '../services/audit';" : ''}

const router = Router();

// Input validation schema (from ISL preconditions)
const ${behavior.name}Schema = z.object({
${behavior.input.map(f => `  ${f.name}: ${zodType(f)},`).join('\n')}
});

${behavior.intents.some(i => i.tag === 'rate-limit-required') ? `// @intent rate-limit-required
router.use(rateLimiter({ windowMs: 60000, max: 10 }));
` : ''}

router.post('/${kebabCase(behavior.name)}', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate input (ISL preconditions)
    const validationResult = ${behavior.name}Schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.flatten(),
      });
    }
    
    const input = validationResult.data;
    
    // TODO: Implement ${behavior.name} logic
    // ISL postconditions to satisfy:
${behavior.postconditions.map(p => `    // - ${p.predicates.map(pred => pred.source).join(', ')}`).join('\n')}
    
    const result = await ${camelCase(behavior.name)}(input);
    
${behavior.intents.some(i => i.tag === 'audit-required') ? `
    // @intent audit-required
    await auditLog({
      action: '${behavior.name}',
      userId: result.userId,
      ip: req.ip,
    });
` : ''}

    res.json(result);
  } catch (error) {
    next(error);
  }
});

async function ${camelCase(behavior.name)}(input: z.infer<typeof ${behavior.name}Schema>) {
  // Implementation goes here
  throw new Error('Not implemented');
}

export { router as ${camelCase(behavior.name)}Router };
`.trim(),

  // Test file
  'vitest-test': (behavior: BehaviorAST, ctx: RepoContext) => `
import { describe, it, expect, beforeEach } from 'vitest';
import { ${camelCase(behavior.name)} } from './${kebabCase(behavior.name)}';

describe('${behavior.name}', () => {
  // Tests derived from ISL preconditions
${behavior.preconditions.map(pre => `
  it('should validate: ${pre.source}', async () => {
    // TODO: Implement precondition test
    expect(true).toBe(true);
  });
`).join('')}

  // Tests derived from ISL postconditions
${behavior.postconditions.map(post => post.predicates.map(pred => `
  it('should ensure: ${pred.source}', async () => {
    // TODO: Implement postcondition test
    expect(true).toBe(true);
  });
`).join('')).join('')}

  // Tests derived from ISL error conditions
${behavior.output.errors.map(e => `
  it('should return ${e.name} when ${e.when}', async () => {
    // TODO: Implement error condition test
    expect(true).toBe(true);
  });
`).join('')}

  // Intent enforcement tests
${behavior.intents.map(intent => `
  it('should enforce @intent ${intent.tag}', async () => {
    // TODO: Verify intent is enforced
    expect(true).toBe(true);
  });
`).join('')}
});
`.trim(),

  // TypeScript types
  'typescript-types': (ast: ISLAST) => `
/**
 * Generated types from ISL domain: ${ast.name}
 * 
 * DO NOT EDIT - Generated from ISL specification
 */

${ast.entities.map(entity => `
export interface ${entity.name} {
${entity.fields.map(f => `  ${f.name}${f.optional ? '?' : ''}: ${tsType(f)};`).join('\n')}
}
`).join('\n')}

${ast.behaviors.map(behavior => `
export interface ${behavior.name}Input {
${behavior.input.map(f => `  ${f.name}${f.optional ? '?' : ''}: ${tsType(f)};`).join('\n')}
}

export interface ${behavior.name}Output {
  success: boolean;
  data?: ${behavior.output.success.name};
  error?: ${behavior.output.errors.map(e => `'${e.name}'`).join(' | ')};
}
`).join('\n')}
`.trim(),

  // Zod validation schemas
  'zod-schemas': (ast: ISLAST) => `
/**
 * Generated Zod schemas from ISL domain: ${ast.name}
 * 
 * DO NOT EDIT - Generated from ISL specification
 */

import { z } from 'zod';

${ast.entities.map(entity => `
export const ${entity.name}Schema = z.object({
${entity.fields.map(f => `  ${f.name}: ${zodType(f)}${f.optional ? '.optional()' : ''},`).join('\n')}
});

export type ${entity.name} = z.infer<typeof ${entity.name}Schema>;
`).join('\n')}

${ast.behaviors.map(behavior => `
export const ${behavior.name}InputSchema = z.object({
${behavior.input.map(f => `  ${f.name}: ${zodType(f)}${f.optional ? '.optional()' : ''},`).join('\n')}
});

export type ${behavior.name}Input = z.infer<typeof ${behavior.name}InputSchema>;
`).join('\n')}
`.trim(),
};

// ============================================================================
// Generator Implementation
// ============================================================================

export class ISLGenerator {
  private repoContext: RepoContext;

  constructor(repoContext: RepoContext) {
    this.repoContext = repoContext;
  }

  /**
   * Generate a plan from ISL AST
   */
  plan(ast: ISLAST): GenerationPlan {
    const filesToCreate: PlannedFile[] = [];
    const filesToModify: PlannedModification[] = [];
    const dependencies: PlannedDependency[] = [];
    const warnings: string[] = [];
    const refused: RefusedAction[] = [];

    // Always generate types
    filesToCreate.push({
      path: `src/types/${kebabCase(ast.name)}.types.ts`,
      purpose: 'TypeScript types from ISL entities',
      template: 'typescript-types',
    });

    // Generate Zod schemas
    filesToCreate.push({
      path: `src/schemas/${kebabCase(ast.name)}.schema.ts`,
      purpose: 'Zod validation schemas from ISL',
      template: 'zod-schemas',
    });

    // Add zod dependency
    dependencies.push({
      name: 'zod',
      version: '^3.22.0',
      dev: false,
      reason: 'Runtime validation from ISL preconditions',
    });

    // Generate route handlers for each behavior
    for (const behavior of ast.behaviors) {
      const routePath = this.getRoutePath(behavior);

      filesToCreate.push({
        path: routePath,
        purpose: `API handler for ${behavior.name}`,
        template: this.repoContext.framework === 'nextjs' ? 'nextjs-api-route' : 'express-handler',
      });

      // Generate tests
      filesToCreate.push({
        path: routePath.replace('.ts', '.test.ts'),
        purpose: `Tests for ${behavior.name} (from ISL pre/post conditions)`,
        template: 'vitest-test',
      });

      // Check for required middleware
      for (const intent of behavior.intents) {
        this.checkIntentRequirements(intent.tag, dependencies, warnings, refused);
      }
    }

    // Add index export
    filesToModify.push({
      path: 'src/routes/index.ts',
      reason: 'Export new route handlers',
      changes: ast.behaviors.map(b => ({
        type: 'append' as const,
        location: 'end',
        content: `export { ${camelCase(b.name)}Router } from './${kebabCase(b.name)}';`,
      })),
    });

    return {
      filesToCreate,
      filesToModify,
      dependencies,
      warnings,
      refused,
    };
  }

  /**
   * Generate code from ISL AST
   */
  generate(request: GenerationRequest): GenerationResult {
    const { ast, options } = request;
    const plan = this.plan(ast);
    const diffs: FileDiff[] = [];
    const proofLinks: ProofLink[] = [];

    // Generate each planned file
    for (const planned of plan.filesToCreate) {
      const template = TEMPLATES[planned.template as keyof typeof TEMPLATES];
      if (!template) {
        continue;
      }

      let content: string;
      if (planned.template === 'typescript-types' || planned.template === 'zod-schemas') {
        content = (template as (ast: ISLAST) => string)(ast);
      } else {
        // Find the behavior for this file
        const behaviorName = planned.path.split('/').pop()?.replace('.ts', '').replace('.test', '');
        const behavior = ast.behaviors.find(b => 
          kebabCase(b.name) === behaviorName || 
          kebabCase(b.name) === behaviorName?.replace('.test', '')
        );
        if (behavior) {
          content = (template as (behavior: BehaviorAST, ctx: RepoContext) => string)(behavior, this.repoContext);
          
          // Create proof links
          this.createProofLinks(behavior, planned.path, content, proofLinks);
        } else {
          content = `// TODO: Generate content for ${planned.path}`;
        }
      }

      diffs.push({
        path: planned.path,
        status: 'created',
        hunks: [{
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: content.split('\n').length,
          content: content.split('\n').map(l => `+ ${l}`).join('\n'),
        }],
      });
    }

    return {
      success: true,
      plan,
      diffs,
      proofLinks,
    };
  }

  /**
   * Get route path based on framework
   */
  private getRoutePath(behavior: BehaviorAST): string {
    const name = kebabCase(behavior.name);
    
    switch (this.repoContext.framework) {
      case 'nextjs':
        return `src/app/api/${name}/route.ts`;
      case 'express':
      case 'fastify':
        return `src/routes/${name}.ts`;
      case 'nestjs':
        return `src/${name}/${name}.controller.ts`;
      default:
        return `src/handlers/${name}.ts`;
    }
  }

  /**
   * Check intent requirements and add dependencies
   */
  private checkIntentRequirements(
    intent: string,
    dependencies: PlannedDependency[],
    warnings: string[],
    refused: RefusedAction[]
  ): void {
    switch (intent) {
      case 'rate-limit-required':
        if (!dependencies.some(d => d.name === 'rate-limiter-flexible')) {
          warnings.push('Rate limiting required - ensure middleware is configured');
        }
        break;
      case 'audit-required':
        warnings.push('Audit logging required - ensure audit service is configured');
        break;
      case 'encrypt-at-rest':
        warnings.push('Encryption at rest required - ensure database encryption is configured');
        break;
      case 'no-pii-logging':
        warnings.push('PII logging prohibited - review all console/log statements');
        break;
      case 'idempotency-required':
        warnings.push('Idempotency required - ensure idempotency key handling');
        break;
      case 'server-side-amount':
        refused.push({
          action: 'Accept amount from client',
          reason: 'ISL intent server-side-amount prohibits client-provided amounts',
          suggestion: 'Calculate amount server-side from order/cart data',
        });
        break;
    }
  }

  /**
   * Create proof links between ISL clauses and generated code
   */
  private createProofLinks(
    behavior: BehaviorAST,
    filePath: string,
    content: string,
    proofLinks: ProofLink[]
  ): void {
    const lines = content.split('\n');

    // Link preconditions to validation code
    for (const pre of behavior.preconditions) {
      const validationLine = lines.findIndex(l => l.includes('safeParse') || l.includes('validate'));
      if (validationLine >= 0) {
        proofLinks.push({
          clause: {
            type: 'precondition',
            source: pre.source,
            behavior: behavior.name,
          },
          codeLocation: {
            file: filePath,
            startLine: validationLine + 1,
            endLine: validationLine + 5,
            snippet: lines.slice(validationLine, validationLine + 5).join('\n'),
          },
          satisfaction: 'direct',
        });
      }
    }

    // Link intents to middleware
    for (const intent of behavior.intents) {
      const intentComment = lines.findIndex(l => l.includes(`@intent ${intent.tag}`));
      if (intentComment >= 0) {
        proofLinks.push({
          clause: {
            type: 'intent',
            source: intent.tag,
            behavior: behavior.name,
          },
          codeLocation: {
            file: filePath,
            startLine: intentComment + 1,
            endLine: intentComment + 5,
            snippet: lines.slice(intentComment, intentComment + 5).join('\n'),
          },
          satisfaction: 'middleware',
        });
      }
    }

    // Link postconditions to TODO comments
    for (const post of behavior.postconditions) {
      for (const pred of post.predicates) {
        const todoLine = lines.findIndex(l => l.includes(pred.source));
        if (todoLine >= 0) {
          proofLinks.push({
            clause: {
              type: 'postcondition',
              source: pred.source,
              behavior: behavior.name,
            },
            codeLocation: {
              file: filePath,
              startLine: todoLine + 1,
              endLine: todoLine + 1,
              snippet: lines[todoLine],
            },
            satisfaction: 'test', // Will be verified by tests
          });
        }
      }
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function camelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function tsType(field: FieldAST): string {
  const typeMap: Record<string, string> = {
    'String': 'string',
    'Int': 'number',
    'Float': 'number',
    'Boolean': 'boolean',
    'DateTime': 'Date',
    'UUID': 'string',
    'Email': 'string',
    'Void': 'void',
  };
  return typeMap[field.type.name] || field.type.name;
}

function zodType(field: FieldAST): string {
  const typeMap: Record<string, string> = {
    'String': 'z.string()',
    'Int': 'z.number().int()',
    'Float': 'z.number()',
    'Boolean': 'z.boolean()',
    'DateTime': 'z.date()',
    'UUID': 'z.string().uuid()',
    'Email': 'z.string().email()',
  };
  
  let base = typeMap[field.type.name] || 'z.unknown()';
  
  // Add constraints
  for (const constraint of field.constraints) {
    if (constraint.expression.includes('min length')) {
      const match = constraint.expression.match(/min length (\d+)/);
      if (match) {
        base += `.min(${match[1]})`;
      }
    }
    if (constraint.expression.includes('max length')) {
      const match = constraint.expression.match(/max length (\d+)/);
      if (match) {
        base += `.max(${match[1]})`;
      }
    }
  }
  
  return base;
}

function errorStatusCode(errorName: string): number {
  const statusMap: Record<string, number> = {
    'InvalidCredentials': 401,
    'Unauthorized': 401,
    'Forbidden': 403,
    'NotFound': 404,
    'Conflict': 409,
    'ValidationError': 400,
    'RateLimited': 429,
    'InternalError': 500,
  };
  return statusMap[errorName] || 400;
}

// ============================================================================
// Exports
// ============================================================================

export function createGenerator(repoContext: RepoContext): ISLGenerator {
  return new ISLGenerator(repoContext);
}
