/**
 * Error definition extractor from ISL files
 */

import { glob } from 'glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ErrorDefinition,
  ErrorExample,
  ErrorSeverity,
  ExtractionResult,
  ExtractionWarning,
} from './types.js';

/**
 * ISL error node structure (from parser)
 */
interface ISLErrorNode {
  type: 'error';
  name: string;
  code?: string;
  httpStatus?: number;
  message?: string;
  description?: string;
  retriable?: boolean;
  retryAfter?: number;
  severity?: string;
  causes?: string[];
  resolutions?: string[];
  relatedErrors?: string[];
  example?: {
    request?: { method: string; path: string; body?: unknown };
    response?: { status: number; body: unknown };
  };
  tags?: string[];
  deprecated?: { since: string; replacement?: string; message: string };
  metadata?: Record<string, unknown>;
}

/**
 * ISL domain node
 */
interface ISLDomainNode {
  type: 'domain';
  name: string;
  errors?: ISLErrorNode[];
}

/**
 * ISL AST root
 */
interface ISLAST {
  domains?: ISLDomainNode[];
  errors?: ISLErrorNode[];
}

/**
 * Error extractor class
 */
export class ErrorExtractor {
  private warnings: ExtractionWarning[] = [];
  private codeCounter: Map<string, number> = new Map();

  /**
   * Extract errors from a glob pattern
   */
  async extractFromGlob(pattern: string): Promise<ExtractionResult> {
    const files = await glob(pattern);
    const allErrors: ErrorDefinition[] = [];
    this.warnings = [];

    for (const file of files) {
      const errors = await this.extractFromFile(file);
      allErrors.push(...errors);
    }

    return {
      errors: allErrors,
      warnings: this.warnings,
      sourceFiles: files,
    };
  }

  /**
   * Extract errors from a single file
   */
  async extractFromFile(filePath: string): Promise<ErrorDefinition[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.extractFromSource(content, filePath);
  }

  /**
   * Extract errors from ISL source string
   */
  extractFromSource(source: string, filePath?: string): ErrorDefinition[] {
    try {
      const ast = this.parseISL(source);
      return this.extractFromAST(ast, filePath);
    } catch (error) {
      this.warnings.push({
        message: `Failed to parse file: ${error}`,
        file: filePath ?? 'unknown',
        severity: 'warning',
      });
      return [];
    }
  }

  /**
   * Parse ISL source to AST (simplified parser)
   */
  private parseISL(source: string): ISLAST {
    const ast: ISLAST = { domains: [], errors: [] };
    const lines = source.split('\n');

    let currentDomain: ISLDomainNode | null = null;
    let currentError: Partial<ISLErrorNode> | null = null;
    let inDescription = false;
    let descriptionLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || !trimmed) {
        continue;
      }

      // Domain declaration
      const domainMatch = trimmed.match(/^domain\s+(\w+)\s*\{?/);
      if (domainMatch) {
        if (currentDomain) {
          ast.domains!.push(currentDomain);
        }
        currentDomain = {
          type: 'domain',
          name: domainMatch[1],
          errors: [],
        };
        continue;
      }

      // Error declaration
      const errorMatch = trimmed.match(/^error\s+(\w+)\s*\{?/);
      if (errorMatch) {
        if (currentError) {
          this.finalizeError(currentError, currentDomain, ast);
        }
        currentError = {
          type: 'error',
          name: errorMatch[1],
        };
        continue;
      }

      // Error properties
      if (currentError) {
        // Code
        const codeMatch = trimmed.match(/^code:\s*["']?(\w+)["']?/);
        if (codeMatch) {
          currentError.code = codeMatch[1];
          continue;
        }

        // HTTP status
        const httpMatch = trimmed.match(/^httpStatus:\s*(\d+)/);
        if (httpMatch) {
          currentError.httpStatus = parseInt(httpMatch[1], 10);
          continue;
        }

        // Message
        const messageMatch = trimmed.match(/^message:\s*["'](.+)["']/);
        if (messageMatch) {
          currentError.message = messageMatch[1];
          continue;
        }

        // Retriable
        const retriableMatch = trimmed.match(/^retriable:\s*(true|false)/);
        if (retriableMatch) {
          currentError.retriable = retriableMatch[1] === 'true';
          continue;
        }

        // Retry after
        const retryMatch = trimmed.match(/^retryAfter:\s*(\d+)/);
        if (retryMatch) {
          currentError.retryAfter = parseInt(retryMatch[1], 10);
          continue;
        }

        // Severity
        const severityMatch = trimmed.match(/^severity:\s*(\w+)/);
        if (severityMatch) {
          currentError.severity = severityMatch[1];
          continue;
        }

        // Description start
        if (trimmed.startsWith('description:')) {
          inDescription = true;
          const inline = trimmed.replace('description:', '').trim();
          if (inline.startsWith('"""') || inline.startsWith("'''")) {
            descriptionLines = [];
          } else if (inline) {
            currentError.description = inline.replace(/["']/g, '');
            inDescription = false;
          }
          continue;
        }

        // Multi-line description
        if (inDescription) {
          if (trimmed.endsWith('"""') || trimmed.endsWith("'''")) {
            currentError.description = descriptionLines.join('\n');
            descriptionLines = [];
            inDescription = false;
          } else {
            descriptionLines.push(trimmed);
          }
          continue;
        }

        // Causes
        const causesMatch = trimmed.match(/^causes:\s*\[(.+)\]/);
        if (causesMatch) {
          currentError.causes = this.parseStringArray(causesMatch[1]);
          continue;
        }

        // Resolutions
        const resolutionsMatch = trimmed.match(/^resolutions:\s*\[(.+)\]/);
        if (resolutionsMatch) {
          currentError.resolutions = this.parseStringArray(resolutionsMatch[1]);
          continue;
        }

        // Tags
        const tagsMatch = trimmed.match(/^tags:\s*\[(.+)\]/);
        if (tagsMatch) {
          currentError.tags = this.parseStringArray(tagsMatch[1]);
          continue;
        }

        // End of error block
        if (trimmed === '}') {
          this.finalizeError(currentError, currentDomain, ast);
          currentError = null;
        }
      }

      // End of domain block
      if (trimmed === '}' && currentDomain && !currentError) {
        ast.domains!.push(currentDomain);
        currentDomain = null;
      }
    }

    // Finalize any remaining
    if (currentError) {
      this.finalizeError(currentError, currentDomain, ast);
    }
    if (currentDomain) {
      ast.domains!.push(currentDomain);
    }

    return ast;
  }

  /**
   * Parse string array from ISL
   */
  private parseStringArray(input: string): string[] {
    return input
      .split(',')
      .map((s) => s.trim().replace(/["']/g, ''))
      .filter((s) => s.length > 0);
  }

  /**
   * Finalize error and add to appropriate location
   */
  private finalizeError(
    error: Partial<ISLErrorNode>,
    domain: ISLDomainNode | null,
    ast: ISLAST
  ): void {
    if (!error.name) return;

    const finalError: ISLErrorNode = {
      type: 'error',
      name: error.name,
      code: error.code,
      httpStatus: error.httpStatus,
      message: error.message,
      description: error.description,
      retriable: error.retriable,
      retryAfter: error.retryAfter,
      severity: error.severity,
      causes: error.causes,
      resolutions: error.resolutions,
      tags: error.tags,
      deprecated: error.deprecated,
      metadata: error.metadata,
    };

    if (domain) {
      domain.errors!.push(finalError);
    } else {
      ast.errors!.push(finalError);
    }
  }

  /**
   * Extract error definitions from AST
   */
  private extractFromAST(ast: ISLAST, filePath?: string): ErrorDefinition[] {
    const errors: ErrorDefinition[] = [];

    // Process domain-scoped errors
    for (const domain of ast.domains ?? []) {
      for (const error of domain.errors ?? []) {
        errors.push(this.convertError(error, domain.name, filePath));
      }
    }

    // Process global errors
    for (const error of ast.errors ?? []) {
      errors.push(this.convertError(error, 'global', filePath));
    }

    return errors;
  }

  /**
   * Convert ISL error node to ErrorDefinition
   */
  private convertError(
    node: ISLErrorNode,
    domain: string,
    filePath?: string
  ): ErrorDefinition {
    const code = node.code ?? this.generateCode(domain);

    return {
      id: node.name,
      code,
      domain,
      httpStatus: node.httpStatus ?? this.inferHttpStatus(node.name),
      message: node.message ?? this.generateMessage(node.name),
      description: node.description ?? '',
      retriable: node.retriable ?? this.inferRetriable(node.httpStatus),
      retryAfter: node.retryAfter,
      severity: this.normalizeSeverity(node.severity),
      causes: node.causes ?? [],
      resolutions: node.resolutions ?? [],
      relatedErrors: node.relatedErrors ?? [],
      example: this.convertExample(node.example, node.httpStatus ?? 400),
      metadata: node.metadata ?? {},
      sourceFile: filePath,
      tags: node.tags ?? [],
      deprecated: node.deprecated,
    };
  }

  /**
   * Generate error code if not specified
   */
  private generateCode(domain: string): string {
    const prefix = domain.substring(0, 4).toUpperCase();
    const count = (this.codeCounter.get(prefix) ?? 0) + 1;
    this.codeCounter.set(prefix, count);
    return `${prefix}_${count.toString().padStart(3, '0')}`;
  }

  /**
   * Infer HTTP status from error name
   */
  private inferHttpStatus(name: string): number {
    const normalized = name.toUpperCase();

    if (normalized.includes('NOT_FOUND')) return 404;
    if (normalized.includes('UNAUTHORIZED') || normalized.includes('UNAUTHENTICATED')) return 401;
    if (normalized.includes('FORBIDDEN') || normalized.includes('ACCESS_DENIED')) return 403;
    if (normalized.includes('DUPLICATE') || normalized.includes('CONFLICT')) return 409;
    if (normalized.includes('RATE_LIMIT')) return 429;
    if (normalized.includes('INVALID') || normalized.includes('VALIDATION')) return 400;
    if (normalized.includes('TIMEOUT')) return 408;
    if (normalized.includes('UNAVAILABLE')) return 503;
    if (normalized.includes('INTERNAL') || normalized.includes('SERVER')) return 500;

    return 400; // Default to bad request
  }

  /**
   * Infer if error is retriable
   */
  private inferRetriable(httpStatus?: number): boolean {
    if (!httpStatus) return false;

    // 5xx errors and 429 are typically retriable
    return httpStatus >= 500 || httpStatus === 429 || httpStatus === 408;
  }

  /**
   * Generate human-readable message from error name
   */
  private generateMessage(name: string): string {
    return name
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Normalize severity to valid value
   */
  private normalizeSeverity(severity?: string): ErrorSeverity {
    if (!severity) return 'error';

    const normalized = severity.toLowerCase();
    if (['critical', 'error', 'warning', 'info'].includes(normalized)) {
      return normalized as ErrorSeverity;
    }

    return 'error';
  }

  /**
   * Convert example to proper format
   */
  private convertExample(
    example: ISLErrorNode['example'],
    httpStatus: number
  ): ErrorExample | undefined {
    if (!example) return undefined;

    return {
      request: example.request
        ? {
            method: example.request.method,
            path: example.request.path,
            body: example.request.body as Record<string, unknown>,
          }
        : undefined,
      response: {
        status: example.response?.status ?? httpStatus,
        body: (example.response?.body ?? {}) as Record<string, unknown>,
      },
    };
  }
}
