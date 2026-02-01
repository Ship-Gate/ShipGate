/**
 * REST API Generator
 * 
 * Generates Express/Fastify routes from ISL behaviors.
 */

import type { GeneratedFile, DomainSpec, ApiEndpoint, ApiMethod, BehaviorSpec } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface RestApiOptions {
  /** Framework to generate for */
  framework: 'express' | 'fastify' | 'hono';
  /** Base path for API */
  basePath?: string;
  /** Include validation middleware */
  validation?: boolean;
  /** Include authentication middleware */
  authentication?: boolean;
  /** Generate OpenAPI spec */
  generateOpenAPI?: boolean;
  /** Output directory prefix */
  outputPrefix?: string;
}

// ============================================================================
// REST Generator
// ============================================================================

export class RestGenerator {
  private options: Required<RestApiOptions>;

  constructor(options: RestApiOptions) {
    this.options = {
      framework: options.framework,
      basePath: options.basePath || '/api',
      validation: options.validation ?? true,
      authentication: options.authentication ?? true,
      generateOpenAPI: options.generateOpenAPI ?? true,
      outputPrefix: options.outputPrefix || '',
    };
  }

  /**
   * Generate REST API from domain spec
   */
  generate(domain: DomainSpec): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const endpoints = this.extractEndpoints(domain);

    // Generate routes file
    files.push({
      path: `${this.options.outputPrefix}routes.ts`,
      content: this.generateRoutes(domain, endpoints),
      type: 'routes',
    });

    // Generate handlers
    files.push({
      path: `${this.options.outputPrefix}handlers.ts`,
      content: this.generateHandlers(domain, endpoints),
      type: 'handlers',
    });

    // Generate validation middleware
    if (this.options.validation) {
      files.push({
        path: `${this.options.outputPrefix}validation.ts`,
        content: this.generateValidation(domain),
        type: 'middleware',
      });
    }

    // Generate types
    files.push({
      path: `${this.options.outputPrefix}types.ts`,
      content: this.generateTypes(domain),
      type: 'types',
    });

    return files;
  }

  /**
   * Extract API endpoints from behaviors
   */
  private extractEndpoints(domain: DomainSpec): ApiEndpoint[] {
    return domain.behaviors.map(behavior => ({
      path: this.behaviorToPath(behavior.name),
      method: this.inferMethod(behavior),
      behavior: behavior.name,
      operationId: this.toCamelCase(behavior.name),
      summary: behavior.description || `Execute ${behavior.name}`,
      tags: [domain.name],
      requestBody: behavior.input ? {
        required: true,
        contentType: 'application/json',
        schema: { $ref: `#/components/schemas/${behavior.name}Input` },
      } : undefined,
      responses: this.generateResponses(behavior),
      parameters: this.extractParameters(behavior),
      security: this.extractSecurity(behavior),
    }));
  }

  /**
   * Generate routes file
   */
  private generateRoutes(domain: DomainSpec, endpoints: ApiEndpoint[]): string {
    const lines: string[] = [
      '/**',
      ` * Generated REST routes for ${domain.name}`,
      ' * DO NOT EDIT - Auto-generated from ISL',
      ' */',
      '',
    ];

    switch (this.options.framework) {
      case 'express':
        lines.push(...this.generateExpressRoutes(endpoints));
        break;
      case 'fastify':
        lines.push(...this.generateFastifyRoutes(endpoints));
        break;
      case 'hono':
        lines.push(...this.generateHonoRoutes(endpoints));
        break;
    }

    return lines.join('\n');
  }

  private generateExpressRoutes(endpoints: ApiEndpoint[]): string[] {
    const lines = [
      "import { Router, Request, Response, NextFunction } from 'express';",
      "import * as handlers from './handlers.js';",
    ];

    if (this.options.validation) {
      lines.push("import { validate } from './validation.js';");
    }

    lines.push('', 'const router = Router();', '');

    for (const endpoint of endpoints) {
      const method = endpoint.method.toLowerCase();
      const path = `${this.options.basePath}${endpoint.path}`;
      const middleware: string[] = [];

      if (this.options.validation && endpoint.requestBody) {
        middleware.push(`validate('${endpoint.behavior}Input')`);
      }

      const middlewareStr = middleware.length > 0 ? middleware.join(', ') + ', ' : '';

      lines.push(`router.${method}('${path}', ${middlewareStr}handlers.${endpoint.operationId});`);
    }

    lines.push('', 'export default router;');
    return lines;
  }

  private generateFastifyRoutes(endpoints: ApiEndpoint[]): string[] {
    const lines = [
      "import { FastifyInstance } from 'fastify';",
      "import * as handlers from './handlers.js';",
      '',
      'export async function routes(app: FastifyInstance) {',
    ];

    for (const endpoint of endpoints) {
      const method = endpoint.method.toLowerCase();
      const path = `${this.options.basePath}${endpoint.path}`;

      lines.push(`  app.${method}('${path}', handlers.${endpoint.operationId});`);
    }

    lines.push('}');
    return lines;
  }

  private generateHonoRoutes(endpoints: ApiEndpoint[]): string[] {
    const lines = [
      "import { Hono } from 'hono';",
      "import * as handlers from './handlers.js';",
      '',
      'const app = new Hono();',
      '',
    ];

    for (const endpoint of endpoints) {
      const method = endpoint.method.toLowerCase();
      const path = `${this.options.basePath}${endpoint.path}`;

      lines.push(`app.${method}('${path}', handlers.${endpoint.operationId});`);
    }

    lines.push('', 'export default app;');
    return lines;
  }

  /**
   * Generate handlers file
   */
  private generateHandlers(domain: DomainSpec, endpoints: ApiEndpoint[]): string {
    const lines = [
      '/**',
      ` * Generated handlers for ${domain.name}`,
      ' * DO NOT EDIT - Auto-generated from ISL',
      ' */',
      '',
      "import type { Request, Response } from 'express';",
      "import type * as Types from './types.js';",
      '',
    ];

    for (const endpoint of endpoints) {
      const behavior = domain.behaviors.find(b => b.name === endpoint.behavior);

      lines.push('/**');
      lines.push(` * ${endpoint.summary}`);
      lines.push(' */');
      lines.push(`export async function ${endpoint.operationId}(req: Request, res: Response): Promise<void> {`);
      lines.push('  try {');

      if (behavior?.input) {
        lines.push(`    const input: Types.${behavior.name}Input = req.body;`);
        lines.push('');
        lines.push('    // TODO: Call domain behavior');
        lines.push('    // const result = await runtime.execute(input);');
        lines.push('');
        lines.push('    res.json({ success: true, data: input });');
      } else {
        lines.push('    // TODO: Call domain behavior');
        lines.push('    res.json({ success: true });');
      }

      lines.push('  } catch (error) {');
      lines.push("    const message = error instanceof Error ? error.message : 'Unknown error';");
      lines.push('    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message } });');
      lines.push('  }');
      lines.push('}');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate validation middleware
   */
  private generateValidation(domain: DomainSpec): string {
    const lines = [
      '/**',
      ` * Generated validation for ${domain.name}`,
      ' */',
      '',
      "import { z } from 'zod';",
      "import type { Request, Response, NextFunction } from 'express';",
      '',
    ];

    // Generate schemas for each behavior input
    for (const behavior of domain.behaviors) {
      if (!behavior.input) continue;

      lines.push(`export const ${behavior.name}InputSchema = z.object({`);
      for (const field of behavior.input.fields) {
        const zodType = this.fieldToZod(field);
        lines.push(`  ${field.name}: ${zodType},`);
      }
      lines.push('});');
      lines.push('');
    }

    // Generate validate middleware
    lines.push('const schemas: Record<string, z.ZodSchema> = {');
    for (const behavior of domain.behaviors) {
      if (behavior.input) {
        lines.push(`  ${behavior.name}Input: ${behavior.name}InputSchema,`);
      }
    }
    lines.push('};');
    lines.push('');

    lines.push('export function validate(schemaName: string) {');
    lines.push('  return (req: Request, res: Response, next: NextFunction) => {');
    lines.push('    const schema = schemas[schemaName];');
    lines.push('    if (!schema) return next();');
    lines.push('');
    lines.push('    const result = schema.safeParse(req.body);');
    lines.push('    if (!result.success) {');
    lines.push('      return res.status(400).json({');
    lines.push('        success: false,');
    lines.push("        error: { code: 'VALIDATION_ERROR', message: result.error.message }");
    lines.push('      });');
    lines.push('    }');
    lines.push('');
    lines.push('    req.body = result.data;');
    lines.push('    next();');
    lines.push('  };');
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate TypeScript types
   */
  private generateTypes(domain: DomainSpec): string {
    const lines = [
      '/**',
      ` * Generated types for ${domain.name} API`,
      ' */',
      '',
    ];

    // Entity types
    for (const entity of domain.entities) {
      lines.push(`export interface ${entity.name} {`);
      for (const field of entity.fields) {
        const tsType = this.fieldToTypeScript(field);
        const optional = field.optional ? '?' : '';
        lines.push(`  ${field.name}${optional}: ${tsType};`);
      }
      lines.push('}');
      lines.push('');
    }

    // Behavior input/output types
    for (const behavior of domain.behaviors) {
      if (behavior.input) {
        lines.push(`export interface ${behavior.name}Input {`);
        for (const field of behavior.input.fields) {
          const tsType = this.fieldToTypeScript(field);
          const optional = field.optional ? '?' : '';
          lines.push(`  ${field.name}${optional}: ${tsType};`);
        }
        lines.push('}');
        lines.push('');
      }

      if (behavior.output) {
        lines.push(`export type ${behavior.name}Result =`);
        lines.push(`  | { success: true; data: ${behavior.output.success} }`);
        lines.push(`  | { success: false; error: ${behavior.name}Error };`);
        lines.push('');

        if (behavior.output.errors.length > 0) {
          const codes = behavior.output.errors.map(e => `'${e.name}'`).join(' | ');
          lines.push(`export type ${behavior.name}ErrorCode = ${codes};`);
          lines.push('');
          lines.push(`export interface ${behavior.name}Error {`);
          lines.push(`  code: ${behavior.name}ErrorCode;`);
          lines.push('  message: string;');
          lines.push('}');
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private behaviorToPath(name: string): string {
    return '/' + name
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
  }

  private inferMethod(behavior: BehaviorSpec): ApiMethod {
    const name = behavior.name.toLowerCase();
    if (name.startsWith('get') || name.startsWith('list') || name.startsWith('find')) return 'GET';
    if (name.startsWith('create') || name.startsWith('add')) return 'POST';
    if (name.startsWith('update') || name.startsWith('edit')) return 'PUT';
    if (name.startsWith('delete') || name.startsWith('remove')) return 'DELETE';
    return 'POST';
  }

  private generateResponses(behavior: BehaviorSpec): Array<{ statusCode: number; description: string; schema?: { $ref: string } }> {
    const responses = [
      { statusCode: 200, description: 'Success', schema: { $ref: `#/components/schemas/${behavior.name}Result` } },
    ];

    if (behavior.output?.errors) {
      responses.push({ statusCode: 400, description: 'Bad Request' });
      responses.push({ statusCode: 500, description: 'Internal Error' });
    }

    return responses;
  }

  private extractParameters(behavior: BehaviorSpec): Array<{ name: string; in: 'path' | 'query'; required: boolean; type: string }> {
    return [];
  }

  private extractSecurity(behavior: BehaviorSpec): Array<{ type: 'bearer'; scopes?: string[] }> {
    if (behavior.security?.some(s => s.type === 'requires')) {
      return [{ type: 'bearer' }];
    }
    return [];
  }

  private fieldToZod(field: { name: string; type: string; optional: boolean }): string {
    let schema = this.typeToZod(field.type);
    if (field.optional) schema += '.optional()';
    return schema;
  }

  private typeToZod(type: string): string {
    switch (type) {
      case 'String': return 'z.string()';
      case 'Int': return 'z.number().int()';
      case 'Decimal': return 'z.string()';
      case 'Boolean': return 'z.boolean()';
      case 'UUID': return 'z.string().uuid()';
      case 'Timestamp': return 'z.string().datetime()';
      default: return 'z.unknown()';
    }
  }

  private fieldToTypeScript(field: { type: string }): string {
    switch (field.type) {
      case 'String': return 'string';
      case 'Int': case 'Decimal': return 'number';
      case 'Boolean': return 'boolean';
      case 'UUID': return 'string';
      case 'Timestamp': return 'string';
      default: return field.type;
    }
  }

  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }
}

export function generateRestApi(domain: DomainSpec, options: RestApiOptions): GeneratedFile[] {
  return new RestGenerator(options).generate(domain);
}
